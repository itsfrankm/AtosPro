import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Pencil, Search } from "lucide-react";
import { useOrdens, brl, dataBR, statusClass } from "@/lib/os-data";
import { useDebouncedValue, normalizarBuscaSegura, escaparBuscaIlike } from "@/lib/security";

export function OSTable({ title }: { title: string }) {
  const ordens = useOrdens();
  const [q, setQ] = useState("");
  const qDebounced = useDebouncedValue(q, 300);

  const list = useMemo(() => {
    const t = normalizarBuscaSegura(escaparBuscaIlike(qDebounced));
    if (!t) return ordens;
    return ordens.filter((o) =>
      [o.numero, o.cliente, o.aparelho].some((f) => f.toLowerCase().includes(t)),
    );
  }, [qDebounced, ordens]);

  return (
    <section className="rounded-xl border bg-card shadow-card">
      <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={120}
            placeholder="Buscar por OS, cliente ou aparelho…"
            className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {["Nº OS", "Cliente", "Aparelho", "Defeito", "Status", "Entrada", "Valor", ""].map((h) => (
                <th key={h} className="px-5 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((o) => (
              <tr key={o.numero} className="border-t transition-colors hover:bg-muted/40">
                <td className="px-5 py-3 font-mono font-semibold text-primary">
                  <Link to="/nova-os" search={{ os: o.numero }} className="hover:underline">
                    {o.numero}
                  </Link>
                </td>
                <td className="px-5 py-3 font-medium">{o.cliente}</td>
                <td className="px-5 py-3">{o.aparelho}</td>
                <td className="px-5 py-3 text-muted-foreground">{o.defeito}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[o.status]}`}>{o.status}</span>
                </td>
                <td className="px-5 py-3 text-muted-foreground">{dataBR(o.entrada)}</td>
                <td className="px-5 py-3 font-medium">{o.valor ? brl(o.valor) : "—"}</td>
                <td className="px-5 py-3 text-right">
                  <Link
                    to="/nova-os"
                    search={{ os: o.numero }}
                    className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Pencil className="size-3" /> Editar
                  </Link>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">Nenhuma ordem encontrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
