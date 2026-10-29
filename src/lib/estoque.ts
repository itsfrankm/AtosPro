import { useSyncExternalStore } from "react";
import {
  getTenantUserId,
  isDemoOwnerTenant,
  onTenantChange,
  onTenantInitBlank,
  onTenantDelete,
  getSupabaseAuthHeaders,
} from "./auth";

export interface Produto { id: string; nome: string; sku: string; quantidade: number; custo: number; venda: number }
export interface Fornecedor { id: string; nome: string; cnpj: string; telefone: string; endereco: string }
export interface ItemNota { produtoId: string; quantidade: number; valorUnit: number }
export interface NotaCompra { id: string; fornecedorId: string; data: string; numero: string; itens: ItemNota[]; total: number }
export interface ItemVenda { produtoId: string; nome: string; quantidade: number; preco: number; custoUnit?: number }

export type FormaPagamento = "Cartão de Crédito" | "Cartão de Débito" | "PIX" | "Dinheiro";
export const FORMAS_PAGAMENTO: FormaPagamento[] = [
  "Cartão de Crédito",
  "Cartão de Débito",
  "PIX",
  "Dinheiro",
];

export interface PagamentoVenda {
  forma: FormaPagamento;
  valor: number;
  valorRecebido?: number;
  troco?: number;
}

export interface Venda {
  id: string;
  numero: number;
  dataHora: string;
  itens: ItemVenda[];
  subtotal: number;
  desconto: number;
  arredondamento: number;
  total: number;
  pagamentos?: PagamentoVenda[];
  valorRecebidoDinheiro?: number;
  troco?: number;
}

export type TipoMovimentacaoCaixa = "entrada" | "saida";
export interface MovimentacaoCaixa {
  id: string;
  tipo: TipoMovimentacaoCaixa;
  valor: number;
  descricao: string;
  dataHora: string;
  origemVendaId?: string;
}

export interface PerfilEmpresa {
  nome: string;
  cnpj: string;
  telefone: string;
  email: string;
  endereco: string;
  logo: string;
}

export const perfilInicial: PerfilEmpresa = {
  nome: "AtosPro",
  cnpj: "00.000.000/0001-00",
  telefone: "(11) 99999-0000",
  email: "contato@atospro.com.br",
  endereco: "Rua Exemplo, 100 · Centro · São Paulo/SP",
  logo: "",
};

/** Perfil em branco exclusivo para novos logins criados */
export const perfilEmBranco: PerfilEmpresa = {
  nome: "",
  cnpj: "",
  telefone: "",
  email: "",
  endereco: "",
  logo: "",
};

export type PaletaId = "verde-claro" | "roxo" | "azul-escuro" | "ambar" | "grafite";
export type ModoTema = "light" | "dark";

export interface ConfigAparencia {
  paleta: PaletaId;
  modo: ModoTema;
}

export interface DefinicaoPaleta {
  id: PaletaId;
  nome: string;
  descricao: string;
  swatchHex: string;
  swatchSecundariaHex: string;
  chart1Hex: string;
  chart2Hex: string;
  varsLight: Record<string, string>;
  varsDark: Record<string, string>;
}

