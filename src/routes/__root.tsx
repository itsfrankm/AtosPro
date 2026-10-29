import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useLocation,
  useNavigate,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppSidebar } from "@/components/AppSidebar";
import { Toaster } from "@/components/ui/sonner";
import { useEstoque, aparenciaInicial, aplicarAparenciaNoDOM } from "@/lib/estoque";
import {
  useAuth,
  registrarAtividadeSessao,
  verificarExpiracaoSessaoPorInatividade,
} from "@/lib/auth";
import { PaginaLogin } from "@/components/PaginaLogin";
import { toast } from "sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "AtosPro" },
      { property: "og:title", content: "AtosPro" },
      { name: "description", content: "Sistema de Ordem de Serviço para Assistência Técnica" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&family=Figtree:wght@400;500;600&display=swap" },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "shortcut icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { aparencia = aparenciaInicial } = useEstoque();
  const { usuarioAtual } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const sessaoAtivaValida = Boolean(usuarioAtual && usuarioAtual.ativo);

  // Mantém a URL sempre fixa na raiz "/" e document.title "AtosPro", preservando a aba ativa no sessionStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/");
      if (sessaoAtivaValida && location.pathname !== "/login") {
        try {
          const fullRoute = location.pathname + (location.searchStr ? `?${location.searchStr}` : "");
          window.sessionStorage.setItem("atospro_active_route", fullRoute);
        } catch {
          // ignora storage restrito
        }
      }
    }
    if (typeof document !== "undefined" && document.title !== "AtosPro") {
      document.title = "AtosPro";
    }
  }, [location.pathname, location.searchStr, location.hash, sessaoAtivaValida]);

  useEffect(() => {
    aplicarAparenciaNoDOM(aparencia);
  }, [aparencia]);

  useEffect(() => {
    if (isMounted && !sessaoAtivaValida && location.pathname !== "/login") {
      navigate({ to: "/login" });
    }
  }, [isMounted, sessaoAtivaValida, location.pathname, navigate]);

  // Expiração automática de sessão após 30 minutos de inatividade
  useEffect(() => {
    if (!sessaoAtivaValida) return;

    registrarAtividadeSessao();

    const aoInteragir = () => {
      registrarAtividadeSessao();
    };

    const eventos: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "click",
    ];
    for (const ev of eventos) {
      window.addEventListener(ev, aoInteragir, { passive: true });
    }

    const verificador = window.setInterval(() => {
      if (verificarExpiracaoSessaoPorInatividade()) {
        toast.warning("Sua sessão expirou após 30 minutos de inatividade. Faça login novamente.");
        navigate({ to: "/login" });
      }
    }, 15_000);

    return () => {
      for (const ev of eventos) {
        window.removeEventListener(ev, aoInteragir);
      }
      window.clearInterval(verificador);
    };
  }, [sessaoAtivaValida, navigate]);

  // Durante a primeira renderização do SSR e antes da hidratação no cliente, exibe indicador neutro para evitar Hydration Mismatch
  if (!isMounted) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
        <Toaster richColors />
      </QueryClientProvider>
    );
  }

  // Se não houver login ativo e habilitado, exibe exclusivamente a página de Login
  if (!sessaoAtivaValida || location.pathname === "/login") {
    return (
      <QueryClientProvider client={queryClient}>
        <PaginaLogin />
        <Toaster richColors />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AppSidebar />
      <main className="min-h-screen pl-16 md:pl-64">
        <div className="mx-auto max-w-7xl p-6 md:p-10">
          <Outlet />
          <Toaster richColors />
        </div>
      </main>
    </QueryClientProvider>
  );
}
