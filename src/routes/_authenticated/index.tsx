import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Wrench, FileText, CheckCircle2, Wallet } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { OSTable } from "@/components/OSTable";
import { brl } from "@/lib/os-data";
import { ordensQuery } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Painel Geral · TecnoFix OS" },
      { name: "description", content: "Resumo das ordens de serviço da assistência técnica." },
      { property: "og:title", content: "Painel Geral · TecnoFix OS" },
      { property: "og:description", content: "Resumo das ordens de serviço da assistência técnica." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(ordensQuery),
  component: Painel,
});

function Painel() {
  const { data: ordens } = useSuspenseQuery(ordensQuery);
  const count = (s: string) => ordens.filter((o) => o.status === s).length;
  const mes = new Date().toISOString().slice(0, 7);
  const total = ordens.filter((o) => o.entrada.startsWith(mes)).reduce((a, o) => a + o.valor, 0);
  const cards = [
    { label: "Na Bancada", value: count("Na Bancada"), icon: Wrench, tone: "text-status-bench bg-status-bench/10" },
    { label: "Em Orçamento", value: count("Em Orçamento"), icon: FileText, tone: "text-status-quote bg-status-quote/10" },
    { label: "Concluídas", value: count("Concluída") + count("Finalizado"), icon: CheckCircle2, tone: "text-status-done bg-status-done/10" },
    { label: "Total do Mês", value: brl(total), icon: Wallet, tone: "text-primary bg-primary/10" },
  ];
  return (
    <>
      <PageHeader title="Painel Geral" subtitle="Acompanhe o andamento da sua assistência técnica." />
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border bg-card p-5 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">{c.label}</p>
              <span className={`grid size-9 place-items-center rounded-lg ${c.tone}`}><c.icon className="size-5" /></span>
            </div>
            <p className="mt-3 font-display text-3xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>
      <OSTable title="Ordens Recentes" limit={10} />
    </>
  );
}
