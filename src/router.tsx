import { QueryClient } from "@tanstack/react-query";
import { createRouter, createMemoryHistory } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

function obterRotaInicial(): string {
  if (typeof window === "undefined") return "/";
  try {
    const salva = window.sessionStorage.getItem("atospro_active_route");
    if (salva && salva.startsWith("/")) return salva;
  } catch {
    // ignora
  }
  return "/";
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  if (typeof window !== "undefined") {
    window.history.replaceState(null, "", "/");
    document.title = "AtosPro";
  }

  const rotaInicial = obterRotaInicial();

  const memoryHistory =
    typeof window !== "undefined"
      ? createMemoryHistory({
          initialEntries: [rotaInicial],
        })
      : undefined;

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    ...(memoryHistory ? { history: memoryHistory } : {}),
  });

  return router;
};