export const PALETAS_CORES: DefinicaoPaleta[] = [
  {
    id: "verde-claro",
    nome: "Verde Claro",
    descricao: "Visual moderno, leve e focado em agilidade operacional",
    swatchHex: "#10b981",
    swatchSecundariaHex: "#34d399",
    chart1Hex: "#10b981",
    chart2Hex: "#059669",
    varsLight: {
      "--primary": "oklch(0.62 0.17 155)",
      "--primary-foreground": "oklch(0.99 0 0)",
      "--ring": "oklch(0.62 0.17 155 / 0.4)",
      "--accent": "oklch(0.95 0.04 155)",
      "--accent-foreground": "oklch(0.28 0.08 155)",
      "--sidebar-primary": "oklch(0.65 0.17 155)",
      "--sidebar-primary-foreground": "oklch(0.99 0 0)",
      "--sidebar-ring": "oklch(0.65 0.17 155)",
      "--chart-1": "oklch(0.62 0.17 155)",
      "--chart-2": "oklch(0.52 0.14 162)",
    },
    varsDark: {
      "--primary": "oklch(0.68 0.17 155)",
      "--primary-foreground": "oklch(0.14 0.03 155)",
      "--ring": "oklch(0.68 0.17 155 / 0.45)",
      "--accent": "oklch(0.26 0.05 155)",
      "--accent-foreground": "oklch(0.95 0.03 155)",
      "--sidebar-primary": "oklch(0.68 0.17 155)",
      "--sidebar-primary-foreground": "oklch(0.14 0.03 155)",
      "--sidebar-ring": "oklch(0.68 0.17 155)",
      "--chart-1": "oklch(0.68 0.17 155)",
      "--chart-2": "oklch(0.58 0.15 162)",
    },
  },
  {
    id: "roxo",
    nome: "Roxo",
    descricao: "Identidade tecnológica vibrante com alto destaque nos menus e botões",
    swatchHex: "#7c3aed",
    swatchSecundariaHex: "#a78bfa",
    chart1Hex: "#7c3aed",
    chart2Hex: "#9333ea",
    varsLight: {
      "--primary": "oklch(0.54 0.23 292)",
      "--primary-foreground": "oklch(0.99 0 0)",
      "--ring": "oklch(0.54 0.23 292 / 0.4)",
      "--accent": "oklch(0.94 0.04 292)",
      "--accent-foreground": "oklch(0.32 0.12 292)",
      "--sidebar-primary": "oklch(0.58 0.22 292)",
      "--sidebar-primary-foreground": "oklch(0.99 0 0)",
      "--sidebar-ring": "oklch(0.58 0.22 292)",
      "--chart-1": "oklch(0.54 0.23 292)",
      "--chart-2": "oklch(0.62 0.2 305)",
    },
    varsDark: {
      "--primary": "oklch(0.65 0.21 292)",
      "--primary-foreground": "oklch(0.99 0 0)",
      "--ring": "oklch(0.65 0.21 292 / 0.45)",
      "--accent": "oklch(0.27 0.07 292)",
      "--accent-foreground": "oklch(0.95 0.03 292)",
      "--sidebar-primary": "oklch(0.65 0.21 292)",
      "--sidebar-primary-foreground": "oklch(0.99 0 0)",
      "--sidebar-ring": "oklch(0.65 0.21 292)",
      "--chart-1": "oklch(0.65 0.21 292)",
      "--chart-2": "oklch(0.7 0.18 305)",
    },
  },
  {
    id: "azul-escuro",
    nome: "Azul Escuro",
    descricao: "Estilo corporativo clássico com contraste elevado e leitura precisa",
    swatchHex: "#1d4ed8",
    swatchSecundariaHex: "#3b82f6",
    chart1Hex: "#1d4ed8",
    chart2Hex: "#2563eb",
    varsLight: {
      "--primary": "oklch(0.46 0.19 260)",
      "--primary-foreground": "oklch(0.99 0 0)",
      "--ring": "oklch(0.46 0.19 260 / 0.4)",
      "--accent": "oklch(0.94 0.035 255)",
      "--accent-foreground": "oklch(0.28 0.1 260)",
      "--sidebar-primary": "oklch(0.54 0.19 260)",
      "--sidebar-primary-foreground": "oklch(0.99 0 0)",
      "--sidebar-ring": "oklch(0.54 0.19 260)",
      "--chart-1": "oklch(0.46 0.19 260)",
      "--chart-2": "oklch(0.56 0.17 250)",
    },
    varsDark: {
      "--primary": "oklch(0.6 0.19 260)",
      "--primary-foreground": "oklch(0.99 0 0)",
      "--ring": "oklch(0.6 0.19 260 / 0.45)",
      "--accent": "oklch(0.27 0.06 260)",
      "--accent-foreground": "oklch(0.95 0.02 255)",
      "--sidebar-primary": "oklch(0.6 0.19 260)",
      "--sidebar-primary-foreground": "oklch(0.99 0 0)",
      "--sidebar-ring": "oklch(0.6 0.19 260)",
      "--chart-1": "oklch(0.6 0.19 260)",
      "--chart-2": "oklch(0.66 0.16 250)",
    },
  },
  {
    id: "ambar",
    nome: "Ambar",
    descricao: "Tons quentes de energia e destaque industrial para bancadas técnicas",
    swatchHex: "#d97706",
    swatchSecundariaHex: "#f59e0b",
    chart1Hex: "#d97706",
    chart2Hex: "#ea580c",
    varsLight: {
      "--primary": "oklch(0.64 0.17 68)",
      "--primary-foreground": "oklch(0.99 0 0)",
      "--ring": "oklch(0.64 0.17 68 / 0.4)",
      "--accent": "oklch(0.95 0.04 75)",
      "--accent-foreground": "oklch(0.34 0.09 65)",
      "--sidebar-primary": "oklch(0.68 0.17 70)",
      "--sidebar-primary-foreground": "oklch(0.16 0.03 65)",
      "--sidebar-ring": "oklch(0.68 0.17 70)",
      "--chart-1": "oklch(0.64 0.17 68)",
      "--chart-2": "oklch(0.58 0.18 48)",
    },
    varsDark: {
      "--primary": "oklch(0.74 0.17 72)",
      "--primary-foreground": "oklch(0.16 0.03 65)",
      "--ring": "oklch(0.74 0.17 72 / 0.45)",
      "--accent": "oklch(0.28 0.06 70)",
      "--accent-foreground": "oklch(0.95 0.03 75)",
      "--sidebar-primary": "oklch(0.74 0.17 72)",
      "--sidebar-primary-foreground": "oklch(0.16 0.03 65)",
      "--sidebar-ring": "oklch(0.74 0.17 72)",
      "--chart-1": "oklch(0.74 0.17 72)",
      "--chart-2": "oklch(0.66 0.17 50)",
    },
  },
  {
    id: "grafite",
    nome: "Grafite",
    descricao: "Acabamento minimalista, neutro e sofisticado em tons metálicos",
    swatchHex: "#334155",
    swatchSecundariaHex: "#64748b",
    chart1Hex: "#475569",
    chart2Hex: "#64748b",
    varsLight: {
      "--primary": "oklch(0.35 0.03 255)",
      "--primary-foreground": "oklch(0.99 0 0)",
      "--ring": "oklch(0.35 0.03 255 / 0.4)",
      "--accent": "oklch(0.93 0.01 255)",
      "--accent-foreground": "oklch(0.25 0.02 255)",
      "--sidebar-primary": "oklch(0.45 0.03 255)",
      "--sidebar-primary-foreground": "oklch(0.99 0 0)",
      "--sidebar-ring": "oklch(0.45 0.03 255)",
      "--chart-1": "oklch(0.38 0.03 255)",
      "--chart-2": "oklch(0.52 0.03 255)",
    },
    varsDark: {
      "--primary": "oklch(0.72 0.03 255)",
      "--primary-foreground": "oklch(0.16 0.02 255)",
      "--ring": "oklch(0.72 0.03 255 / 0.45)",
      "--accent": "oklch(0.28 0.02 255)",
      "--accent-foreground": "oklch(0.95 0.01 255)",
      "--sidebar-primary": "oklch(0.72 0.03 255)",
      "--sidebar-primary-foreground": "oklch(0.16 0.02 255)",
      "--sidebar-ring": "oklch(0.72 0.03 255)",
      "--chart-1": "oklch(0.72 0.03 255)",
      "--chart-2": "oklch(0.58 0.03 255)",
    },
  },
];

