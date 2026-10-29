import { createFileRoute } from "@tanstack/react-router";
import { Palette, Sun, Moon, Check, Sparkles, Printer } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  useEstoque,
  setEstado,
  PALETAS_CORES,
  aparenciaInicial,
  type PaletaId,
  type ModoTema,
} from "@/lib/estoque";

export const Route = createFileRoute("/personalizacao")({
  head: () => ({
    meta: [
      { title: "AtosPro" },
      {
        name: "description",
        content: "Personalize a paleta de cores principal e alterne entre Modo Claro (Light Mode) e Modo Escuro (Dark Mode).",
      },
      { property: "og:title", content: "AtosPro" },
      {
        property: "og:description",
        content: "Personalize a paleta de cores principal e alterne entre Modo Claro (Light Mode) e Modo Escuro (Dark Mode).",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaginaPersonalizacao,
});

function PaginaPersonalizacao() {
  const { aparencia = aparenciaInicial } = useEstoque();
  const isDark = aparencia.modo === "dark";

  const selecionarPaleta = (paleta: PaletaId, nome: string) => {
    setEstado((est) => ({
      ...est,
      aparencia: {
        ...(est.aparencia ?? aparenciaInicial),
        paleta,
      },
    }));
    toast.success(`Paleta "${nome}" aplicada em todo o sistema!`);
  };

  const alterarModo = (modo: ModoTema) => {
    setEstado((est) => ({
      ...est,
      aparencia: {
        ...(est.aparencia ?? aparenciaInicial),
        modo,
      },
    }));
    toast.success(
      modo === "dark"
        ? "Modo Escuro (Dark Mode) ativado e salvo."
        : "Modo Claro (Light Mode) ativado e salvo.",
    );
  };

  const paletaAtiva =
    PALETAS_CORES.find((p) => p.id === aparencia.paleta) ?? PALETAS_CORES[2]!;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Personalização"
        subtitle="Customize a aparência visual do sistema: escolha a paleta de cores principal e alterne entre Modo Claro e Modo Escuro."
      />

      {/* SEÇÃO 1: MODO CLARO (LIGHT MODE) VS MODO ESCURO (DARK MODE) */}
      <section className="rounded-xl border bg-card p-6 shadow-card">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              {isDark ? (
                <Moon className="size-5 text-primary" />
              ) : (
                <Sun className="size-5 text-primary" />
              )}
              <h2 className="font-display text-lg font-semibold">
                Tema de Iluminação da Tela
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Alterne entre <strong>Modo Claro (Light Mode)</strong> e{" "}
              <strong>Modo Escuro (Dark Mode)</strong>. Sua preferência fica salva automaticamente.
            </p>
          </div>

          {/* CHAVE SELETORA DE DESTAQUE */}
          <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-muted/40 px-5 py-3.5">
            <button
              type="button"
              onClick={() => alterarModo("light")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all ${
                !isDark
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sun className="size-4" />
              Modo Claro (Light Mode)
            </button>

            <div className="flex items-center gap-2 px-1">
              <Switch
                id="toggle-dark-mode"
                checked={isDark}
                onCheckedChange={(checked) => alterarModo(checked ? "dark" : "light")}
                aria-label="Alternar entre Modo Claro e Modo Escuro"
              />
              <Label htmlFor="toggle-dark-mode" className="sr-only">
                Alternar Modo Escuro
              </Label>
            </div>

            <button
              type="button"
              onClick={() => alterarModo("dark")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all ${
                isDark
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Moon className="size-4" />
              Modo Escuro (Dark Mode)
            </button>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2.5 rounded-lg border bg-accent/40 px-4 py-3 text-xs text-accent-foreground">
          <Printer className="size-4 shrink-0 text-primary" />
          <span>
            <strong>Garantia de Impressão e PDF:</strong> mesmo com o{" "}
            <strong>Modo Escuro (Dark Mode)</strong> ativado na tela, a impressão e o PDF da{" "}
            <strong>Ordem de Serviço A4</strong> e do <strong>Cupom Térmico 80mm</strong> sempre saem com{" "}
            <strong>fundo branco e texto preto</strong>.
          </span>
        </div>
      </section>

      {/* SEÇÃO 2: SELETOR DE PALETA DE CORES PRINCIPAL */}
      <section className="rounded-xl border bg-card p-6 shadow-card">
        <div className="mb-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Palette className="size-5 text-primary" />
            Paleta de Cores Principal
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Escolha a cor principal do sistema. Ela é aplicada instantaneamente em todos os botões principais, menus ativos, destaques e gráficos.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {PALETAS_CORES.map((p) => {
            const selecionada = aparencia.paleta === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => selecionarPaleta(p.id, p.nome)}
                className={`group relative flex flex-col justify-between rounded-xl border-2 p-5 text-left transition-all hover:shadow-md ${
                  selecionada
                    ? "border-primary bg-primary/5 ring-2 ring-primary/25"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <div>
                  {/* Amostras Visuais de Cor */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-9 rounded-lg shadow-sm ring-1 ring-black/10"
                        style={{ backgroundColor: p.swatchHex }}
                      />
                      <span
                        className="size-6 rounded-md shadow-sm ring-1 ring-black/10"
                        style={{ backgroundColor: p.swatchSecundariaHex }}
                      />
                    </div>
                    {selecionada && (
                      <span
                        className="grid size-6 place-items-center rounded-full text-white shadow-sm"
                        style={{ backgroundColor: p.swatchHex }}
                      >
                        <Check className="size-3.5" />
                      </span>
                    )}
                  </div>

                  <h3 className="mt-4 font-display text-base font-bold text-foreground">
                    {p.nome}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {p.descricao}
                  </p>
                </div>

                {/* Mini Prévia Visual (Botão + Barras de Gráfico) */}
                <div className="mt-5 space-y-2 border-t pt-3">
                  <div className="flex items-end gap-1.5 h-6">
                    <span
                      className="w-3 rounded-t"
                      style={{ height: "55%", backgroundColor: p.swatchHex }}
                    />
                    <span
                      className="w-3 rounded-t"
                      style={{ height: "85%", backgroundColor: p.swatchSecundariaHex }}
                    />
                    <span
                      className="w-3 rounded-t"
                      style={{ height: "100%", backgroundColor: p.swatchHex }}
                    />
                    <span
                      className="w-3 rounded-t"
                      style={{ height: "70%", backgroundColor: p.swatchSecundariaHex }}
                    />
                    <span className="ml-auto text-[11px] font-semibold text-muted-foreground">
                      {selecionada ? "Ativa" : "Aplicar"}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* SEÇÃO 3: PRÉ-VISUALIZAÇÃO AO VIVO DOS ELEMENTOS DO SISTEMA */}
      <section className="rounded-xl border bg-card p-6 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">
            Pré-visualização da Aparência Ativa ({paletaAtiva.nome} ·{" "}
            {isDark ? "Modo Escuro" : "Modo Claro"})
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Botões e Ações Principais
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm">Botão Principal</Button>
              <Button size="sm" variant="secondary">
                Secundário
              </Button>
              <Button size="sm" variant="outline">
                Contorno
              </Button>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Destaques e Badges
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                Destaque Principal
              </span>
              <span className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
                Fundo de Realce
              </span>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Cores dos Gráficos do Sistema
            </p>
            <div className="flex items-end gap-2 h-10 pt-1">
              <div className="h-5 w-6 rounded-t bg-primary" />
              <div className="h-8 w-6 rounded-t bg-primary/80" />
              <div className="h-10 w-6 rounded-t bg-primary" />
              <div className="h-7 w-6 rounded-t bg-primary/70" />
              <span className="ml-2 text-xs text-muted-foreground">
                Sincronizado com Financeiro
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

