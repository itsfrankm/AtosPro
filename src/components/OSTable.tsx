import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { ordensQuery } from "@/lib/db";
import { brl, dataBR, statusClass } from "@/lib/os-data";

export function OSTable({ title, limit }: { title: string; limit?: number }) {
  const { data: ordens } = useSuspenseQuery(ordensQuery);
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const base = t ? ordens.filter((o) => [o.numero, o.cliente, o.aparelho].some((f) => f.toLowerCase().includes(t))) : ordens;
    return limit ? base.slice(0, limit) : base;
  }, [q, ordens, limit]);

  return (
    <section className="rounded-xl border bg-card shadow-card">
      <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por OS, cliente ou aparelho…"
            className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {["Nº OS", "Cliente", "Aparelho", "Defeito", "Status", "Entrada", "Valor"].map((h) => (
                <th key={h} className="px-5 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((o) => (
              <tr key={o.id} className="border-t transition-colors hover:bg-muted/40">
                <td className="px-5 py-3 font-mono font-semibold text-primary">
                  <Link to="/nova-os" search={{ os: o.numero }} className="hover:underline">{o.numero}</Link>
                </td>
                <td className="px-5 py-3 font-medium">{o.cliente}</td>
                <td className="px-5 py-3">{o.aparelho}</td>
                <td className="max-w-64 truncate px-5 py-3 text-muted-foreground">{o.defeito || "—"}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[o.status] ?? ""}`}>{o.status}</span>
                </td>
                <td className="px-5 py-3 text-muted-foreground">{dataBR(o.entrada)}</td>
                <td className="px-5 py-3 font-medium">{o.valor ? brl(o.valor) : "—"}</td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">Nenhuma ordem encontrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
