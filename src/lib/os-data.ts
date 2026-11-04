import { useSyncExternalStore } from "react";
import {
  getTenantUserId,
  isDemoOwnerTenant,
  onTenantChange,
  onTenantInitBlank,
  onTenantDelete,
  getSupabaseAuthHeaders,
} from "./auth";

export type OSStatus =
  | "Na Bancada"
  | "Em Orçamento"
  | "Aguardando Peça"
  | "Concluída"
  | "Finalizado"
  | "Entregue"
  | "Cancelada";

export const statusList: OSStatus[] = [
  "Em Orçamento",
  "Na Bancada",
  "Aguardando Peça",
  "Concluída",
  "Finalizado",
  "Entregue",
  "Cancelada",
];

export const isOSCancelada = (status: OSStatus) => status === "Cancelada";

export const isOSFinalizada = (status: OSStatus) =>
  !isOSCancelada(status) &&
  (status === "Concluída" || status === "Finalizado" || status === "Entregue");

export interface OrdemServico {
  numero: string;
  cliente: string;
  aparelho: string;
  defeito: string;
  status: OSStatus;
  entrada: string;
  finalizacao?: string | undefined;
  valor: number;
  custoPeca?: number | undefined;
  equipamento?: string | undefined;
  serie?: string | undefined;
  estado?: string | undefined;
  acessorios?: string | undefined;
  sintomas?: string[] | undefined;
  laudo?: string | undefined;
  tecnico?: string | undefined;
  servico?: string | undefined;
  pecas?: string | undefined;
  garantia?: string | undefined;
  observacoes?: string | undefined;
}

const ordensDemoOwner: OrdemServico[] = [
  { numero: "OS-8", cliente: "Mariana Costa", aparelho: "iPhone 13 Pro", defeito: "Tela trincada", status: "Na Bancada", entrada: "2026-10-27", valor: 1290, custoPeca: 480 },
  { numero: "OS-7", cliente: "Carlos Henrique", aparelho: "Samsung Galaxy S22", defeito: "Não carrega", status: "Em Orçamento", entrada: "2026-10-26", valor: 0, custoPeca: 0 },
  { numero: "OS-6", cliente: "Fernanda Lima", aparelho: "Notebook Dell Inspiron", defeito: "Superaquecimento", status: "Concluída", entrada: "2026-10-25", finalizacao: "2026-10-27", valor: 350, custoPeca: 90, servico: "Limpeza interna e troca de pasta térmica", pecas: "Pasta térmica de prata" },
  { numero: "OS-5", cliente: "João Pedro Alves", aparelho: "PlayStation 5", defeito: "Sem imagem HDMI", status: "Aguardando Peça", entrada: "2026-10-24", valor: 480, custoPeca: 140 },
  { numero: "OS-4", cliente: "Ana Beatriz Souza", aparelho: "Motorola Edge 30", defeito: "Bateria estufada", status: "Concluída", entrada: "2026-10-23", finalizacao: "2026-10-25", valor: 220, custoPeca: 75, servico: "Substituição de bateria original", pecas: "Bateria Motorola Edge 30" },
  { numero: "OS-3", cliente: "Ricardo Gomes", aparelho: "MacBook Air M1", defeito: "Teclado falhando", status: "Na Bancada", entrada: "2026-10-22", valor: 890, custoPeca: 320 },
  { numero: "OS-2", cliente: "Patrícia Rocha", aparelho: "iPad 9ª geração", defeito: "Touch não responde", status: "Cancelada", entrada: "2026-10-21", valor: 420, custoPeca: 180 },
  { numero: "OS-1", cliente: "Lucas Martins", aparelho: "Xiaomi Redmi Note 11", defeito: "Conector de carga", status: "Entregue", entrada: "2026-10-20", finalizacao: "2026-10-22", valor: 150, custoPeca: 25, servico: "Troca do conector de carga USB-C", pecas: "Conector de carga USB-C" },
];

export const ordens: OrdemServico[] = [...ordensDemoOwner];

