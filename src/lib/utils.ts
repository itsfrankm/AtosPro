import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function num(valor: string | number): number {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  if (!valor) return 0;
  const n = parseFloat(String(valor).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
