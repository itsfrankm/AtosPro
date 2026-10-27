import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { OSTable } from "@/components/OSTable";

export const Route = createFileRoute("/_authenticated/ordens")({
  head: () => ({
    meta: [
      { title: "Ordens de Serviço · TecnoFix OS" },
      { name: "description", content: "Lista completa das ordens de serviço." },
      { property: "og:title", content: "Ordens de Serviço · TecnoFix OS" },
      { property: "og:description", content: "Lista completa das ordens de serviço." },
    ],
  }),
  component: () => (
    <>
      <PageHeader title="Ordens de Serviço" subtitle="Todas as ordens registradas." />
      <OSTable title="Todas as ordens" />
    </>
  ),
});
