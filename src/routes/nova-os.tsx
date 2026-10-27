import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/nova-os")({
  head: () => ({
    meta: [
      { title: "Nova OS · TecnoFix OS" },
      { name: "description", content: "Abrir uma nova ordem de serviço." },
      { property: "og:title", content: "Nova OS · TecnoFix OS" },
      { property: "og:description", content: "Abrir uma nova ordem de serviço." },
    ],
  }),
  component: NovaOS,
});

const field = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

function NovaOS() {
  return (
    <>
      <PageHeader title="Nova OS" subtitle="Registre a entrada de um aparelho." />
      <form onSubmit={(e) => e.preventDefault()} className="grid max-w-3xl gap-5 rounded-xl border bg-card p-6 shadow-card sm:grid-cols-2">
        {[["Cliente", "Nome completo"], ["Telefone", "(00) 00000-0000"], ["Aparelho", "Marca e modelo"], ["Nº de série / IMEI", "Opcional"]].map(([l, p]) => (
          <label key={l} className="grid gap-1.5 text-sm font-medium">{l}<input placeholder={p} className={field} /></label>
        ))}
        <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">Defeito relatado
          <textarea rows={4} placeholder="Descreva o problema…" className={`${field} h-auto py-2`} />
        </label>
        <div className="sm:col-span-2">
          <button className="h-10 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">Abrir OS</button>
        </div>
      </form>
    </>
  );
}
