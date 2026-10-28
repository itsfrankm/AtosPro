import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Printer, Search, Trash2, ShoppingCart, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl } from "@/lib/os-data";
import { useEstoque, setEstado, uid, aplicarVenda, calcTotal, somaItens, type ItemVenda, type Venda } from "@/lib/estoque";

export const Route = createFileRoute("/vendas")({
  head: () => ({
    meta: [
      { title: "Vendas (PDV) · TecnoFix OS" },
      { name: "description", content: "Ponto de venda rápido com baixa automática no estoque e cupom térmico." },
      { property: "og:title", content: "Vendas (PDV) · TecnoFix OS" },
      { property: "og:description", content: "Ponto de venda rápido com baixa automática no estoque e cupom térmico." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Vendas,
});

const num = (s: string) => parseFloat(s.replace(",", ".")) || 0;

function Vendas() {
  const { produtos, vendas } = useEstoque();
  const [q, setQ] = useState("");
  const [prodId, setProdId] = useState("");
  const [qtd, setQtd] = useState("1");
  const [itens, setItens] = useState<ItemVenda[]>([]);
  const [desc, setDesc] = useState("");
  const [tipo, setTipo] = useState<"R$" | "%">("R$");
  const [finalTxt, setFinalTxt] = useState("");
  const [concluida, setConcluida] = useState<Venda | null>(null);

  const busca = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (t ? produtos.filter((p) => p.nome.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t)) : produtos).slice(0, 8);
  }, [q, produtos]);

  const subtotal = somaItens(itens);
  const calc = calcTotal(subtotal, num(desc), tipo, finalTxt.trim() ? num(finalTxt) : null);

  const adicionar = (id = prodId) => {
    const p = produtos.find((x) => x.id === id);
    const n = Math.max(1, Math.round(num(qtd)));
    if (!p) return toast.error("Selecione um produto.");
    const jaNaNota = itens.filter((i) => i.produtoId === p.id).reduce((s, i) => s + i.quantidade, 0);
    if (jaNaNota + n > p.quantidade) toast.warning(`Atenção: só há ${p.quantidade} em estoque de "${p.nome}".`);
    setItens((its) => {
      const ex = its.find((i) => i.produtoId === p.id);
      return ex ? its.map((i) => i.produtoId === p.id ? { ...i, quantidade: i.quantidade + n } : i) : [...its, { produtoId: p.id, nome: p.nome, quantidade: n, preco: p.venda }];
    });
    setQtd("1"); setProdId("");
  };

  const concluir = () => {
    if (!itens.length) return toast.error("Adicione produtos à nota.");
    const venda: Venda = { id: uid(), numero: vendas.length + 1, dataHora: new Date().toISOString(), itens, subtotal, desconto: calc.desconto, arredondamento: calc.arredondamento, total: calc.total };
    setEstado((e) => ({ ...e, produtos: aplicarVenda(e.produtos, itens), vendas: [...e.vendas, venda] }));
    setConcluida(venda);
    toast.success("Venda concluída. Estoque atualizado.");
  };

  const novaVenda = () => { setItens([]); setDesc(""); setFinalTxt(""); setConcluida(null); };

  return (
    <>
      <PageHeader title="Vendas · PDV" subtitle="Monte a nota, aplique desconto e conclua a venda" />
      {concluida ? (
        <div className="mx-auto max-w-md rounded-xl border bg-card p-8 text-center shadow-card">
          <CheckCircle2 className="mx-auto size-12 text-primary" />
          <h2 className="mt-3 font-display text-xl font-bold">Venda nº {concluida.numero} concluída</h2>
          <p className="mt-1 text-3xl font-bold text-primary">{brl(concluida.total)}</p>
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
                {busca.length === 0 && <li className="px-3 py-4 text-center text-sm text-muted-foreground">Nenhum produto.</li>}
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
            <h3 className="font-display text-lg font-semibold">Resumo da Nota</h3>
            <div className="mt-4 flex justify-between text-sm"><span>Subtotal</span><span className="font-semibold">{brl(subtotal)}</span></div>
            <div className="mt-4 grid gap-1.5">
              <Label>Desconto</Label>
              <div className="flex gap-2">
                <div className="flex rounded-md border">
                  {(["R$", "%"] as const).map((t) => <button key={t} onClick={() => setTipo(t)} className={`px-3 text-sm font-medium ${tipo === t ? "bg-primary text-primary-foreground" : ""}`}>{t}</button>)}
                </div>
                <Input inputMode="decimal" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="0" />
              </div>
              {calc.desconto > 0 && <p className="text-xs text-muted-foreground">− {brl(calc.desconto)}</p>}
            </div>
            <div className="mt-4 grid gap-1.5">
              <Label>Arredondar Valor</Label>
              <div className="flex gap-2">
                <Input inputMode="decimal" value={finalTxt} onChange={(e) => setFinalTxt(e.target.value)} placeholder={`Valor final (ex.: ${Math.floor(calc.comDesconto)})`} />
                <Button variant="outline" onClick={() => setFinalTxt(String(Math.floor(calc.comDesconto)))}>Tirar centavos</Button>
              </div>
              {calc.arredondamento !== 0 && <p className="text-xs text-muted-foreground">Arredondamento: {brl(calc.arredondamento)} <button className="underline" onClick={() => setFinalTxt("")}>desfazer</button></p>}
            </div>
            <div className="mt-6 border-t pt-4">
              <p className="text-xs uppercase text-muted-foreground">Total</p>
              <p className="font-display text-3xl font-bold text-primary">{brl(calc.total)}</p>
            </div>
            <Button size="lg" className="mt-4 w-full" onClick={concluir} disabled={!itens.length}>Concluir Venda</Button>
          </aside>
        </div>
      )}
      {concluida && <div className="os-print-holder"><Cupom v={concluida} /></div>}
    </>
  );
}

function Cupom({ v }: { v: Venda }) {
  const d = new Date(v.dataHora);
  return (
    <div className="cupom">
      <div className="cupom-c"><strong className="cupom-lg">TECNOFIX</strong><br />Assistência Técnica<br />CNPJ 00.000.000/0001-00<br />Rua Exemplo, 123 - Centro</div>
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
      <div className="cupom-c">{d.toLocaleDateString("pt-BR")} {d.toLocaleTimeString("pt-BR")}<br />Obrigado pela preferência!</div>
    </div>
  );
}
