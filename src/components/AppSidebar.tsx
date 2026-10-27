import { Link } from "@tanstack/react-router";
import { LayoutDashboard, PlusCircle, ClipboardList, Users, Wrench } from "lucide-react";

const items = [
  { to: "/", label: "Painel Geral", icon: LayoutDashboard },
  { to: "/nova-os", label: "Nova OS", icon: PlusCircle },
  { to: "/ordens", label: "Ordens de Serviço", icon: ClipboardList },
  { to: "/clientes", label: "Clientes", icon: Users },
] as const;

export function AppSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-16 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:w-64">
      <div className="flex h-16 items-center gap-3 px-4 md:px-6">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Wrench className="size-5" />
        </div>
        <div className="hidden md:block">
          <p className="font-display text-sm font-bold leading-tight">TecnoFix</p>
          <p className="text-xs text-sidebar-foreground/60">Assistência Técnica</p>
        </div>
      </div>
      <nav className="mt-4 flex flex-col gap-1 px-2 md:px-3">
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
      <div className="mt-auto hidden p-6 text-xs text-sidebar-foreground/50 md:block">v1.0 · 2026</div>
    </aside>
  );
}
