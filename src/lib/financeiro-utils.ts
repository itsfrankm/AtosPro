export type Periodo = "diario" | "semanal" | "mensal" | "anual";

export const MESES_NOMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export const MESES_CURTOS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

export const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function dataLocalISO(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseISO(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y || 2026, (m || 1) - 1, d || 1, 12, 0, 0);
}

export function dentroDoPeriodo(ymd: string, periodo: Periodo, refFiltro: string): boolean {
  if (!ymd) return false;
  if (periodo === "diario") {
    return ymd.slice(0, 10) === refFiltro.slice(0, 10);
  }
  if (periodo === "anual") {
    return ymd.slice(0, 4) === refFiltro.slice(0, 4);
  }
  if (periodo === "mensal") {
    return ymd.slice(0, 7) === refFiltro.slice(0, 7);
  }
  const refDate = parseISO(refFiltro.slice(0, 10));
  const itemDate = parseISO(ymd.slice(0, 10));
  const diffDays = Math.round((refDate.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= 6;
}