export interface Cliente {
  id: string;
  nome: string;
  documento: string;
  whatsapp: string;
  email: string;
  cep: string;
  endereco: string;
}

const docs = [
  "123.456.789-00",
  "987.654.321-00",
  "12.345.678/0001-90",
  "456.789.123-00",
  "321.654.987-00",
  "789.123.456-00",
  "23.456.789/0001-01",
  "654.987.321-00",
];

const clientesDemoOwner: Cliente[] = Array.from(new Set(ordensDemoOwner.map((o) => o.cliente))).map(
  (nome, i) => ({
    id: String(i + 1),
    nome,
    documento: docs[i % docs.length] ?? "",
    whatsapp: `(11) 9${8100 + i * 37}-${String(1000 + i * 913).slice(0, 4)}`,
    email: `${(nome.split(" ")[0] ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}@email.com`,
    cep: `01${310 + i}-000`,
    endereco: `Rua das Flores, ${100 + i * 12} - Centro, São Paulo/SP`,
  }),
);

export const clientes: Cliente[] = [...clientesDemoOwner];

const getOSStorageKey = (userId: string) => `tecnofix-ordens-v3:${userId}`;
const getClientesStorageKey = (userId: string) => `tecnofix-clientes-v3:${userId}`;

let tenantCarregado: string | null = null;
let listaOrdens: OrdemServico[] = ordensDemoOwner;
let listaClientes: Cliente[] = clientesDemoOwner;

const ouvintesOrdens = new Set<() => void>();
const ouvintesClientes = new Set<() => void>();

function sincronizarExports(novasOrdens: OrdemServico[], novosClientes: Cliente[]) {
  listaOrdens = novasOrdens;
  listaClientes = novosClientes;
  ordens.splice(0, ordens.length, ...novasOrdens);
  clientes.splice(0, clientes.length, ...novosClientes);
}

/**
 * Calcula o próximo número sequencial de Ordem de Serviço individualmente por usuário:
 * Cada novo usuário começa na sua própria OS #1 ("OS-1").
 */
export function proximoNumeroOS(ordensDoUsuario: OrdemServico[] = listaOrdens): string {
  const nums = ordensDoUsuario
    .map((o) => Number(String(o.numero).replace(/\D/g, "")))
    .filter((n) => !Number.isNaN(n) && n > 0);
  const proximo = (nums.length > 0 ? Math.max(...nums) : 0) + 1;
  return `OS-${proximo}`;
}

function carregarTenantOSClientes(forceReload = false) {
  if (typeof window === "undefined") return;
  const userId = getTenantUserId();
  if (!forceReload && tenantCarregado === userId) return;
  tenantCarregado = userId;

  const padraoOrdens = isDemoOwnerTenant(userId) ? ordensDemoOwner : [];
  const padraoClientes = isDemoOwnerTenant(userId) ? clientesDemoOwner : [];

  let ordensLidas = padraoOrdens;
  let clientesLidos = padraoClientes;

  try {
    const rawOrdens = localStorage.getItem(getOSStorageKey(userId));
    if (rawOrdens) {
      const parsed = JSON.parse(rawOrdens) as OrdemServico[];
      if (Array.isArray(parsed)) {
        ordensLidas = parsed;
      }
    } else {
      localStorage.setItem(getOSStorageKey(userId), JSON.stringify(padraoOrdens));
    }

    const rawClientes = localStorage.getItem(getClientesStorageKey(userId));
    if (rawClientes) {
      const parsed = JSON.parse(rawClientes) as Cliente[];
      if (Array.isArray(parsed)) {
        clientesLidos = parsed;
      }
    } else {
      localStorage.setItem(getClientesStorageKey(userId), JSON.stringify(padraoClientes));
    }
  } catch {
    /* ignora */
  }

  sincronizarExports(ordensLidas, clientesLidos);
  void carregarOSClientesDoSupabase(userId);
}

