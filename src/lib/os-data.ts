export type OSStatus = "Na Bancada" | "Em Orçamento" | "Aguardando Peça" | "Concluída" | "Entregue";

export interface OrdemServico {
  numero: string;
  cliente: string;
  aparelho: string;
  defeito: string;
  status: OSStatus;
  entrada: string;
  valor: number;
}

export const ordens: OrdemServico[] = [
  { numero: "OS-1048", cliente: "Mariana Costa", aparelho: "iPhone 13 Pro", defeito: "Tela trincada", status: "Na Bancada", entrada: "2026-10-27", valor: 1290 },
  { numero: "OS-1047", cliente: "Carlos Henrique", aparelho: "Samsung Galaxy S22", defeito: "Não carrega", status: "Em Orçamento", entrada: "2026-10-26", valor: 0 },
  { numero: "OS-1046", cliente: "Fernanda Lima", aparelho: "Notebook Dell Inspiron", defeito: "Superaquecimento", status: "Concluída", entrada: "2026-10-25", valor: 350 },
  { numero: "OS-1045", cliente: "João Pedro Alves", aparelho: "PlayStation 5", defeito: "Sem imagem HDMI", status: "Aguardando Peça", entrada: "2026-10-24", valor: 480 },
  { numero: "OS-1044", cliente: "Ana Beatriz Souza", aparelho: "Motorola Edge 30", defeito: "Bateria estufada", status: "Concluída", entrada: "2026-10-23", valor: 220 },
  { numero: "OS-1043", cliente: "Ricardo Gomes", aparelho: "MacBook Air M1", defeito: "Teclado falhando", status: "Na Bancada", entrada: "2026-10-22", valor: 890 },
  { numero: "OS-1042", cliente: "Patrícia Rocha", aparelho: "iPad 9ª geração", defeito: "Touch não responde", status: "Em Orçamento", entrada: "2026-10-21", valor: 0 },
  { numero: "OS-1041", cliente: "Lucas Martins", aparelho: "Xiaomi Redmi Note 11", defeito: "Conector de carga", status: "Entregue", entrada: "2026-10-20", valor: 150 },
];

export interface Cliente {
  id: string;
  nome: string;
  documento: string;
  whatsapp: string;
  email: string;
  cep: string;
  endereco: string;
}

const docs = ["123.456.789-00", "987.654.321-00", "12.345.678/0001-90", "456.789.123-00", "321.654.987-00", "789.123.456-00", "23.456.789/0001-01", "654.987.321-00"];

export const clientes: Cliente[] = Array.from(new Set(ordens.map((o) => o.cliente))).map((nome, i) => ({
  id: String(i + 1),
  nome,
  documento: docs[i % docs.length],
  whatsapp: `(11) 9${8100 + i * 37}-${String(1000 + i * 913).slice(0, 4)}`,
  email: `${nome.split(" ")[0].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}@email.com`,
  cep: `01${310 + i}-000`,
  endereco: `Rua das Flores, ${100 + i * 12} - Centro, São Paulo/SP`,
}));

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const dataBR = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("pt-BR");

export const statusClass: Record<OSStatus, string> = {
  "Na Bancada": "bg-status-bench/15 text-status-bench",
  "Em Orçamento": "bg-status-quote/15 text-status-quote",
  "Aguardando Peça": "bg-muted text-muted-foreground",
  "Concluída": "bg-status-done/15 text-status-done",
  "Entregue": "bg-primary/10 text-primary",
};