export const aparenciaInicial: ConfigAparencia = {
  paleta: "azul-escuro",
  modo: "light",
};

export function aplicarAparenciaNoDOM(cfg: ConfigAparencia) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", cfg.modo === "dark");
  root.dataset["paleta"] = cfg.paleta;
  const def = PALETAS_CORES.find((p) => p.id === cfg.paleta) ?? PALETAS_CORES[2]!;
  const vars = cfg.modo === "dark" ? def.varsDark : def.varsLight;
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v);
  }
}

export interface Estado {
  produtos: Produto[];
  fornecedores: Fornecedor[];
  notas: NotaCompra[];
  vendas: Venda[];
  caixa: MovimentacaoCaixa[];
  perfil: PerfilEmpresa;
  aparencia: ConfigAparencia;
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/** Lucro unitário = venda - custo */
export const lucroUnit = (custo: number, venda: number) => venda - custo;
/** % de lucro = ((venda - custo) / custo) * 100; null quando custo é zero */
export const lucroPct = (custo: number, venda: number) => (custo > 0 ? ((venda - custo) / custo) * 100 : null);

export const somaItens = (itens: { quantidade: number; valorUnit?: number; preco?: number }[]): number =>
  Number(itens.reduce((s, i) => s + i.quantidade * (i.valorUnit ?? i.preco ?? 0), 0).toFixed(2));

/** Aplica nota de compra: soma quantidades e atualiza custo para o valor unitário pago. */
export function aplicarCompra(produtos: Produto[], itens: ItemNota[]): Produto[] {
  return produtos.map((p) => {
    const its = itens.filter((i) => i.produtoId === p.id);
    if (!its.length) return p;
    return { ...p, quantidade: p.quantidade + its.reduce((s, i) => s + i.quantidade, 0), custo: its[its.length - 1]!.valorUnit };
  });
}

/** Dá baixa no estoque pelos itens vendidos, garantindo que não fique negativo. */
export function aplicarVenda(produtos: Produto[], itens: { produtoId: string; quantidade: number }[]): Produto[] {
  return produtos.map((p) => {
    const q = itens.filter((i) => i.produtoId === p.id).reduce((s, i) => s + i.quantidade, 0);
    return q ? { ...p, quantidade: Math.max(0, p.quantidade - q) } : p;
  });
}

/** Total final da venda: subtotal - desconto (R$ ou %), opcionalmente substituído por valor arredondado. */
export function calcTotal(subtotal: number, desconto: number, tipo: "R$" | "%", finalManual: number | null) {
  const d = Math.min(subtotal, Math.max(0, tipo === "%" ? (subtotal * desconto) / 100 : desconto));
  const comDesconto = +(subtotal - d).toFixed(2);
  const total = finalManual != null && finalManual >= 0 ? finalManual : comDesconto;
  return { desconto: +d.toFixed(2), comDesconto, arredondamento: +(total - comDesconto).toFixed(2), total: +total.toFixed(2) };
}

/** Calcula o valor recebido em dinheiro e o troco exato a devolver ao cliente. */
export function calcularTrocoDinheiro(valorAbatido: number, valorRecebido?: number) {
  const abatido = +Math.max(0, valorAbatido).toFixed(2);
  const recebido =
    valorRecebido !== undefined && valorRecebido > 0
      ? +Math.max(0, valorRecebido).toFixed(2)
      : abatido;
  const troco = recebido > abatido ? +(recebido - abatido).toFixed(2) : 0;
  return {
    valorAbatido: abatido,
    valorRecebido: recebido,
    troco,
  };
}

/**
 * Gera as movimentações físicas do Caixa para uma Venda concluída:
 * - Entrada do valor total recebido em espécie (ex.: R$ 50,00)
 * - Saída automática do troco devolvido identificada como "Troco da Venda #ID" (ex.: R$ 10,00)
 */
export function gerarMovimentacoesCaixaVenda(venda: Venda): MovimentacaoCaixa[] {
  const pagsDinheiro = (venda.pagamentos ?? []).filter((p) => p.forma === "Dinheiro" && p.valor > 0);
  const totalAbatido = +pagsDinheiro.reduce((s, p) => s + p.valor, 0).toFixed(2);
  if (totalAbatido <= 0) return [];

  const totalRecebido =
    venda.valorRecebidoDinheiro !== undefined && venda.valorRecebidoDinheiro > 0
      ? +venda.valorRecebidoDinheiro.toFixed(2)
      : +pagsDinheiro
          .reduce((s, p) => s + (p.valorRecebido && p.valorRecebido > 0 ? p.valorRecebido : p.valor), 0)
          .toFixed(2);

  const totalTroco =
    venda.troco !== undefined
      ? +Math.max(0, venda.troco).toFixed(2)
      : totalRecebido > totalAbatido
        ? +(totalRecebido - totalAbatido).toFixed(2)
        : 0;

  const resumoItens = venda.itens.map((i) => `${i.quantidade}× ${i.nome}`).join(", ");
  const movEntrada: MovimentacaoCaixa = {
    id: uid(),
    tipo: "entrada",
    valor: totalRecebido,
    descricao: `Recebimento em Dinheiro · Venda #${venda.numero}${resumoItens ? ` (${resumoItens})` : ""}`,
    dataHora: venda.dataHora,
    origemVendaId: venda.id,
  };

  if (totalTroco > 0) {
    const movSaidaTroco: MovimentacaoCaixa = {
      id: uid(),
      tipo: "saida",
      valor: totalTroco,
      descricao: `Troco da Venda #${venda.numero}`,
      dataHora: venda.dataHora,
      origemVendaId: venda.id,
    };
    return [movEntrada, movSaidaTroco];
  }

  return [movEntrada];
}

export function formatCNPJ(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
}
export function formatFone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

const KEY = "tecnofix-estoque-v2";
const inicial: Estado = {
  produtos: [
    { id: "p1", nome: "Tela iPhone 11", sku: "TL-IP11", quantidade: 6, custo: 180, venda: 350 },
    { id: "p2", nome: "Bateria Samsung A32", sku: "BT-A32", quantidade: 12, custo: 45, venda: 110 },
    { id: "p3", nome: "Conector de carga USB-C", sku: "CN-USBC", quantidade: 30, custo: 8, venda: 40 },
    { id: "p4", nome: "Película de vidro 3D", sku: "PL-3D", quantidade: 50, custo: 3.5, venda: 25 },
    { id: "p5", nome: "Cabo Lightning 1m", sku: "CB-LT1M", quantidade: 20, custo: 12, venda: 39.9 },
  ],
  fornecedores: [
    { id: "f1", nome: "Distribuidora Peças Cell Ltda", cnpj: "12.345.678/0001-90", telefone: "(11) 3333-4444", endereco: "Rua Santa Ifigênia, 500 - Centro, São Paulo/SP" },
    { id: "f2", nome: "Importadora TechParts Brasil", cnpj: "98.765.432/0001-10", telefone: "(11) 4002-8922", endereco: "Av. Paulista, 1200 - Bela Vista, São Paulo/SP" },
  ],
  notas: [
    {
      id: "n1",
      fornecedorId: "f1",
      data: "2026-10-26",
      numero: "000412",
      itens: [
        { produtoId: "p1", quantidade: 4, valorUnit: 180 },
        { produtoId: "p4", quantidade: 30, valorUnit: 3.5 },
      ],
      total: 825,
    },
    {
      id: "n2",
      fornecedorId: "f2",
      data: "2026-10-23",
      numero: "000889",
      itens: [
        { produtoId: "p2", quantidade: 8, valorUnit: 45 },
        { produtoId: "p3", quantidade: 20, valorUnit: 8 },
        { produtoId: "p5", quantidade: 15, valorUnit: 12 },
      ],
      total: 700,
    },
    {
      id: "n3",
      fornecedorId: "f1",
      data: "2026-10-10",
      numero: "000390",
      itens: [
        { produtoId: "p1", quantidade: 2, valorUnit: 175 },
        { produtoId: "p2", quantidade: 4, valorUnit: 44 },
      ],
      total: 526,
    },
    {
      id: "n4",
      fornecedorId: "f2",
      data: "2026-09-15",
      numero: "000750",
      itens: [
        { produtoId: "p4", quantidade: 20, valorUnit: 3.5 },
        { produtoId: "p5", quantidade: 10, valorUnit: 12 },
      ],
      total: 190,
    },
  ],
  vendas: [
    {
      id: "v1",
      numero: 1,
      dataHora: "2026-10-27T14:30:00.000Z",
      itens: [
        { produtoId: "p4", nome: "Película de vidro 3D", quantidade: 2, preco: 25, custoUnit: 3.5 },
        { produtoId: "p5", nome: "Cabo Lightning 1m", quantidade: 1, preco: 39.9, custoUnit: 12 },
      ],
      subtotal: 89.9,
      desconto: 0,
      arredondamento: -0.9,
      total: 89,
      pagamentos: [
        { forma: "PIX", valor: 50 },
        { forma: "Dinheiro", valor: 39 },
      ],
    },
    {
      id: "v2",
      numero: 2,
      dataHora: "2026-10-25T11:15:00.000Z",
      itens: [
        { produtoId: "p1", nome: "Tela iPhone 11", quantidade: 1, preco: 350, custoUnit: 180 },
        { produtoId: "p4", nome: "Película de vidro 3D", quantidade: 1, preco: 25, custoUnit: 3.5 },
      ],
      subtotal: 375,
      desconto: 15,
      arredondamento: 0,
      total: 360,
      pagamentos: [
        { forma: "Cartão de Crédito", valor: 260 },
        { forma: "Dinheiro", valor: 100 },
      ],
    },
    {
      id: "v3",
      numero: 3,
      dataHora: "2026-10-22T16:45:00.000Z",
      itens: [
        { produtoId: "p2", nome: "Bateria Samsung A32", quantidade: 2, preco: 110, custoUnit: 45 },
        { produtoId: "p3", nome: "Conector de carga USB-C", quantidade: 3, preco: 40, custoUnit: 8 },
      ],
      subtotal: 340,
      desconto: 10,
      arredondamento: 0,
      total: 330,
      pagamentos: [{ forma: "Cartão de Débito", valor: 330 }],
    },
    {
      id: "v4",
      numero: 4,
      dataHora: "2026-10-12T10:20:00.000Z",
      itens: [
        { produtoId: "p5", nome: "Cabo Lightning 1m", quantidade: 3, preco: 39.9, custoUnit: 12 },
      ],
      subtotal: 119.7,
      desconto: 0,
      arredondamento: -0.7,
      total: 119,
      pagamentos: [{ forma: "PIX", valor: 119 }],
    },
    {
      id: "v5",
      numero: 5,
      dataHora: "2026-09-18T15:00:00.000Z",
      itens: [
        { produtoId: "p1", nome: "Tela iPhone 11", quantidade: 1, preco: 350, custoUnit: 180 },
      ],
      subtotal: 350,
      desconto: 0,
      arredondamento: 0,
      total: 350,
      pagamentos: [
        { forma: "Cartão de Crédito", valor: 250 },
        { forma: "Dinheiro", valor: 100 },
      ],
    },
  ],
  caixa: [
    {
      id: "cx1",
      tipo: "entrada",
      valor: 500,
      descricao: "Fundo de troco inicial / Abertura do caixa",
      dataHora: "2026-10-22T08:30:00.000Z",
    },
    {
      id: "cx2",
      tipo: "entrada",
      valor: 250,
      descricao: "Suprimento de cédulas para troco na bancada",
      dataHora: "2026-10-25T10:00:00.000Z",
    },
    {
      id: "cx-v2",
      tipo: "entrada",
      valor: 100,
      descricao: "Recebimento em Dinheiro · Venda nº 2 (1× Tela iPhone 11, 1× Película de vidro 3D)",
      dataHora: "2026-10-25T11:15:00.000Z",
      origemVendaId: "v2",
    },
    {
      id: "cx-v1",
      tipo: "entrada",
      valor: 39,
      descricao: "Recebimento em Dinheiro · Venda nº 1 (2× Película de vidro 3D, 1× Cabo Lightning 1m)",
      dataHora: "2026-10-27T14:30:00.000Z",
      origemVendaId: "v1",
    },
    {
      id: "cx3",
      tipo: "saida",
      valor: 120,
      descricao: "Sangria para pagamento de motoboy e insumos de limpeza",
      dataHora: "2026-10-27T17:15:00.000Z",
    },
  ],
  perfil: perfilInicial,
  aparencia: aparenciaInicial,
};

/** Estado 100% em branco inicializado exclusivamente para cada novo login criado */
export function criarEstadoEmBranco(): Estado {
  return {
    produtos: [],
    fornecedores: [],
    notas: [],
    vendas: [],
    caixa: [],
    perfil: { ...perfilEmBranco },
    aparencia: { ...aparenciaInicial },
  };
}

/** Calcula o próximo número sequencial de Venda individualmente por usuário (começa em #1) */
export function proximoNumeroVenda(vendasDoUsuario: Venda[]): number {
  const nums = vendasDoUsuario
    .map((v) => Number(v.numero))
    .filter((n) => !Number.isNaN(n) && n > 0);
  return (nums.length > 0 ? Math.max(...nums) : 0) + 1;
}

const getStorageKey = (userId: string) => `tecnofix-estoque-v3:${userId}`;

let estado: Estado = inicial;
let tenantCarregado: string | null = null;
const ouvintes = new Set<() => void>();

function carregar(forceReload = false) {
  if (typeof window === "undefined") return;
  const userId = getTenantUserId();
  if (!forceReload && tenantCarregado === userId) return;
  tenantCarregado = userId;

  const basePadrao = isDemoOwnerTenant(userId) ? inicial : criarEstadoEmBranco();
  const perfilBase = isDemoOwnerTenant(userId) ? perfilInicial : perfilEmBranco;

  try {
    const s = localStorage.getItem(getStorageKey(userId));
    if (s) {
      const parsed = JSON.parse(s) as Partial<Estado>;
      const vendasMigradas = Array.isArray(parsed.vendas)
        ? parsed.vendas.map((v, idx) => ({
            ...v,
            pagamentos:
              v.pagamentos && v.pagamentos.length > 0
                ? v.pagamentos
                : basePadrao.vendas[idx]?.pagamentos ?? [{ forma: "PIX" as FormaPagamento, valor: v.total }],
          }))
        : basePadrao.vendas;
      estado = {
        ...basePadrao,
        ...parsed,
        produtos: Array.isArray(parsed.produtos) ? parsed.produtos : basePadrao.produtos,
        fornecedores: Array.isArray(parsed.fornecedores) ? parsed.fornecedores : basePadrao.fornecedores,
        notas: Array.isArray(parsed.notas) ? parsed.notas : basePadrao.notas,
        vendas: vendasMigradas,
        caixa: Array.isArray(parsed.caixa) ? parsed.caixa : basePadrao.caixa,
        perfil: parsed.perfil ? { ...perfilBase, ...parsed.perfil } : { ...perfilBase },
        aparencia: parsed.aparencia ? { ...aparenciaInicial, ...parsed.aparencia } : { ...aparenciaInicial },
      };
    } else {
      estado = basePadrao;
      localStorage.setItem(getStorageKey(userId), JSON.stringify(estado));
    }
    aplicarAparenciaNoDOM(estado.aparencia);
    void carregarTabelasDoSupabase(userId);
  } catch { /* ignora */ }
}

export async function carregarTabelasDoSupabase(targetUserId?: string): Promise<void> {
  const authCfg = getSupabaseAuthHeaders();
  if (!authCfg) return;
  const userId = targetUserId ?? authCfg.userId;
  if (authCfg.userId !== userId) return;

  try {
    const [
      settingsResp,
      prodResp,
      supResp,
      invResp,
      invItemsResp,
      salesResp,
      saleItemsResp,
      paymentsResp,
      caixaResp,
    ] = await Promise.all([
      fetch(`${authCfg.url}/rest/v1/store_settings?user_id=eq.${userId}&select=*`, {
        headers: authCfg.headers,
      }),
      fetch(`${authCfg.url}/rest/v1/products?user_id=eq.${userId}&select=*&order=created_at.asc`, {
        headers: authCfg.headers,
      }),
      fetch(`${authCfg.url}/rest/v1/suppliers?user_id=eq.${userId}&select=*&order=created_at.asc`, {
        headers: authCfg.headers,
      }),
      fetch(`${authCfg.url}/rest/v1/purchase_invoices?user_id=eq.${userId}&select=*&order=data.desc`, {
        headers: authCfg.headers,
      }),
      fetch(`${authCfg.url}/rest/v1/purchase_invoice_items?user_id=eq.${userId}&select=*`, {
        headers: authCfg.headers,
      }),
      fetch(`${authCfg.url}/rest/v1/sales?user_id=eq.${userId}&select=*&order=numero.asc`, {
        headers: authCfg.headers,
      }),
      fetch(`${authCfg.url}/rest/v1/sale_items?user_id=eq.${userId}&select=*`, {
        headers: authCfg.headers,
      }),
      fetch(`${authCfg.url}/rest/v1/sale_payments?user_id=eq.${userId}&select=*`, {
        headers: authCfg.headers,
      }),
      fetch(`${authCfg.url}/rest/v1/cash_register_movements?user_id=eq.${userId}&select=*&order=data_hora.asc`, {
        headers: authCfg.headers,
      }),
    ]);

    let alterou = false;

    if (settingsResp.ok) {
      const rows = await settingsResp.json();
      if (Array.isArray(rows) && rows[0]) {
        const s = rows[0];
        estado = {
          ...estado,
          perfil: {
            nome: s.nome_empresa ?? estado.perfil.nome,
            cnpj: s.cnpj ?? estado.perfil.cnpj,
            telefone: s.telefone ?? estado.perfil.telefone,
            email: s.email ?? estado.perfil.email,
            endereco: s.endereco ?? estado.perfil.endereco,
            logo: s.logo ?? estado.perfil.logo,
          },
          aparencia: {
            paleta: (s.paleta_cores as PaletaId) || estado.aparencia.paleta,
            modo: (s.modo_tema as ModoTema) || estado.aparencia.modo,
          },
        };
        aplicarAparenciaNoDOM(estado.aparencia);
        alterou = true;
      }
    }

    if (prodResp.ok) {
      const rows = await prodResp.json();
      if (Array.isArray(rows) && rows.length > 0) {
        estado = {
          ...estado,
          produtos: rows.map((r) => ({
            id: String(r.id),
            nome: String(r.nome),
            sku: String(r.sku ?? ""),
            quantidade: Number(r.quantidade ?? 0),
            custo: Number(r.custo ?? 0),
            venda: Number(r.venda ?? 0),
          })),
        };
        alterou = true;
      }
    }

    if (supResp.ok) {
      const rows = await supResp.json();
      if (Array.isArray(rows) && rows.length > 0) {
        estado = {
          ...estado,
          fornecedores: rows.map((r) => ({
            id: String(r.id),
            nome: String(r.nome),
            cnpj: String(r.cnpj ?? ""),
            telefone: String(r.telefone ?? ""),
            endereco: String(r.endereco ?? ""),
          })),
        };
        alterou = true;
      }
    }

    if (invResp.ok && invItemsResp.ok) {
      const invRows = await invResp.json();
      const itemRows = await invItemsResp.json();
      if (Array.isArray(invRows) && invRows.length > 0) {
        const itensPorNota = new Map<string, ItemNota[]>();
        if (Array.isArray(itemRows)) {
          for (const it of itemRows) {
            const lista = itensPorNota.get(String(it.nota_id)) ?? [];
            lista.push({
              produtoId: String(it.produto_id),
              quantidade: Number(it.quantidade ?? 1),
              valorUnit: Number(it.valor_unit ?? 0),
            });
            itensPorNota.set(String(it.nota_id), lista);
          }
        }
        estado = {
          ...estado,
          notas: invRows.map((n) => ({
            id: String(n.id),
            fornecedorId: String(n.fornecedor_id),
            data: String(n.data),
            numero: String(n.numero),
            itens: itensPorNota.get(String(n.id)) ?? [],
            total: Number(n.total ?? 0),
          })),
        };
        alterou = true;
      }
    }

    if (salesResp.ok) {
      const salesRows = await salesResp.json();
      const saleItemsRows = saleItemsResp.ok ? await saleItemsResp.json() : [];
      const paymentsRows = paymentsResp.ok ? await paymentsResp.json() : [];

      if (Array.isArray(salesRows) && salesRows.length > 0) {
        const itensPorVenda = new Map<string, ItemVenda[]>();
        if (Array.isArray(saleItemsRows)) {
          for (const it of saleItemsRows) {
            const lista = itensPorVenda.get(String(it.venda_id)) ?? [];
            lista.push({
              produtoId: String(it.produto_id),
              nome: String(it.nome),
              quantidade: Number(it.quantidade ?? 1),
              preco: Number(it.preco ?? 0),
              custoUnit: Number(it.custo_unit ?? 0),
            });
            itensPorVenda.set(String(it.venda_id), lista);
          }
        }

        const pagsPorVenda = new Map<string, PagamentoVenda[]>();
        if (Array.isArray(paymentsRows)) {
          for (const pg of paymentsRows) {
            const lista = pagsPorVenda.get(String(pg.venda_id)) ?? [];
            lista.push({
              forma: pg.forma as FormaPagamento,
              valor: Number(pg.valor ?? 0),
            });
            pagsPorVenda.set(String(pg.venda_id), lista);
          }
        }

        estado = {
          ...estado,
          vendas: salesRows.map((v) => ({
            id: String(v.id),
            numero: Number(v.numero ?? 1),
            dataHora: String(v.data_hora),
            itens: itensPorVenda.get(String(v.id)) ?? [],
            subtotal: Number(v.subtotal ?? 0),
            desconto: Number(v.desconto ?? 0),
            arredondamento: Number(v.arredondamento ?? 0),
            total: Number(v.total ?? 0),
            pagamentos: pagsPorVenda.get(String(v.id)) ?? [],
          })),
        };
        alterou = true;
      }
    }

    if (caixaResp.ok) {
      const rows = await caixaResp.json();
      if (Array.isArray(rows) && rows.length > 0) {
        estado = {
          ...estado,
          caixa: rows.map((r) => ({
            id: String(r.id),
            tipo: r.tipo === "saida" ? "saida" : "entrada",
            valor: Number(r.valor),
            descricao: String(r.descricao),
            dataHora: String(r.data_hora),
            origemVendaId: r.origem_venda_id ?? undefined,
          })),
        };
        alterou = true;
      }
    }

    if (alterou && getTenantUserId() === userId) {
      try { localStorage.setItem(getStorageKey(userId), JSON.stringify(estado)); } catch { /* ignora */ }
      ouvintes.forEach((l) => l());
    }
  } catch {
    // Mantém dados locais isolados por user_id
  }
}

async function sincronizarEstadoComSupabase(
  userId: string,
  anterior: Estado,
  proximo: Estado,
): Promise<void> {
  const authCfg = getSupabaseAuthHeaders();
  if (!authCfg || authCfg.userId !== userId) return;

  try {
    // 1. Sincroniza store_settings por user_id quando perfil ou aparencia mudam
    if (anterior.perfil !== proximo.perfil || anterior.aparencia !== proximo.aparencia) {
      await fetch(`${authCfg.url}/rest/v1/store_settings?on_conflict=user_id`, {
        method: "POST",
        headers: {
          ...authCfg.headers,
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          user_id: userId,
          nome_empresa: proximo.perfil.nome,
          cnpj: proximo.perfil.cnpj,
          telefone: proximo.perfil.telefone,
          email: proximo.perfil.email,
          endereco: proximo.perfil.endereco,
          logo: proximo.perfil.logo,
          paleta_cores: proximo.aparencia.paleta,
          modo_tema: proximo.aparencia.modo,
          updated_at: new Date().toISOString(),
        }),
      });
    }

    // 2. Sincroniza products por user_id
    if (anterior.produtos !== proximo.produtos && proximo.produtos.length > 0) {
      await fetch(`${authCfg.url}/rest/v1/products?on_conflict=user_id,id`, {
        method: "POST",
        headers: {
          ...authCfg.headers,
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify(
          proximo.produtos.map((p) => ({
            id: p.id,
            user_id: userId,
            nome: p.nome,
            sku: p.sku,
            quantidade: p.quantidade,
            custo: p.custo,
            venda: p.venda,
            updated_at: new Date().toISOString(),
          })),
        ),
      });
    }

    // 3. Sincroniza suppliers por user_id
    if (anterior.fornecedores !== proximo.fornecedores && proximo.fornecedores.length > 0) {
      await fetch(`${authCfg.url}/rest/v1/suppliers?on_conflict=user_id,id`, {
        method: "POST",
        headers: {
          ...authCfg.headers,
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify(
          proximo.fornecedores.map((f) => ({
            id: f.id,
            user_id: userId,
            nome: f.nome,
            cnpj: f.cnpj,
            telefone: f.telefone,
            endereco: f.endereco,
            updated_at: new Date().toISOString(),
          })),
        ),
      });
    }

    // 4. Sincroniza purchase_invoices e purchase_invoice_items por user_id
    if (anterior.notas !== proximo.notas) {
      const idsAntigos = new Set(anterior.notas.map((n) => n.id));
      const novasNotas = proximo.notas.filter((n) => !idsAntigos.has(n.id));
      if (novasNotas.length > 0) {
        await fetch(`${authCfg.url}/rest/v1/purchase_invoices?on_conflict=user_id,id`, {
          method: "POST",
          headers: {
            ...authCfg.headers,
            Prefer: "resolution=merge-duplicates",
          },
          body: JSON.stringify(
            novasNotas.map((n) => ({
              id: n.id,
              user_id: userId,
              fornecedor_id: n.fornecedorId,
              data: n.data,
              numero: n.numero,
              total: n.total,
            })),
          ),
        });

        const itensNotas = novasNotas.flatMap((n) =>
          n.itens.map((it, idx) => ({
            id: `${n.id}-it-${idx + 1}`,
            user_id: userId,
            nota_id: n.id,
            produto_id: it.produtoId,
            quantidade: it.quantidade,
            valor_unit: it.valorUnit,
          })),
        );
        if (itensNotas.length > 0) {
          await fetch(`${authCfg.url}/rest/v1/purchase_invoice_items?on_conflict=user_id,id`, {
            method: "POST",
            headers: {
              ...authCfg.headers,
              Prefer: "resolution=merge-duplicates",
            },
            body: JSON.stringify(itensNotas),
          });
        }
      }
    }

    // 5. Sincroniza sales, sale_items e sale_payments por user_id
    if (anterior.vendas !== proximo.vendas) {
      const idsVendasAntigas = new Set(anterior.vendas.map((v) => v.id));
      const novasVendas = proximo.vendas.filter((v) => !idsVendasAntigas.has(v.id));
      if (novasVendas.length > 0) {
        await fetch(`${authCfg.url}/rest/v1/sales?on_conflict=user_id,id`, {
          method: "POST",
          headers: {
            ...authCfg.headers,
            Prefer: "resolution=merge-duplicates",
          },
          body: JSON.stringify(
            novasVendas.map((v) => ({
              id: v.id,
              user_id: userId,
              numero: v.numero,
              data_hora: v.dataHora,
              subtotal: v.subtotal,
              desconto: v.desconto,
              arredondamento: v.arredondamento,
              total: v.total,
            })),
          ),
        });

        const rowsItens = novasVendas.flatMap((v) =>
          v.itens.map((it, idx) => ({
            id: `${v.id}-item-${idx + 1}`,
            user_id: userId,
            venda_id: v.id,
            produto_id: it.produtoId,
            nome: it.nome,
            quantidade: it.quantidade,
            preco: it.preco,
            custo_unit: it.custoUnit ?? 0,
          })),
        );
        if (rowsItens.length > 0) {
          await fetch(`${authCfg.url}/rest/v1/sale_items?on_conflict=user_id,id`, {
            method: "POST",
            headers: {
              ...authCfg.headers,
              Prefer: "resolution=merge-duplicates",
            },
            body: JSON.stringify(rowsItens),
          });
        }

        const rowsPagamentos = novasVendas.flatMap((v) =>
          (v.pagamentos ?? []).map((p, idx) => ({
            id: `${v.id}-pg-${idx + 1}`,
            user_id: userId,
            venda_id: v.id,
            venda_numero: v.numero,
            forma: p.forma,
            valor: p.valor,
            data_hora: v.dataHora,
          })),
        );
        if (rowsPagamentos.length > 0) {
          await fetch(`${authCfg.url}/rest/v1/sale_payments?on_conflict=user_id,id`, {
            method: "POST",
            headers: {
              ...authCfg.headers,
              Prefer: "resolution=merge-duplicates",
            },
            body: JSON.stringify(rowsPagamentos),
          });
        }
      }
    }

    // 6. Sincroniza novas movimentações em cash_register_movements por user_id
    if (anterior.caixa !== proximo.caixa) {
      const idsAnteriores = new Set(anterior.caixa.map((c) => c.id));
      const novasMovs = proximo.caixa.filter((c) => !idsAnteriores.has(c.id));
      if (novasMovs.length > 0) {
        await fetch(`${authCfg.url}/rest/v1/cash_register_movements?on_conflict=user_id,id`, {
          method: "POST",
          headers: {
            ...authCfg.headers,
            Prefer: "resolution=merge-duplicates",
          },
          body: JSON.stringify(
            novasMovs.map((m) => ({
              id: m.id,
              user_id: userId,
              tipo: m.tipo,
              valor: m.valor,
              descricao: m.descricao,
              data_hora: m.dataHora,
              origem_venda_id: m.origemVendaId ?? null,
            })),
          ),
        });
      }
    }
  } catch {
    // Mantém persistência local isolada por user_id caso sem rede
  }
}

export function setEstado(fn: (e: Estado) => Estado) {
  carregar();
  const userId = getTenantUserId();
  const anterior = estado;
  estado = fn(estado);
  aplicarAparenciaNoDOM(estado.aparencia);
  try { localStorage.setItem(getStorageKey(userId), JSON.stringify(estado)); } catch { /* ignora */ }
  void sincronizarEstadoComSupabase(userId, anterior, estado);
  ouvintes.forEach((l) => l());
}

// Registra ouvintes de troca/criação/exclusão de tenant (Multi-Tenant)
onTenantChange(() => {
  carregar(true);
  ouvintes.forEach((l) => l());
});

onTenantInitBlank((newUserId) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getStorageKey(newUserId), JSON.stringify(criarEstadoEmBranco()));
  } catch {
    /* ignora */
  }
});

onTenantDelete((deletedUserId) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(getStorageKey(deletedUserId));
  } catch {
    /* ignora */
  }
});

export function useEstoque(): Estado {
  return useSyncExternalStore(
    (l) => { ouvintes.add(l); return () => ouvintes.delete(l); },
    () => { carregar(); return estado; },
    () => estado,
  );
}