async function carregarOSClientesDoSupabase(userId: string): Promise<void> {
  const authCfg = getSupabaseAuthHeaders();
  if (!authCfg || authCfg.userId !== userId) return;

  try {
    const [osResp, cliResp] = await Promise.all([
      fetch(
        `${authCfg.url}/rest/v1/service_orders?user_id=eq.${userId}&select=*&order=seq_numero.desc`,
        { headers: authCfg.headers },
      ),
      fetch(
        `${authCfg.url}/rest/v1/customers?user_id=eq.${userId}&select=*&order=created_at.desc`,
        { headers: authCfg.headers },
      ),
    ]);

    let mudou = false;
    let novasOrdens = listaOrdens;
    let novosClientes = listaClientes;

    if (osResp.ok) {
      const rows = await osResp.json();
      if (Array.isArray(rows)) {
        novasOrdens = rows.map((r) => ({
          numero: String(r.numero),
          cliente: String(r.cliente),
          aparelho: String(r.aparelho),
          defeito: String(r.defeito ?? ""),
          status: (r.status as OSStatus) || "Em Orçamento",
          entrada: String(r.entrada),
          finalizacao: r.finalizacao ?? undefined,
          valor: Number(r.valor ?? 0),
          custoPeca: Number(r.custo_peca ?? 0),
          equipamento: r.equipamento ?? undefined,
          serie: r.serie ?? undefined,
          estado: r.estado ?? undefined,
          acessorios: r.acessorios ?? undefined,
          sintomas: Array.isArray(r.sintomas) ? r.sintomas : undefined,
          laudo: r.laudo ?? undefined,
          tecnico: r.tecnico ?? undefined,
          servico: r.servico ?? undefined,
          pecas: r.pecas ?? undefined,
          garantia: r.garantia ?? undefined,
          observacoes: r.observacoes ?? undefined,
        }));
        mudou = true;
      }
    }

    if (cliResp.ok) {
      const rows = await cliResp.json();
      if (Array.isArray(rows)) {
        novosClientes = rows.map((r) => ({
          id: String(r.id),
          nome: String(r.nome),
          documento: String(r.documento ?? ""),
          whatsapp: String(r.whatsapp ?? r.telefone ?? ""),
          email: String(r.email ?? ""),
          cep: String(r.cep ?? ""),
          endereco: String(r.endereco ?? ""),
        }));
        mudou = true;
      }
    }

    if (mudou && getTenantUserId() === userId) {
      sincronizarExports(novasOrdens, novosClientes);
      try {
        localStorage.setItem(getOSStorageKey(userId), JSON.stringify(novasOrdens));
        localStorage.setItem(getClientesStorageKey(userId), JSON.stringify(novosClientes));
      } catch {
        /* ignora */
      }
      ouvintesOrdens.forEach((l) => l());
      ouvintesClientes.forEach((l) => l());
    }
  } catch {
    // Mantém dados locais isolados por user_id
  }
}

export function salvarOrdem(ordem: OrdemServico) {
  carregarTenantOSClientes();
  const userId = getTenantUserId();
  const idx = listaOrdens.findIndex((o) => o.numero === ordem.numero);
  const novaLista =
    idx >= 0
      ? listaOrdens.map((o, i) => (i === idx ? { ...o, ...ordem } : o))
      : [ordem, ...listaOrdens];

  sincronizarExports(novaLista, listaClientes);
  try {
    localStorage.setItem(getOSStorageKey(userId), JSON.stringify(novaLista));
  } catch {
    /* ignora */
  }
  ouvintesOrdens.forEach((l) => l());

  // Sincroniza em service_orders no Supabase com user_id estrito
  const authCfg = getSupabaseAuthHeaders();
  if (authCfg && authCfg.userId === userId) {
    const seqNumero = Number(String(ordem.numero).replace(/\D/g, "")) || 1;
    void fetch(`${authCfg.url}/rest/v1/service_orders?on_conflict=user_id,numero`, {
      method: "POST",
      headers: {
        ...authCfg.headers,
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        id: `os-${seqNumero}`,
        user_id: userId,
        seq_numero: seqNumero,
        numero: ordem.numero,
        cliente: ordem.cliente,
        aparelho: ordem.aparelho,
        defeito: ordem.defeito,
        status: ordem.status,
        entrada: ordem.entrada,
        finalizacao: ordem.finalizacao ?? null,
        valor: ordem.valor,
        custo_peca: ordem.custoPeca ?? 0,
        equipamento: ordem.equipamento ?? null,
        serie: ordem.serie ?? null,
        estado: ordem.estado ?? null,
        acessorios: ordem.acessorios ?? null,
        sintomas: ordem.sintomas ?? [],
        laudo: ordem.laudo ?? null,
        tecnico: ordem.tecnico ?? null,
        servico: ordem.servico ?? null,
        pecas: ordem.pecas ?? null,
        garantia: ordem.garantia ?? null,
        observacoes: ordem.observacoes ?? null,
        updated_at: new Date().toISOString(),
      }),
    }).catch(() => {});
  }
}

