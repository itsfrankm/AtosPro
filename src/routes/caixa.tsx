import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  PlusCircle,
  MinusCircle,
  Search,
  Trash2,
  History,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { num } from "@/lib/utils";
import { brl } from "@/lib/os-data";
import {
  useEstoque,
  setEstado,
  uid,
  type MovimentacaoCaixa,
  type TipoMovimentacaoCaixa,
} from "@/lib/estoque";
import {
  useDebouncedValue,
  escaparBuscaIlike,
  normalizarBuscaSegura,
  movimentacaoCaixaSchema,
  verificarRateLimit,
} from "@/lib/security";
import { getTenantUserId } from "@/lib/auth";

export const Route = createFileRoute("/caixa")({
  head: () => ({
    meta: [
      { title: "AtosPro" },
      {
        name: "description",
        content: "Gerenciamento de movimentações físicas de dinheiro do caixa (entradas/suprimentos e retiradas/sangrias).",
      },
      { property: "og:title", content: "AtosPro" },
      {
        property: "og:description",
        content: "Gerenciamento de movimentações físicas de dinheiro do caixa (entradas/suprimentos e retiradas/sangrias).",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaginaCaixa,
});

function agoraDateTimeLocal(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function formatarDataHoraBR(isoOrLocal: string): string {
  if (!isoOrLocal) return "—";
  const d = new Date(isoOrLocal);
  if (Number.isNaN(d.getTime())) {
    return isoOrLocal;
  }
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function PaginaCaixa() {
  const { caixa = [] } = useEstoque();

  const [modalAberto, setModalAberto] = useState(false);
  const [tipoModal, setTipoModal] = useState<TipoMovimentacaoCaixa>("entrada");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataHora, setDataHora] = useState(agoraDateTimeLocal());

  const [busca, setBusca] = useState("");
  const buscaDebounced = useDebouncedValue(busca, 300);
  const [filtroTipo, setFiltroTipo] = useState<"todos" | TipoMovimentacaoCaixa>("todos");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totais = useMemo(() => {
    const totalColocado = caixa
      .filter((m) => m.tipo === "entrada")
      .reduce((acc, m) => acc + m.valor, 0);
    const totalRetirado = caixa
      .filter((m) => m.tipo === "saida")
      .reduce((acc, m) => acc + m.valor, 0);
    const saldoFisico = totalColocado - totalRetirado;
    return {
      totalColocado: +totalColocado.toFixed(2),
      totalRetirado: +totalRetirado.toFixed(2),
      saldoFisico: +saldoFisico.toFixed(2),
    };
  }, [caixa]);

  const historicoOrdenado = useMemo(() => {
    const t = normalizarBuscaSegura(escaparBuscaIlike(buscaDebounced));
    return [...caixa]
      .sort((a, b) => b.dataHora.localeCompare(a.dataHora))
      .filter((m) => {
        if (filtroTipo !== "todos" && m.tipo !== filtroTipo) return false;
        if (!t) return true;
        return m.descricao.toLowerCase().includes(t);
      });
  }, [caixa, buscaDebounced, filtroTipo]);

  const abrirModal = (tipo: TipoMovimentacaoCaixa) => {
    setTipoModal(tipo);
    setValor("");
    setDescricao("");
    setDataHora(agoraDateTimeLocal());
    setModalAberto(true);
  };

  const registrarMovimentacao = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const rate = verificarRateLimit("caixa", getTenantUserId());
    if (!rate.permitido) {
      toast.error(rate.erro);
      return;
    }

    const val = num(valor);
    const dataIso = dataHora
      ? new Date(dataHora).toISOString()
      : new Date().toISOString();

    const validacao = movimentacaoCaixaSchema.safeParse({
      tipo: tipoModal,
      valor: +val.toFixed(2),
      descricao,
      dataHora: dataIso,
    });

    if (!validacao.success) {
      toast.error(validacao.error.issues[0]?.message ?? "Verifique os dados da movimentação.");
      return;
    }

    setIsSubmitting(true);
    try {
      const nova: MovimentacaoCaixa = {
        id: uid(),
        tipo: validacao.data.tipo,
        valor: validacao.data.valor,
        descricao: validacao.data.descricao,
        dataHora: validacao.data.dataHora,
      };

      setEstado((est) => ({
        ...est,
        caixa: [nova, ...(est.caixa ?? [])],
      }));

      toast.success(
        tipoModal === "entrada"
          ? `Entrada de ${brl(nova.valor)} registrada no Caixa e vinculada ao Financeiro.`
          : `Retirada de ${brl(nova.valor)} registrada no Caixa e vinculada ao Financeiro.`,
      );
      setModalAberto(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const removerMovimentacao = (id: string) => {
    setEstado((est) => ({
      ...est,
      caixa: (est.caixa ?? []).filter((m) => m.id !== id),
    }));
    toast.success("Movimentação removida do histórico.");
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Caixa"
          subtitle="Gerencie as movimentações físicas de dinheiro (suprimentos e sangrias) vinculadas em tempo real ao módulo Financeiro."
        />
        <Link
          to="/financeiro"
          className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3.5 py-2 text-xs font-medium text-primary shadow-sm transition-colors hover:bg-accent"
        >
          <span>Financeiro</span>
          <ExternalLink className="size-3.5" />
        </Link>
      </div>

      {/* TOPO: 3 CARDS DE RESUMO DO CAIXA */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-6 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Saldo Físico em Caixa (R$)</p>
            <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <Wallet className="size-5" />
            </span>
          </div>
          <p
            className={`mt-3 font-display text-3xl font-bold ${
              totais.saldoFisico < 0 ? "text-destructive" : "text-primary"
            }`}
          >
            {brl(totais.saldoFisico)}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Saldo líquido físico disponível na gaveta (Entradas − Saídas)
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Total Colocado (Entradas)</p>
            <span className="grid size-10 place-items-center rounded-lg bg-status-done/15 text-status-done">
              <ArrowUpCircle className="size-5" />
            </span>
          </div>
          <p className="mt-3 font-display text-3xl font-bold text-status-done">
            {brl(totais.totalColocado)}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Soma de todos os suprimentos e aportes colocados no caixa
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Total Retirado (Saídas)</p>
            <span className="grid size-10 place-items-center rounded-lg bg-destructive/10 text-destructive">
              <ArrowDownCircle className="size-5" />
            </span>
          </div>
          <p className="mt-3 font-display text-3xl font-bold text-destructive">
            {brl(totais.totalRetirado)}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Soma de todas as retiradas e sangrias efetuadas no caixa
          </p>
        </div>
      </div>

      {/* DOIS BOTÕES DE DESTAQUE PARA MOVIMENTAÇÃO */}
      <section className="rounded-xl border bg-card p-6 shadow-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">Operações Rápidas de Caixa</h2>
            <p className="text-sm text-muted-foreground">
              Registre entradas (suprimento/troco) ou saídas (retirada/sangria). Cada lançamento atualiza automaticamente o item <strong>"Caixa"</strong> no Financeiro.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              size="lg"
              className="bg-status-done text-white hover:bg-status-done/90"
              onClick={() => abrirModal("entrada")}
            >
              <PlusCircle className="mr-2 size-5" />
              Colocar Dinheiro no Caixa (Entrada/Suprimento)
            </Button>
            <Button
              size="lg"
              variant="destructive"
              onClick={() => abrirModal("saida")}
            >
              <MinusCircle className="mr-2 size-5" />
              Tirar Dinheiro do Caixa (Retirada/Sangria)
            </Button>
          </div>
        </div>
      </section>

      {/* TABELA DE HISTÓRICO COMPLETO DE MOVIMENTAÇÕES DO CAIXA */}
      <section className="rounded-xl border bg-card shadow-card">
        <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <History className="size-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold">
                Histórico Completo de Movimentações do Caixa
              </h2>
              <p className="text-xs text-muted-foreground">
                {historicoOrdenado.length}{" "}
                {historicoOrdenado.length === 1 ? "movimentação registrada" : "movimentações registradas"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border bg-muted/30 p-0.5 text-xs">
              {(
                [
                  ["todos", "Todas"],
                  ["entrada", "Entradas"],
                  ["saida", "Saídas"],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setFiltroTipo(val)}
                  className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                    filtroTipo === val
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar motivo/descrição…"
                className="pl-9"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Data / Hora</th>
                <th className="px-5 py-3 font-medium">Tipo de Movimentação</th>
                <th className="px-5 py-3 font-medium">Descrição / Motivo</th>
                <th className="px-5 py-3 font-medium">Vínculo Financeiro</th>
                <th className="px-5 py-3 text-right font-medium">Valor (R$)</th>
                <th className="px-5 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {historicoOrdenado.map((m) => {
                const isEntrada = m.tipo === "entrada";
                return (
                  <tr key={m.id} className="border-t hover:bg-muted/40">
                    <td className="whitespace-nowrap px-5 py-3 font-medium">
                      {formatarDataHoraBR(m.dataHora)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          isEntrada
                            ? "bg-status-done/15 text-status-done"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {isEntrada ? (
                          <ArrowUpCircle className="size-3.5" />
                        ) : (
                          <ArrowDownCircle className="size-3.5" />
                        )}
                        {isEntrada
                          ? m.origemVendaId
                            ? "Entrada · Venda"
                            : "Entrada / Suprimento"
                          : m.descricao.startsWith("Troco da Venda")
                            ? "Saída · Troco"
                            : "Retirada / Sangria"}
                      </span>
                    </td>
                    <td className="px-5 py-3">{m.descricao}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                        Caixa
                      </span>
                    </td>
                    <td
                      className={`whitespace-nowrap px-5 py-3 text-right font-semibold ${
                        isEntrada ? "text-status-done" : "text-destructive"
                      }`}
                    >
                      {isEntrada ? `+ ${brl(m.valor)}` : `− ${brl(m.valor)}`}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remover movimentação"
                        onClick={() => removerMovimentacao(m.id)}
                      >
                        <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {historicoOrdenado.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                    Nenhuma movimentação encontrada para o filtro selecionado.
                  </td>
                </tr>
              )}
            </tbody>
            {historicoOrdenado.length > 0 && (
              <tfoot className="border-t-2 bg-muted/30 font-semibold">
                <tr>
                  <td colSpan={4} className="px-5 py-3">
                    Saldo Físico Consolidado em Caixa (Entradas − Saídas)
                  </td>
                  <td
                    className={`px-5 py-3 text-right ${
                      totais.saldoFisico < 0 ? "text-destructive" : "text-primary"
                    }`}
                  >
                    {brl(totais.saldoFisico)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {/* MODAL PARA COLOCAR OU TIRAR DINHEIRO DO CAIXA */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {tipoModal === "entrada" ? (
                <>
                  <PlusCircle className="size-5 text-status-done" />
                  Colocar Dinheiro no Caixa (Entrada/Suprimento)
                </>
              ) : (
                <>
                  <MinusCircle className="size-5 text-destructive" />
                  Tirar Dinheiro do Caixa (Retirada/Sangria)
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={registrarMovimentacao} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="caixa-valor">Valor em R$</Label>
              <Input
                id="caixa-valor"
                inputMode="decimal"
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="caixa-descricao">Descrição / Motivo da Movimentação</Label>
              <Textarea
                id="caixa-descricao"
                rows={3}
                placeholder={
                  tipoModal === "entrada"
                    ? "Ex.: Suprimento inicial para troco na gaveta…"
                    : "Ex.: Sangria para pagamento de despesa urgente ou depósito…"
                }
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="caixa-datahora">Data e Hora</Label>
              <Input
                id="caixa-datahora"
                type="datetime-local"
                value={dataHora}
                onChange={(e) => setDataHora(e.target.value)}
                required
              />
            </div>

            <DialogFooter className="mt-2">
              <Button type="button" variant="outline" onClick={() => setModalAberto(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                variant={tipoModal === "entrada" ? "default" : "destructive"}
                className={tipoModal === "entrada" ? "bg-status-done text-white hover:bg-status-done/90" : ""}
              >
                {isSubmitting
                  ? "Salvando..."
                  : tipoModal === "entrada"
                    ? "Confirmar Entrada no Caixa"
                    : "Confirmar Retirada do Caixa"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

