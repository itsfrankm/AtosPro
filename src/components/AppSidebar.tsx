import { Link, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  PlusCircle,
  ClipboardList,
  Users,
  Wrench,
  Package,
  Truck,
  ShoppingCart,
  Wallet,
  DollarSign,
  Building2,
  Palette,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { useEstoque, perfilInicial } from "@/lib/estoque";
import { useAuth, realizarLogout } from "@/lib/auth";
import { toast } from "sonner";

const baseItems = [
  { to: "/", label: "Painel Geral", icon: LayoutDashboard },
  { to: "/nova-os", label: "Nova OS", icon: PlusCircle },
  { to: "/ordens", label: "Ordens de Serviço", icon: ClipboardList },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/estoque", label: "Estoque", icon: Package },
  { to: "/fornecedores", label: "Fornecedores", icon: Truck },
  { to: "/vendas", label: "Vendas", icon: ShoppingCart },
  { to: "/caixa", label: "Caixa", icon: Wallet },
  { to: "/financeiro", label: "Financeiro", icon: DollarSign },
  { to: "/perfil", label: "Perfil da Empresa", icon: Building2 },
  { to: "/personalizacao", label: "Personalização", icon: Palette },
] as const;

export function AppSidebar() {
  const { perfil = perfilInicial } = useEstoque();
  const { usuarioAtual } = useAuth();
  const navigate = useNavigate();

  const isAdmin = usuarioAtual?.role === "admin";

  const items = isAdmin
    ? [
        ...baseItems,
        { to: "/gerenciar-logins" as const, label: "Gerenciar Logins", icon: ShieldCheck },
      ]
    : baseItems;

  function handleSair() {
    realizarLogout();
    toast.info("Sessão encerrada.");
    navigate({ to: "/login" });
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-16 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:w-64">
      <div className="flex h-16 items-center gap-3 px-4 md:px-6">
        {perfil.logo ? (
          <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-white p-0.5 shadow-sm">
            <img
              src={perfil.logo}
              alt={perfil.nome || "Logo"}
              className="h-full w-full object-contain"
            />
          </div>
        ) : (
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Wrench className="size-5" />
          </div>
        )}
        <div className="hidden min-w-0 md:block">
          <p className="truncate font-display text-sm font-bold leading-tight">
            {perfil.nome || "AtosPro"}
          </p>
          <p className="truncate text-xs text-sidebar-foreground/60">Assistência Técnica</p>
        </div>
      </div>

      <nav className="mt-4 flex flex-1 flex-col gap-1 overflow-y-auto px-2 md:px-3">
        {items.map((i) => (
          <Link
            key={i.to}
            to={i.to}
            activeOptions={{ exact: true }}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            activeProps={{ className: "!bg-sidebar-primary !text-sidebar-primary-foreground" }}
          >
            <i.icon className="size-5 shrink-0" />
            <span className="hidden md:inline">{i.label}</span>
          </Link>
        ))}
      </nav>

      <div className="mt-auto border-t border-sidebar-border p-3 md:p-4">
        {usuarioAtual && (
          <div className="mb-2 hidden rounded-lg bg-sidebar-accent/40 px-3 py-2 md:block">
            <p className="truncate text-xs font-semibold text-sidebar-foreground">
              {usuarioAtual.nome}
            </p>
            <p className="truncate text-[11px] text-sidebar-foreground/60">
              {usuarioAtual.role === "admin" ? "Administrador" : "Usuário"} · {usuarioAtual.email}
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={handleSair}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-sidebar-foreground/70 transition-colors hover:bg-destructive/15 hover:text-destructive md:justify-start"
          title="Sair da conta"
        >
          <LogOut className="size-4 shrink-0" />
          <span className="hidden md:inline">Sair da Conta</span>
        </button>
      </div>
    </aside>
  );
}
