import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  Printer,
  Search,
  Trash2,
  ShoppingCart,
  CheckCircle2,
  CreditCard,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { num } from "@/lib/utils";
import { brl } from "@/lib/os-data";
import {
  useEstoque,
  setEstado,
  uid,
  aplicarVenda,
  calcTotal,
  calcularTrocoDinheiro,
  gerarMovimentacoesCaixaVenda,
  somaItens,
  proximoNumeroVenda,
  FORMAS_PAGAMENTO,
  type FormaPagamento,
  type ItemVenda,
  type PagamentoVenda,
  type Venda,
} from "@/lib/estoque";
import {
  useDebouncedValue,
  escaparBuscaIlike,
  normalizarBuscaSegura,
  vendaSchema,
  verificarRateLimit,
} from "@/lib/security";
import { getTenantUserId } from "@/lib/auth";

export const Route = createFileRoute("/vendas")({
  head: () => ({
    meta: [
      { title: "AtosPro" },
      { name: "description", content: "Ponto de venda rápido com pagamento combinado, baixa no estoque e cupom térmico." },
      { property: "og:title", content: "AtosPro" },
      { property: "og:description", content: "Ponto de venda rápido com pagamento combinado, baixa no estoque e cupom térmico." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Vendas,
});

interface LinhaPagamento {
  key: string;
  forma: FormaPagamento;
  valor: string;
  valorRecebido: string;
  manual: boolean;
}

const formatarInputValor = (v: number) => (v > 0 ? String(+v.toFixed(2)) : "");

function Vendas() {
  const { produtos, vendas } = useEstoque();
  const [q, setQ] = useState("");
  const qDebounced = useDebouncedValue(q, 300);
  const [prodId, setProdId] = useState("");
  const [qtd, setQtd] = useState("1");
  const [itens, setItens] = useState<ItemVenda[]>([]);
  const [desc, setDesc] = useState("");
  const [tipo, setTipo] = useState<"R$" | "%">("R$");
  const [finalTxt, setFinalTxt] = useState("");
  const [pagamentos, setPagamentos] = useState<LinhaPagamento[]>([
    { key: uid(), forma: "Cartão de Crédito", valor: "", valorRecebido: "", manual: false },
  ]);
  const [concluida, setConcluida] = useState<Venda | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const busca = useMemo(() => {
    const t = normalizarBuscaSegura(escaparBuscaIlike(qDebounced));
    return (t ? produtos.filter((p) => p.nome.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t)) : produtos).slice(0, 8);
  }, [qDebounced, produtos]);

  const subtotal = somaItens(itens);
  const calc = calcTotal(subtotal, num(desc), tipo, finalTxt.trim() ? num(finalTxt) : null);

  // Quando há apenas 1 forma de pagamento e ela ainda não foi editada manualmente, acompanha o total da venda
  useEffect(() => {
    setPagamentos((atual) => {
      if (atual.length === 1 && !atual[0]!.manual) {
        const novoValor = formatarInputValor(calc.total);
        if (atual[0]!.valor === novoValor) return atual;
        return [{ ...atual[0]!, valor: novoValor }];
      }
      return atual;
    });
  }, [calc.total]);

  const valorDistribuido = useMemo(
    () => +pagamentos.reduce((s, p) => s + Math.max(0, num(p.valor)), 0).toFixed(2),
    [pagamentos],
  );

  const valorRestante = useMemo(
    () => +Math.max(0, calc.total - valorDistribuido).toFixed(2),
    [calc.total, valorDistribuido],
  );

  const valorExcedente = useMemo(
    () => +Math.max(0, valorDistribuido - calc.total).toFixed(2),
    [calc.total, valorDistribuido],
  );

  const resumoDinheiro = useMemo(() => {
    const linhasDinheiro = pagamentos.filter((p) => p.forma === "Dinheiro");
    let totalAbatido = 0;
    let totalRecebido = 0;
    let totalTroco = 0;
    let valorInsuficiente = false;

    for (const p of linhasDinheiro) {
      const abatido = +Math.max(0, num(p.valor)).toFixed(2);
      const digitouRecebido = p.valorRecebido.trim().length > 0;
      const recebidoInput = digitouRecebido ? +Math.max(0, num(p.valorRecebido)).toFixed(2) : abatido;

      if (digitouRecebido && abatido > 0 && recebidoInput < abatido) {
        valorInsuficiente = true;
      }

      const { valorRecebido, troco } = calcularTrocoDinheiro(
        abatido,
        digitouRecebido ? recebidoInput : undefined,
      );
      totalAbatido = +(totalAbatido + abatido).toFixed(2);
      totalRecebido = +(totalRecebido + valorRecebido).toFixed(2);
      totalTroco = +(totalTroco + troco).toFixed(2);
    }

    return {
      temFormaDinheiro: linhasDinheiro.length > 0,
      temDinheiroComValor: linhasDinheiro.length > 0 && totalAbatido > 0,
      totalAbatido,
      totalRecebido,
      totalTroco,
      valorInsuficiente,
    };
  }, [pagamentos]);

  const pagamentoFechado =
    itens.length > 0 &&
    calc.total > 0 &&
    Math.abs(valorDistribuido - calc.total) < 0.01 &&
    !resumoDinheiro.valorInsuficiente;

  const adicionar = (id = prodId) => {
    const p = produtos.find((x) => x.id === id);
    const n = Math.max(1, Math.round(num(qtd)));
    if (!p) { toast.error("Selecione um produto."); return; }
    const jaNaNota = itens.filter((i) => i.produtoId === p.id).reduce((s, i) => s + i.quantidade, 0);
    if (jaNaNota + n > p.quantidade) {
      toast.error(`Estoque insuficiente: há apenas ${p.quantidade} un. de "${p.nome}" disponível(is).`);
      return;
    }
    setItens((its) => {
      const ex = its.find((i) => i.produtoId === p.id);
      return ex
        ? its.map((i) => (i.produtoId === p.id ? { ...i, quantidade: i.quantidade + n } : i))
        : [...its, { produtoId: p.id, nome: p.nome, quantidade: n, preco: p.venda, custoUnit: p.custo }];
    });
    setQtd("1");
    setProdId("");
  };

  const adicionarFormaPagamento = () => {
    setPagamentos((atual) => {
      const usadas = new Set(atual.map((p) => p.forma));
      const proximaForma =
        FORMAS_PAGAMENTO.find((f) => !usadas.has(f)) ?? "Dinheiro";
      const somaAtual = +atual.reduce((s, p) => s + Math.max(0, num(p.valor)), 0).toFixed(2);
      const restanteParaPreencher = +Math.max(0, calc.total - somaAtual).toFixed(2);
      return [
        ...atual,
        {
          key: uid(),
          forma: proximaForma,
          valor: formatarInputValor(restanteParaPreencher),
          valorRecebido: "",
          manual: true,
        },
      ];
    });
  };

  const atualizarPagamento = (key: string, patch: Partial<LinhaPagamento>) => {
    setPagamentos((atual) =>
      atual.map((p) => (p.key === key ? { ...p, ...patch } : p)),
    );
  };

  const removerPagamento = (key: string) => {
    setPagamentos((atual) => {
      const filtrados = atual.filter((p) => p.key !== key);
      if (filtrados.length === 0) {
        return [
          {
            key: uid(),
            forma: "Cartão de Crédito",
            valor: formatarInputValor(calc.total),
            valorRecebido: "",
            manual: false,
          },
        ];
      }
      return filtrados;
    });
  };

  const concluir = () => {
    if (isSubmitting) return;
    if (!itens.length) {
      toast.error("Adicione produtos à nota.");
      return;
    }
    if (resumoDinheiro.valorInsuficiente) {
      toast.error("O Valor Recebido em Dinheiro não pode ser menor que o valor abatido na venda.");
      return;
    }
    if (!pagamentoFechado) {
      toast.error("A soma das formas de pagamento deve atingir exatamente o valor total da nota.");
      return;
    }

    const rate = verificarRateLimit("venda", getTenantUserId());
    if (!rate.permitido) {
      toast.error(rate.erro);
      return;
    }

    const pagamentosValidos: PagamentoVenda[] = pagamentos
      .map((p) => {
        const valorAbatido = +Math.max(0, num(p.valor)).toFixed(2);
        if (p.forma === "Dinheiro" && valorAbatido > 0) {
          const digitouRecebido = p.valorRecebido.trim().length > 0;
          const calcDinheiro = calcularTrocoDinheiro(
            valorAbatido,
            digitouRecebido ? num(p.valorRecebido) : undefined,
          );
          return {
            forma: p.forma,
            valor: calcDinheiro.valorAbatido,
            valorRecebido: calcDinheiro.valorRecebido,
            troco: calcDinheiro.troco,
          };
        }
        return { forma: p.forma, valor: valorAbatido };
      })
      .filter((p) => p.valor > 0);

    const validacao = vendaSchema.safeParse({
      itens,
      total: calc.total,
      pagamentos: pagamentosValidos,
    });

    if (!validacao.success) {
      toast.error(validacao.error.issues[0]?.message ?? "Verifique os dados da venda.");
      return;
    }

    setIsSubmitting(true);
    try {
      const dataHoraIso = new Date().toISOString();
      const numeroVenda = proximoNumeroVenda(vendas);

      const pagsDinheiro = pagamentosValidos.filter((p) => p.forma === "Dinheiro");
      const totalAbatidoDinheiro = +pagsDinheiro.reduce((s, p) => s + p.valor, 0).toFixed(2);
      const totalRecebidoDinheiro = +pagsDinheiro
        .reduce((s, p) => s + (p.valorRecebido ?? p.valor), 0)
        .toFixed(2);
      const totalTrocoDinheiro = +Math.max(0, totalRecebidoDinheiro - totalAbatidoDinheiro).toFixed(2);

      const venda: Venda = {
        id: uid(),
        numero: numeroVenda,
        dataHora: dataHoraIso,
        itens,
        subtotal,
        desconto: calc.desconto,
        arredondamento: calc.arredondamento,
        total: calc.total,
        pagamentos: pagamentosValidos,
        ...(totalAbatidoDinheiro > 0
          ? {
              valorRecebidoDinheiro: totalRecebidoDinheiro,
              troco: totalTrocoDinheiro,
            }
          : {}),
      };

      const novasMovimentacoesVenda = gerarMovimentacoesCaixaVenda(venda);

      setEstado((e) => ({
        ...e,
        produtos: aplicarVenda(e.produtos, itens),
        vendas: [...e.vendas, venda],
        caixa: [...novasMovimentacoesVenda, ...(e.caixa ?? [])],
      }));

      setConcluida(venda);
      if (totalAbatidoDinheiro > 0) {
        if (totalTrocoDinheiro > 0) {
          toast.success(
            `Venda #${numeroVenda} concluída! Entrada de ${brl(totalRecebidoDinheiro)} e saída de troco de ${brl(totalTrocoDinheiro)} registradas no Caixa.`,
          );
        } else {
          toast.success(`Venda concluída! ${brl(totalAbatidoDinheiro)} em Dinheiro somado automaticamente ao Caixa.`);
        }
      } else {
        toast.success("Venda concluída. Estoque e Financeiro atualizados.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const novaVenda = () => {
    setItens([]);
    setDesc("");
    setFinalTxt("");
    setPagamentos([{ key: uid(), forma: "Cartão de Crédito", valor: "", valorRecebido: "", manual: false }]);
    setConcluida(null);
  };

  return (
    <>
      <PageHeader title="Vendas · PDV" subtitle="Monte a nota, aplique desconto, combine formas de pagamento e conclua a venda" />
      {concluida ? (
        <div className="mx-auto max-w-md rounded-xl border bg-card p-8 text-center shadow-card">
          <CheckCircle2 className="mx-auto size-12 text-primary" />
          <h2 className="mt-3 font-display text-xl font-bold">Venda nº {concluida.numero} concluída</h2>
          <p className="mt-1 text-3xl font-bold text-primary">{brl(concluida.total)}</p>
          {concluida.pagamentos && concluida.pagamentos.length > 0 && (
            <div className="mt-4 rounded-lg border bg-muted/40 p-3 text-left text-xs">
              <p className="mb-1.5 font-semibold uppercase text-muted-foreground">Formas de Pagamento</p>
              {concluida.pagamentos.map((pg, idx) => (
                <div key={idx} className="flex justify-between py-0.5">
                  <span className="font-medium">{pg.forma}</span>
                  <span className="font-semibold">{brl(pg.valor)}</span>
                </div>
              ))}
              {concluida.valorRecebidoDinheiro !== undefined && concluida.valorRecebidoDinheiro > 0 && (
                <div className="mt-2 border-t pt-2">
                  <div className="flex justify-between py-0.5">
                    <span className="text-muted-foreground">Valor Recebido em Espécie</span>
                    <span className="font-semibold">{brl(concluida.valorRecebidoDinheiro)}</span>
                  </div>
                  <div className="flex justify-between py-0.5 text-status-done">
                    <span className="font-bold">Troco a Devolver: {brl(concluida.troco ?? 0)}</span>
                    <span className="font-semibold">Troco da Venda #{concluida.numero}</span>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="mt-6 grid gap-2">
            <Button size="lg" onClick={() => window.print()}><Printer className="mr-2 size-5" />Imprimir Cupom Fiscal (Térmica)</Button>
            <Button variant="outline" onClick={novaVenda}>Nova venda</Button>
          </div>
          <div className="mt-6 flex justify-center rounded-lg bg-muted p-4"><Cupom v={concluida} /></div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-6 lg:col-span-3">
            <section className="rounded-xl border bg-card p-5 shadow-card">
              <Label>Buscar produto</Label>
              <div className="relative mt-1.5">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome ou SKU…" className="pl-9" />
              </div>
              <ul className="mt-3 max-h-64 divide-y overflow-auto rounded-lg border">
                {busca.map((p) => (
                  <li key={p.id}>
                    <button onClick={() => setProdId(p.id)} onDoubleClick={() => adicionar(p.id)} className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/50 ${prodId === p.id ? "bg-accent" : ""}`}>
                      <span><span className="font-medium">{p.nome}</span><span className="ml-2 text-xs text-muted-foreground">estoque: {p.quantidade}</span></span>
                      <span className="font-semibold">{brl(p.venda)}</span>
                    </button>
                  </li>
                ))}
                {busca.length === 0 && <li className="px-3 py-4 text-center text-muted-foreground">Nenhum produto.</li>}
              </ul>
              <div className="mt-3 flex items-end gap-2">
                <div className="grid w-28 gap-1.5"><Label>Quantidade</Label><Input type="number" min={1} value={qtd} onChange={(e) => setQtd(e.target.value)} /></div>
                <Button onClick={() => adicionar()} disabled={!prodId}><Plus className="mr-1 size-4" />Adicionar à nota</Button>
              </div>
            </section>
            <section className="rounded-xl border bg-card shadow-card">
              <h3 className="flex items-center gap-2 border-b p-5 font-display font-semibold"><ShoppingCart className="size-5" />Itens da nota ({itens.length})</h3>
              <table className="w-full text-sm">
                <tbody>
                  {itens.map((i) => (
                    <tr key={i.produtoId} className="border-b last:border-0">
                      <td className="px-5 py-3 font-medium">{i.nome}</td>
                      <td className="px-2 py-3 text-muted-foreground">{i.quantidade} × {brl(i.preco)}</td>
                      <td className="px-2 py-3 text-right font-semibold">{brl(i.quantidade * i.preco)}</td>
                      <td className="px-3 py-3 text-right"><Button variant="ghost" size="icon" aria-label="Remover" onClick={() => setItens((its) => its.filter((x) => x.produtoId !== i.produtoId))}><Trash2 className="size-4 text-destructive" /></Button></td>
                    </tr>
                  ))}
                  {itens.length === 0 && <tr><td className="px-5 py-8 text-center text-muted-foreground">Nenhum item adicionado.</td></tr>}
                </tbody>
              </table>
            </section>
          </div>

          <aside className="h-fit rounded-xl border bg-card p-5 shadow-card lg:col-span-2 lg:sticky lg:top-6">
            <h3 className="font-display text-lg font-semibold">Fechamento da Nota</h3>
            <div className="mt-4 flex justify-between text-sm"><span>Subtotal</span><span className="font-semibold">{brl(subtotal)}</span></div>
            <div className="mt-4 grid gap-1.5">
              <Label>Desconto</Label>
              <div className="flex gap-2">
                <div className="flex rounded-md border">
                  {(["R$", "%"] as const).map((t) => <button key={t} type="button" onClick={() => setTipo(t)} className={`px-3 text-sm font-medium ${tipo === t ? "bg-primary text-primary-foreground" : ""}`}>{t}</button>)}
                </div>
                <Input inputMode="decimal" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="0" />
              </div>
              {calc.desconto > 0 && <p className="text-xs text-muted-foreground">− {brl(calc.desconto)}</p>}
            </div>
            <div className="mt-4 grid gap-1.5">
              <Label>Arredondar Valor</Label>
              <div className="flex gap-2">
                <Input inputMode="decimal" value={finalTxt} onChange={(e) => setFinalTxt(e.target.value)} placeholder={`Valor final (ex.: ${Math.floor(calc.comDesconto)})`} />
                <Button type="button" variant="outline" onClick={() => setFinalTxt(String(Math.floor(calc.comDesconto)))}>Tirar centavos</Button>
              </div>
              {calc.arredondamento !== 0 && <p className="text-xs text-muted-foreground">Arredondamento: {brl(calc.arredondamento)} <button type="button" className="underline" onClick={() => setFinalTxt("")}>desfazer</button></p>}
            </div>

            {/* SEÇÃO DE MÚLTIPLAS FORMAS DE PAGAMENTO (PAGAMENTO COMBINADO) */}
            <div className="mt-6 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-sm font-semibold">
                  <CreditCard className="size-4 text-primary" />
                  Formas de Pagamento
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={adicionarFormaPagamento}
                  className="h-8 text-xs"
                >
                  <Plus className="mr-1 size-3.5" /> Adicionar pagamento
                </Button>
              </div>

              <div className="mt-3 space-y-2.5">
                {pagamentos.map((pg, idx) => {
                  const isDinheiro = pg.forma === "Dinheiro";
                  const valorAbatidoLinha = +Math.max(0, num(pg.valor)).toFixed(2);
                  const digitouRecebidoLinha = pg.valorRecebido.trim().length > 0;
                  const { troco: trocoLinha } = calcularTrocoDinheiro(
                    valorAbatidoLinha,
                    digitouRecebidoLinha ? num(pg.valorRecebido) : undefined,
                  );

                  return (
                    <div key={pg.key} className="space-y-2 rounded-lg border bg-muted/20 p-2.5">
                      <div className="grid grid-cols-12 items-end gap-2">
                        <div className={isDinheiro ? "col-span-11" : "col-span-6"}>
                          <Label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                            Forma de Pagamento
                          </Label>
                          <select
                            aria-label={`Forma de pagamento ${idx + 1}`}
                            value={pg.forma}
                            onChange={(e) =>
                              atualizarPagamento(pg.key, {
                                forma: e.target.value as FormaPagamento,
                                valorRecebido:
                                  e.target.value === "Dinheiro" ? pg.valorRecebido : "",
                              })
                            }
                            className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs font-medium outline-none focus:ring-2 focus:ring-ring"
                          >
                            {FORMAS_PAGAMENTO.map((f) => (
                              <option key={f} value={f}>
                                {f}
                              </option>
                            ))}
                          </select>
                        </div>
                        {!isDinheiro && (
                          <div className="col-span-5">
                            <Label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                              Valor Abatido (R$)
                            </Label>
                            <Input
                              aria-label={`Valor do pagamento ${idx + 1}`}
                              inputMode="decimal"
                              placeholder="0,00"
                              value={pg.valor}
                              onChange={(e) =>
                                atualizarPagamento(pg.key, { valor: e.target.value, manual: true })
                              }
                              className="h-9 text-sm"
                            />
                          </div>
                        )}
                        <div className="col-span-1 flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            disabled={pagamentos.length === 1}
                            onClick={() => removerPagamento(pg.key)}
                            aria-label="Remover forma de pagamento"
                          >
                            <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      </div>

                      {isDinheiro && (
                        <div className="grid grid-cols-2 items-end gap-2 pt-1">
                          <div>
                            <Label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                              Valor Abatido (R$)
                            </Label>
                            <Input
                              aria-label={`Valor do pagamento ${idx + 1}`}
                              inputMode="decimal"
                              placeholder="0,00"
                              value={pg.valor}
                              onChange={(e) =>
                                atualizarPagamento(pg.key, { valor: e.target.value, manual: true })
                              }
                              className="h-9 text-sm"
                            />
                          </div>
                          <div>
                            <Label
                              htmlFor={`valor-recebido-dinheiro-${pg.key}`}
                              className="mb-1 block text-[11px] font-semibold text-primary"
                            >
                              Valor Recebido em Dinheiro (R$)
                            </Label>
                            <Input
                              id={`valor-recebido-dinheiro-${pg.key}`}
                              aria-label="Valor Recebido em Dinheiro (R$)"
                              inputMode="decimal"
                              placeholder={pg.valor || "0,00"}
                              value={pg.valorRecebido}
                              onChange={(e) =>
                                atualizarPagamento(pg.key, { valorRecebido: e.target.value })
                              }
                              className="h-9 border-primary/40 text-sm font-semibold"
                            />
                          </div>
                          {trocoLinha > 0 && pagamentos.filter((x) => x.forma === "Dinheiro").length > 1 && (
                            <p className="col-span-2 text-right text-xs font-semibold text-status-done">
                              Troco desta parcela: {brl(trocoLinha)}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* DESTAQUE DO TROCO A DEVOLVER QUANDO VALOR RECEBIDO EM DINHEIRO > VALOR DEVIDO */}
              {resumoDinheiro.temFormaDinheiro && resumoDinheiro.totalTroco > 0 && (
                <div
                  role="status"
                  className="mt-3 flex items-center justify-between rounded-lg border-2 border-status-done/60 bg-status-done/15 px-3.5 py-2.5 text-status-done shadow-sm"
                >
                  <span className="font-display text-sm font-bold">
                    Troco a Devolver: {brl(resumoDinheiro.totalTroco)}
                  </span>
                  <span className="text-xs font-semibold">
                    Recebido: {brl(resumoDinheiro.totalRecebido)}
                  </span>
                </div>
              )}

              {resumoDinheiro.valorInsuficiente && (
                <p className="mt-2 text-xs font-semibold text-destructive">
                  Atenção: o Valor Recebido em Dinheiro é menor que o valor abatido na venda.
                </p>
              )}

              {/* RESUMO EM TEMPO REAL DA DISTRIBUIÇÃO DO PAGAMENTO */}
              <div className="mt-4 space-y-1.5 rounded-lg border bg-muted/30 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total da Venda</span>
                  <span className="font-display text-sm font-bold text-foreground">{brl(calc.total)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Valor Já Distribuído</span>
                  <span className="font-semibold text-primary">{brl(valorDistribuido)}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-1.5">
                  <span className="font-medium">Valor Restante para Fechar</span>
                  <span
                    className={`font-display text-sm font-bold ${
                      valorRestante === 0 && valorExcedente === 0 && calc.total > 0
                        ? "text-status-done"
                        : "text-destructive"
                    }`}
                  >
                    {brl(valorRestante)}
                  </span>
                </div>
                {valorExcedente > 0 && (
                  <p className="pt-1 text-[11px] font-medium text-destructive">
                    Atenção: o valor distribuído excede o total da nota em {brl(valorExcedente)}.
                  </p>
                )}
              </div>

              {resumoDinheiro.temDinheiroComValor && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-status-done">
                  <Wallet className="size-3.5 shrink-0" />
                  {resumoDinheiro.totalTroco > 0 ? (
                    <span>
                      No <strong>Caixa</strong>: Entrada de <strong>{brl(resumoDinheiro.totalRecebido)}</strong> e Saída Automática de{" "}
                      <strong>{brl(resumoDinheiro.totalTroco)}</strong> (Troco)
                    </span>
                  ) : (
                    <span>
                      {brl(resumoDinheiro.totalAbatido)} em <strong>Dinheiro</strong> será somado automaticamente ao <strong>Caixa</strong>.
                    </span>
                  )}
                </p>
              )}
            </div>

            <div className="mt-5 border-t pt-4">
              <p className="text-xs uppercase text-muted-foreground">Total Final da Nota</p>
              <p className="font-display text-3xl font-bold text-primary">{brl(calc.total)}</p>
            </div>
            <Button
              size="lg"
              className="mt-4 w-full"
              onClick={concluir}
              disabled={!pagamentoFechado || isSubmitting}
            >
              {isSubmitting ? "Finalizando Venda..." : "Concluir Venda"}
            </Button>
          </aside>
        </div>
      )}
      {concluida && <div className="os-print-holder"><Cupom v={concluida} /></div>}
    </>
  );
}

function Cupom({ v }: { v: Venda }) {
  const d = new Date(v.dataHora);
  const listaPagamentos =
    v.pagamentos && v.pagamentos.length > 0
      ? v.pagamentos
      : [{ forma: "Dinheiro" as FormaPagamento, valor: v.total }];

  const pagamentosDinheiro = listaPagamentos.filter((pg) => pg.forma === "Dinheiro");
  const totalAbatidoDinheiro = +pagamentosDinheiro.reduce((s, pg) => s + pg.valor, 0).toFixed(2);
  const valorRecebidoEspecie =
    v.valorRecebidoDinheiro !== undefined
      ? v.valorRecebidoDinheiro
      : +pagamentosDinheiro
          .reduce((s, pg) => s + (pg.valorRecebido && pg.valorRecebido > 0 ? pg.valorRecebido : pg.valor), 0)
          .toFixed(2);
  const trocoDevolvido =
    v.troco !== undefined
      ? v.troco
      : +Math.max(0, valorRecebidoEspecie - totalAbatidoDinheiro).toFixed(2);

  return (
    <div className="cupom">
      <div className="cupom-c"><strong className="cupom-lg">ATOSPRO</strong><br />Assistência Técnica<br />CNPJ 00.000.000/0001-00<br />Rua Exemplo, 123 - Centro</div>
      <div className="cupom-hr" />
      <div className="cupom-c"><strong>CUPOM Nº {String(v.numero).padStart(6, "0")}</strong></div>
      <div className="cupom-hr" />
      <div className="cupom-row"><span>ITEM</span><span>TOTAL</span></div>
      {v.itens.map((i) => (
        <div key={i.produtoId}>
          <div>{i.nome}</div>
          <div className="cupom-row"><span>{i.quantidade} x {brl(i.preco)}</span><span>{brl(i.quantidade * i.preco)}</span></div>
        </div>
      ))}
      <div className="cupom-hr" />
      <div className="cupom-row"><span>SUBTOTAL</span><span>{brl(v.subtotal)}</span></div>
      {v.desconto > 0 && <div className="cupom-row"><span>DESCONTO</span><span>-{brl(v.desconto)}</span></div>}
      {v.arredondamento !== 0 && <div className="cupom-row"><span>ARREDONDAMENTO</span><span>{brl(v.arredondamento)}</span></div>}
      <div className="cupom-row cupom-lg"><strong>TOTAL</strong><strong>{brl(v.total)}</strong></div>
      <div className="cupom-hr" />
      <div><strong>FORMA(S) DE PAGAMENTO</strong></div>
      {listaPagamentos.map((pg, idx) => (
        <div key={idx} className="cupom-row">
          <span>{pg.forma}</span>
          <span>{brl(pg.valor)}</span>
        </div>
      ))}
      <div className="cupom-hr" />
      <div className="cupom-row">
        <span>Valor Recebido em Espécie</span>
        <span>{brl(valorRecebidoEspecie)}</span>
      </div>
      <div className="cupom-row">
        <strong>Troco Devolvido</strong>
        <strong>{brl(trocoDevolvido)}</strong>
      </div>
      <div className="cupom-hr" />
      <div className="cupom-c">{d.toLocaleDateString("pt-BR")} {d.toLocaleTimeString("pt-BR")}<br />Obrigado pela preferência!</div>
    </div>
  );
}
