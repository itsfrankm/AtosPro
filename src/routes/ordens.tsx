import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { OSTable } from "@/components/OSTable";

export const Route = createFileRoute("/ordens")({
  head: () => ({
    meta: [
      { title: "AtosPro" },
      { name: "description", content: "Lista completa das ordens de serviço." },
      { property: "og:title", content: "AtosPro" },
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
