import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { clientes } from "@/lib/os-data";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes · TecnoFix OS" },
      { name: "description", content: "Cadastro de clientes da assistência técnica." },
      { property: "og:title", content: "Clientes · TecnoFix OS" },
      { property: "og:description", content: "Cadastro de clientes da assistência técnica." },
    ],
  }),
  component: Clientes,
});

function Clientes() {
  return (
    <>
      <PageHeader title="Clientes" subtitle={`${clientes.length} clientes cadastrados.`} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {clientes.map((c) => (
          <div key={c.nome} className="flex items-center gap-4 rounded-xl border bg-card p-5 shadow-card">
            <div className="grid size-11 place-items-center rounded-full bg-primary/10 font-display font-bold text-primary">
              {c.nome.split(" ").map((p) => p[0]).slice(0, 2).join("")}
            </div>
            <div>
              <p className="font-medium">{c.nome}</p>
              <p className="text-sm text-muted-foreground">{c.aparelhos} ordem(ns) de serviço</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
