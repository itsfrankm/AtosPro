import { createFileRoute } from "@tanstack/react-router";
import { PaginaLogin } from "@/components/PaginaLogin";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "AtosPro" },
      { name: "description", content: "Acesso restrito ao sistema AtosPro." },
      { property: "og:title", content: "AtosPro" },
      { property: "og:description", content: "Acesso restrito ao sistema AtosPro." },
    ],
  }),
  component: PaginaLogin,
});
