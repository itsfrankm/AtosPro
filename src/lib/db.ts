import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { formatNumero, type Cliente, type OrdemServico, type OSStatus } from "@/lib/os-data";

type CustomerRow = Tables<"customers">;
type OrderRow = Tables<"service_orders">;

export const toCliente = (r: CustomerRow): Cliente => ({
  id: r.id, nome: r.name, documento: r.document, whatsapp: r.whatsapp, email: r.email, cep: r.cep, endereco: r.address,
});

const fromCliente = (c: Omit<Cliente, "id">) => ({
  name: c.nome, document: c.documento, whatsapp: c.whatsapp, email: c.email, cep: c.cep, address: c.endereco,
});

export const clientesQuery = queryOptions({
  queryKey: ["customers"],
  queryFn: async () => {
    const { data, error } = await supabase.from("customers").select("*").order("name");
    if (error) throw error;
    return data.map(toCliente);
  },
});

export async function salvarCliente(c: Omit<Cliente, "id"> & { id?: string }) {
  const q = c.id
    ? supabase.from("customers").update(fromCliente(c)).eq("id", c.id).select().single()
    : supabase.from("customers").insert(fromCliente(c)).select().single();
  const { data, error } = await q;
  if (error) throw error;
  return toCliente(data);
}

export const ordensQuery = queryOptions({
  queryKey: ["service_orders"],
  queryFn: async (): Promise<OrdemServico[]> => {
    const { data, error } = await supabase
      .from("service_orders")
      .select("id, number, customer_id, brand_model, equipment, reported_defect, status, entry_date, amount, customers(name)")
      .order("number", { ascending: false });
    if (error) throw error;
    return data.map((r) => ({
      id: r.id,
      numero: formatNumero(r.number),
      clienteId: r.customer_id,
      cliente: r.customers?.name ?? "—",
      aparelho: [r.equipment, r.brand_model].filter(Boolean).join(" · ") || "—",
      defeito: r.reported_defect,
      status: r.status as OSStatus,
      entrada: r.entry_date,
      valor: Number(r.amount),
    }));
  },
});

export const ordemQuery = (numero: number) =>
  queryOptions({
    queryKey: ["service_orders", numero],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_orders").select("*, customers(*)").eq("number", numero).maybeSingle();
      if (error) throw error;
      return data as (OrderRow & { customers: CustomerRow | null }) | null;
    },
  });

export type OrdemInput = Omit<TablesInsert<"service_orders">, "id" | "number" | "created_at" | "updated_at">;

export async function salvarOrdem(input: OrdemInput, id?: string) {
  const q = id
    ? supabase.from("service_orders").update(input).eq("id", id).select("id, number").single()
    : supabase.from("service_orders").insert(input).select("id, number").single();
  const { data, error } = await q;
  if (error) throw error;
  return data;
}