export function salvarCliente(cliente: Cliente) {
  carregarTenantOSClientes();
  const userId = getTenantUserId();
  const idx = listaClientes.findIndex((c) => c.id === cliente.id);
  const novaLista =
    idx >= 0
      ? listaClientes.map((c, i) => (i === idx ? { ...c, ...cliente } : c))
      : [cliente, ...listaClientes];

  sincronizarExports(listaOrdens, novaLista);
  try {
    localStorage.setItem(getClientesStorageKey(userId), JSON.stringify(novaLista));
  } catch {
    /* ignora */
  }
  ouvintesClientes.forEach((l) => l());

  // Sincroniza em customers no Supabase com user_id estrito
  const authCfg = getSupabaseAuthHeaders();
  if (authCfg && authCfg.userId === userId) {
    void fetch(`${authCfg.url}/rest/v1/customers?on_conflict=user_id,id`, {
      method: "POST",
      headers: {
        ...authCfg.headers,
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        id: cliente.id,
        user_id: userId,
        nome: cliente.nome,
        documento: cliente.documento,
        whatsapp: cliente.whatsapp,
        email: cliente.email,
        cep: cliente.cep,
        endereco: cliente.endereco,
        updated_at: new Date().toISOString(),
      }),
    }).catch(() => {});
  }
}

// Registra ouvintes de troca/criação/exclusão de tenant (Multi-Tenant)
onTenantChange(() => {
  carregarTenantOSClientes(true);
  ouvintesOrdens.forEach((l) => l());
  ouvintesClientes.forEach((l) => l());
});

onTenantInitBlank((newUserId) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getOSStorageKey(newUserId), JSON.stringify([]));
    localStorage.setItem(getClientesStorageKey(newUserId), JSON.stringify([]));
  } catch {
    /* ignora */
  }
});

onTenantDelete((deletedUserId) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(getOSStorageKey(deletedUserId));
    localStorage.removeItem(getClientesStorageKey(deletedUserId));
  } catch {
    /* ignora */
  }
});

export function useOrdens(): OrdemServico[] {
  return useSyncExternalStore(
    (l) => {
      ouvintesOrdens.add(l);
      return () => ouvintesOrdens.delete(l);
    },
    () => {
      carregarTenantOSClientes();
      return listaOrdens;
    },
    () => listaOrdens,
  );
}

export function useClientes(): Cliente[] {
  return useSyncExternalStore(
    (l) => {
      ouvintesClientes.add(l);
      return () => ouvintesClientes.delete(l);
    },
    () => {
      carregarTenantOSClientes();
      return listaClientes;
    },
    () => listaClientes,
  );
}

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const dataBR = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("pt-BR");

export const statusClass: Record<OSStatus, string> = {
  "Na Bancada": "bg-status-bench/15 text-status-bench",
  "Em Orçamento": "bg-status-quote/15 text-status-quote",
  "Aguardando Peça": "bg-muted text-muted-foreground",
  "Concluída": "bg-status-done/15 text-status-done",
  "Finalizado": "bg-status-done/15 text-status-done",
  "Entregue": "bg-primary/10 text-primary",
  "Cancelada": "bg-destructive/15 text-destructive",
};
