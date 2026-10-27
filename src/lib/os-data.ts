export type OSStatus = "Na Bancada" | "Em Orçamento" | "Aguardando Peça" | "Concluída" | "Finalizado" | "Entregue";
export const statusList: OSStatus[] = ["Em Orçamento", "Na Bancada", "Aguardando Peça", "Concluída", "Finalizado", "Entregue"];

export interface OrdemServico {
  id: string;
  numero: string;
  clienteId: string;
  cliente: string;
  aparelho: string;
  defeito: string;
  status: OSStatus;
  entrada: string;
  valor: number;
}

export interface Cliente {
  id: string;
  nome: string;
  documento: string;
  whatsapp: string;
  email: string;
  cep: string;
  endereco: string;
}

export const formatNumero = (n: number) => `OS-${n}`;

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const dataBR = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("pt-BR");

export const statusClass: Record<OSStatus, string> = {
  "Na Bancada": "bg-status-bench/15 text-status-bench",
  "Em Orçamento": "bg-status-quote/15 text-status-quote",
  "Aguardando Peça": "bg-muted text-muted-foreground",
  "Concluída": "bg-status-done/15 text-status-done",
  "Finalizado": "bg-status-done/15 text-status-done",
  "Entregue": "bg-primary/10 text-primary",
};
