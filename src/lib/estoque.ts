import { useSyncExternalStore } from "react";

export interface Produto { id: string; nome: string; sku: string; quantidade: number; custo: number; venda: number }
export interface Fornecedor { id: string; nome: string; cnpj: string; telefone: string; endereco: string }
export interface ItemNota { produtoId: string; quantidade: number; valorUnit: number }
export interface NotaCompra { id: string; fornecedorId: string; data: string; numero: string; itens: ItemNota[]; total: number }
export interface ItemVenda { produtoId: string; nome: string; quantidade: number; preco: number }
export interface Venda { id: string; numero: number; dataHora: string; itens: ItemVenda[]; subtotal: number; desconto: number; arredondamento: number; total: number }

export interface Estado { produtos: Produto[]; fornecedores: Fornecedor[]; notas: NotaCompra[]; vendas: Venda[] }

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/** Lucro unitário = venda - custo */
export const lucroUnit = (custo: number, venda: number) => venda - custo;
/** % de lucro = ((venda - custo) / custo) * 100; null quando custo é zero */
export const lucroPct = (custo: number, venda: number) => (custo > 0 ? ((venda - custo) / custo) * 100 : null);

export const somaItens = (itens: { quantidade: number; valorUnit?: number; preco?: number }[]) =>
  itens.reduce((s, i) => s + i.quantidade * (i.valorUnit ?? i.preco ?? 0), 0);

/** Aplica nota de compra: soma quantidades e atualiza custo para o valor unitário pago. */
export function aplicarCompra(produtos: Produto[], itens: ItemNota[]): Produto[] {
  return produtos.map((p) => {
    const its = itens.filter((i) => i.produtoId === p.id);
    if (!its.length) return p;
    return { ...p, quantidade: p.quantidade + its.reduce((s, i) => s + i.quantidade, 0), custo: its[its.length - 1]!.valorUnit };
  });
}

/** Dá baixa no estoque pelos itens vendidos. */
export function aplicarVenda(produtos: Produto[], itens: { produtoId: string; quantidade: number }[]): Produto[] {
  return produtos.map((p) => {
    const q = itens.filter((i) => i.produtoId === p.id).reduce((s, i) => s + i.quantidade, 0);
    return q ? { ...p, quantidade: p.quantidade - q } : p;
  });
}

/** Total final da venda: subtotal - desconto (R$ ou %), opcionalmente substituído por valor arredondado. */
export function calcTotal(subtotal: number, desconto: number, tipo: "R$" | "%", finalManual: number | null) {
  const d = Math.min(subtotal, Math.max(0, tipo === "%" ? (subtotal * desconto) / 100 : desconto));
  const comDesconto = +(subtotal - d).toFixed(2);
  const total = finalManual != null && finalManual >= 0 ? finalManual : comDesconto;
  return { desconto: +d.toFixed(2), comDesconto, arredondamento: +(total - comDesconto).toFixed(2), total: +total.toFixed(2) };
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

const KEY = "tecnofix-estoque-v1";
const inicial: Estado = {
  produtos: [
    { id: "p1", nome: "Tela iPhone 11", sku: "TL-IP11", quantidade: 6, custo: 180, venda: 350 },
    { id: "p2", nome: "Bateria Samsung A32", sku: "BT-A32", quantidade: 12, custo: 45, venda: 110 },
    { id: "p3", nome: "Conector de carga USB-C", sku: "CN-USBC", quantidade: 30, custo: 8, venda: 40 },
    { id: "p4", nome: "Película de vidro 3D", sku: "PL-3D", quantidade: 50, custo: 3.5, venda: 25 },
    { id: "p5", nome: "Cabo Lightning 1m", sku: "", quantidade: 20, custo: 12, venda: 39.9 },
  ],
  fornecedores: [
    { id: "f1", nome: "Distribuidora Peças Cell Ltda", cnpj: "12.345.678/0001-90", telefone: "(11) 3333-4444", endereco: "Rua Santa Ifigênia, 500 - Centro, São Paulo/SP" },
  ],
  notas: [],
  vendas: [],
};

let estado: Estado = inicial;
let carregado = false;
const ouvintes = new Set<() => void>();

function carregar() {
  if (carregado || typeof window === "undefined") return;
  carregado = true;
  try { const s = localStorage.getItem(KEY); if (s) estado = JSON.parse(s); } catch { /* ignora */ }
}

export function setEstado(fn: (e: Estado) => Estado) {
  carregar();
  estado = fn(estado);
  try { localStorage.setItem(KEY, JSON.stringify(estado)); } catch { /* ignora */ }
  ouvintes.forEach((l) => l());
}

export function useEstoque(): Estado {
  return useSyncExternalStore(
    (l) => { ouvintes.add(l); return () => ouvintes.delete(l); },
    () => { carregar(); return estado; },
    () => inicial,
  );
}
