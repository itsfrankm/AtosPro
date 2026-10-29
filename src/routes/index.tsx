import { createFileRoute } from "@tanstack/react-router";
import { Wrench, FileText, CheckCircle2, Wallet } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { OSTable } from "@/components/OSTable";
import { useOrdens, isOSCancelada, isOSFinalizada, brl } from "@/lib/os-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AtosPro" },
      { name: "description", content: "Resumo das ordens de serviço da assistência técnica." },
      { property: "og:title", content: "AtosPro" },
      { property: "og:description", content: "Resumo das ordens de serviço da assistência técnica." },
    ],
  }),
  component: Painel,
});

function Painel() {
  const ordens = useOrdens();
  const hoje = new Date();
  const anoMesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

  const count = (s: string) => ordens.filter((o) => o.status === s).length;
  const concluidasCount = ordens.filter((o) => isOSFinalizada(o.status) && !isOSCancelada(o.status)).length;

  const totalMes = ordens
    .filter((o) => {
      const dataRef = (o.finalizacao && o.finalizacao.trim() ? o.finalizacao : o.entrada).slice(0, 7);
      return dataRef === anoMesAtual && isOSFinalizada(o.status) && !isOSCancelada(o.status);
    })
    .reduce((a, o) => a + (o.valor || 0), 0);

  const cards = [
    { label: "Na Bancada", value: count("Na Bancada"), icon: Wrench, tone: "text-status-bench bg-status-bench/10" },
    { label: "Em Orçamento", value: count("Em Orçamento"), icon: FileText, tone: "text-status-quote bg-status-quote/10" },
    { label: "Concluídas", value: concluidasCount, icon: CheckCircle2, tone: "text-status-done bg-status-done/10" },
    { label: "Total do Mês", value: brl(totalMes), icon: Wallet, tone: "text-primary bg-primary/10" },
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
      <OSTable title="Ordens Recentes" />
    </>
  );
}
