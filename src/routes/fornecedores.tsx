import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Plus, Search, Trash2, FileText, Building2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { num } from "@/lib/utils";
import { brl, dataBR } from "@/lib/os-data";
import { useEstoque, setEstado, uid, formatCNPJ, formatFone, aplicarCompra, somaItens, type Fornecedor } from "@/lib/estoque";
import {
  useDebouncedValue,
  escaparBuscaIlike,
  normalizarBuscaSegura,
  fornecedorSchema,
  notaCompraSchema,
  verificarRateLimit,
} from "@/lib/security";
import { getTenantUserId } from "@/lib/auth";

export const Route = createFileRoute("/fornecedores")({
  head: () => ({
    meta: [
      { title: "AtosPro" },
      { name: "description", content: "Cadastro de fornecedores e notas de compra." },
      { property: "og:title", content: "AtosPro" },
      { property: "og:description", content: "Cadastro de fornecedores e notas de compra." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Fornecedores,
});

const vazio = { nome: "", cnpj: "", telefone: "", endereco: "" };

function CamposFornecedor({ f, setF, comNome = true }: { f: typeof vazio; setF: (v: typeof vazio) => void; comNome?: boolean }) {
  return (
    <div className="grid gap-4">
      {comNome && <div className="grid gap-1.5"><Label>Nome da Empresa / Razão Social</Label><Input maxLength={150} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5"><Label>CNPJ</Label><Input maxLength={20} value={f.cnpj} onChange={(e) => setF({ ...f, cnpj: formatCNPJ(e.target.value) })} placeholder="00.000.000/0000-00" /></div>
        <div className="grid gap-1.5"><Label>Telefone da Empresa</Label><Input maxLength={25} value={f.telefone} onChange={(e) => setF({ ...f, telefone: formatFone(e.target.value) })} placeholder="(00) 0000-0000" /></div>
      </div>
      <div className="grid gap-1.5"><Label>Endereço Completo</Label><Input maxLength={250} value={f.endereco} onChange={(e) => setF({ ...f, endereco: e.target.value })} /></div>
    </div>
  );
}

function Fornecedores() {
  const { fornecedores } = useEstoque();
  const [q, setQ] = useState("");
  const qDebounced = useDebouncedValue(q, 300);
  const [sel, setSel] = useState<string | null>(null);
  const [novo, setNovo] = useState(false);
  const [f, setF] = useState(vazio);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const list = useMemo(() => {
    const t = normalizarBuscaSegura(escaparBuscaIlike(qDebounced));
    return t ? fornecedores.filter((x) => x.nome.toLowerCase().includes(t) || x.cnpj.includes(t)) : fornecedores;
  }, [qDebounced, fornecedores]);

  const atual = fornecedores.find((x) => x.id === sel);
  if (atual) return <Detalhe forn={atual} voltar={() => setSel(null)} />;

  const criar = () => {
    if (isSubmitting) return;
    const rate = verificarRateLimit("fornecedor", getTenantUserId());
    if (!rate.permitido) {
      toast.error(rate.erro);
      return;
    }

    const validacao = fornecedorSchema.safeParse(f);
    if (!validacao.success) {
      toast.error(validacao.error.issues[0]?.message ?? "Dados do fornecedor inválidos.");
      return;
    }

    setIsSubmitting(true);
    try {
      setEstado((e) => ({
        ...e,
        fornecedores: [...e.fornecedores, { id: uid(), ...validacao.data }],
      }));
      toast.success("Fornecedor cadastrado.");
      setNovo(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Fornecedores" subtitle="Clique em um fornecedor para ver detalhes e notas de compra" />
        <Button onClick={() => { setF(vazio); setNovo(true); }}><Plus className="mr-1 size-4" />Novo Fornecedor</Button>
      </div>
      <section className="rounded-xl border bg-card shadow-card">
        <div className="border-b p-5">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} maxLength={120} placeholder="Buscar por nome ou CNPJ…" className="pl-9" />
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>{["Empresa", "CNPJ", "Telefone", "Endereço"].map((h) => <th key={h} className="px-5 py-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {list.map((x) => (
              <tr key={x.id} onClick={() => setSel(x.id)} className="cursor-pointer border-t hover:bg-muted/40">
                <td className="px-5 py-3 font-medium text-primary">{x.nome}</td>
                <td className="px-5 py-3 font-mono">{x.cnpj || "—"}</td>
                <td className="px-5 py-3">{x.telefone || "—"}</td>
                <td className="px-5 py-3 text-muted-foreground">{x.endereco || "—"}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={4} className="px-5 py-10 text-center text-muted-foreground">Nenhum fornecedor.</td></tr>}
          </tbody>
        </table>
      </section>
      <Dialog open={novo} onOpenChange={setNovo}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Fornecedor</DialogTitle></DialogHeader>
          <CamposFornecedor f={f} setF={setF} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovo(false)}>Cancelar</Button>
            <Button onClick={criar} disabled={isSubmitting}>{isSubmitting ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Detalhe({ forn, voltar }: { forn: Fornecedor; voltar: () => void }) {
  const [f, setF] = useState({ nome: forn.nome, cnpj: forn.cnpj, telefone: forn.telefone, endereco: forn.endereco });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const salvar = () => {
    if (isSubmitting) return;
    const rate = verificarRateLimit("fornecedor", getTenantUserId());
    if (!rate.permitido) {
      toast.error(rate.erro);
      return;
    }

    const validacao = fornecedorSchema.safeParse(f);
    if (!validacao.success) {
      toast.error(validacao.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }

    setIsSubmitting(true);
    try {
      setEstado((e) => ({
        ...e,
        fornecedores: e.fornecedores.map((x) => (x.id === forn.id ? { ...x, ...validacao.data } : x)),
      }));
      toast.success("Dados atualizados.");
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <>
      <Button variant="ghost" size="sm" onClick={voltar} className="mb-4"><ArrowLeft className="mr-1 size-4" />Fornecedores</Button>
      <PageHeader title={forn.nome} subtitle={forn.cnpj} />
      <Tabs defaultValue="dados">
        <TabsList className="mb-6">
          <TabsTrigger value="dados"><Building2 className="mr-2 size-4" />Dados Cadastrais</TabsTrigger>
          <TabsTrigger value="notas"><FileText className="mr-2 size-4" />Notas de Compra</TabsTrigger>
        </TabsList>
        <TabsContent value="dados">
          <div className="max-w-2xl rounded-xl border bg-card p-6 shadow-card">
            <CamposFornecedor f={f} setF={setF} />
            <Button className="mt-6" onClick={salvar} disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="notas"><Notas fornecedorId={forn.id} /></TabsContent>
      </Tabs>
    </>
  );
}

type Linha = { key: string; produtoId: string; quantidade: string; valorUnit: string };
const novaLinha = (): Linha => ({ key: uid(), produtoId: "", quantidade: "1", valorUnit: "" });

function Notas({ fornecedorId }: { fornecedorId: string }) {
  const { produtos, notas } = useEstoque();
  const minhas = notas.filter((n) => n.fornecedorId === fornecedorId).sort((a, b) => b.data.localeCompare(a.data));
  const hoje = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState(hoje);
  const [numero, setNumero] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([novaLinha()]);
  const [aberta, setAberta] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const itens = linhas.map((l) => ({ produtoId: l.produtoId, quantidade: Math.round(num(l.quantidade)), valorUnit: num(l.valorUnit) }));
  const total = somaItens(itens);
  const upd = (k: string, p: Partial<Linha>) => setLinhas((ls) => ls.map((l) => (l.key === k ? { ...l, ...p } : l)));
  const nomeProd = (id: string) => produtos.find((p) => p.id === id)?.nome ?? "Produto removido";

  const salvar = () => {
    if (isSubmitting) return;
    const rate = verificarRateLimit("fornecedor", getTenantUserId());
    if (!rate.permitido) {
      toast.error(rate.erro);
      return;
    }

    const validos = itens.filter((i) => i.produtoId && i.quantidade > 0);
    const validacao = notaCompraSchema.safeParse({
      numero,
      data,
      itens: validos,
    });

    if (!validacao.success) {
      toast.error(validacao.error.issues[0]?.message ?? "Verifique os dados da nota.");
      return;
    }

    setIsSubmitting(true);
    try {
      setEstado((e) => ({
        ...e,
        produtos: aplicarCompra(e.produtos, validacao.data.itens),
        notas: [
          ...e.notas,
          {
            id: uid(),
            fornecedorId,
            data: validacao.data.data,
            numero: validacao.data.numero,
            itens: validacao.data.itens,
            total: somaItens(validacao.data.itens),
          },
        ],
      }));
      toast.success("Nota salva. Estoque e custos atualizados.");
      setNumero("");
      setLinhas([novaLinha()]);
      setData(hoje);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="rounded-xl border bg-card p-6 shadow-card lg:col-span-3">
        <h3 className="mb-4 font-display text-lg font-semibold">Nova Nota de Compra</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5"><Label>Data da Compra</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label>Número da Nota</Label><Input maxLength={60} value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ex.: 000123" /></div>
        </div>
        <div className="mt-5 space-y-2">
          <div className="hidden grid-cols-12 gap-2 text-xs uppercase text-muted-foreground sm:grid">
            <span className="col-span-5">Produto</span><span className="col-span-2">Qtd.</span><span className="col-span-2">Valor unit.</span><span className="col-span-2">Subtotal</span>
          </div>
          {linhas.map((l, i) => (
            <div key={l.key} className="grid grid-cols-12 items-center gap-2">
              <select value={l.produtoId} onChange={(e) => upd(l.key, { produtoId: e.target.value, valorUnit: l.valorUnit || String(produtos.find((p) => p.id === e.target.value)?.custo ?? "") })} className="col-span-12 h-9 rounded-md border border-input bg-background px-2 text-sm sm:col-span-5">
                <option value="">Selecione o produto…</option>
                {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
              <Input className="col-span-4 sm:col-span-2" type="number" min={1} value={l.quantidade} onChange={(e) => upd(l.key, { quantidade: e.target.value })} />
              <Input className="col-span-4 sm:col-span-2" inputMode="decimal" placeholder="0,00" value={l.valorUnit} onChange={(e) => upd(l.key, { valorUnit: e.target.value })} />
              <span className="col-span-3 text-sm font-medium sm:col-span-2">{brl(Number((itens[i]!.quantidade * itens[i]!.valorUnit).toFixed(2)))}</span>
              <Button variant="ghost" size="icon" className="col-span-1" disabled={linhas.length === 1} onClick={() => setLinhas((ls) => ls.filter((x) => x.key !== l.key))} aria-label="Remover item"><Trash2 className="size-4" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setLinhas((ls) => [...ls, novaLinha()])}><Plus className="mr-1 size-4" />Adicionar produto</Button>
        </div>
        <div className="mt-6 flex items-center justify-between border-t pt-4">
          <div><p className="text-xs uppercase text-muted-foreground">Total da Nota</p><p className="font-display text-2xl font-bold text-primary">{brl(total)}</p></div>
          <Button onClick={salvar} disabled={isSubmitting}>{isSubmitting ? "Salvando..." : "Salvar Nota"}</Button>
        </div>
      </div>
      <div className="rounded-xl border bg-card p-6 shadow-card lg:col-span-2">
        <h3 className="mb-4 font-display text-lg font-semibold">Notas anteriores</h3>
        {minhas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma nota registrada.</p>}
        <ul className="space-y-2">
          {minhas.map((n) => (
            <li key={n.id} className="rounded-lg border">
              <button className="flex w-full items-center justify-between p-3 text-left" onClick={() => setAberta(aberta === n.id ? null : n.id)}>
                <span><span className="font-mono font-semibold">Nº {n.numero}</span><span className="ml-2 text-xs text-muted-foreground">{dataBR(n.data)}</span></span>
                <span className="font-semibold">{brl(n.total)}</span>
              </button>
              {aberta === n.id && (
                <ul className="border-t px-3 py-2 text-sm">
                  {n.itens.map((it, i) => <li key={i} className="flex justify-between py-0.5"><span>{it.quantidade}× {nomeProd(it.produtoId)}</span><span className="text-muted-foreground">{brl(Number((it.quantidade * it.valorUnit).toFixed(2)))}</span></li>)}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
