import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PackagePlus, Pencil, Search, List } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { brl } from "@/lib/os-data";
import { useEstoque, setEstado, lucroUnit, lucroPct, uid, type Produto } from "@/lib/estoque";

export const Route = createFileRoute("/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque · TecnoFix OS" },
      { name: "description", content: "Controle de produtos, custos, preços e margens de lucro." },
      { property: "og:title", content: "Estoque · TecnoFix OS" },
      { property: "og:description", content: "Controle de produtos, custos, preços e margens de lucro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Estoque,
});

const num = (s: string) => parseFloat(s.replace(",", ".")) || 0;
const pctTxt = (c: number, v: number) => { const p = lucroPct(c, v); return p == null ? "—" : `${p.toFixed(1).replace(".", ",")}%`; };

export function LucroPreview({ custo, venda }: { custo: number; venda: number }) {
  const l = lucroUnit(custo, venda);
  const neg = l < 0;
  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg border bg-accent/40 p-4">
      <div><p className="text-xs uppercase text-muted-foreground">Lucro Unitário</p><p className={`font-display text-xl font-bold ${neg ? "text-destructive" : "text-primary"}`}>{brl(l)}</p></div>
      <div><p className="text-xs uppercase text-muted-foreground">Porcentagem de Lucro</p><p className={`font-display text-xl font-bold ${neg ? "text-destructive" : "text-primary"}`}>{pctTxt(custo, venda)}</p></div>
    </div>
  );
}

function Estoque() {
  const { produtos } = useEstoque();
  const [tab, setTab] = useState("lista");
  return (
    <>
      <PageHeader title="Estoque" subtitle="Produtos, peças e acessórios" />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="lista"><List className="mr-2 size-4" />Lista e Alteração de Produtos</TabsTrigger>
          <TabsTrigger value="novo"><PackagePlus className="mr-2 size-4" />Cadastrar Produto</TabsTrigger>
        </TabsList>
        <TabsContent value="lista"><Lista produtos={produtos} /></TabsContent>
        <TabsContent value="novo"><Cadastro onDone={() => setTab("lista")} /></TabsContent>
      </Tabs>
    </>
  );
}

function Lista({ produtos }: { produtos: Produto[] }) {
  const [q, setQ] = useState("");
  const [ed, setEd] = useState<Produto | null>(null);
  const [f, setF] = useState({ nome: "", quantidade: "", custo: "", venda: "" });
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? produtos.filter((p) => p.nome.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t)) : produtos;
  }, [q, produtos]);

  const abrir = (p: Produto) => { setEd(p); setF({ nome: p.nome, quantidade: String(p.quantidade), custo: String(p.custo), venda: String(p.venda) }); };
  const salvar = () => {
    if (!ed || !f.nome.trim()) return toast.error("Informe o nome do produto.");
    setEstado((e) => ({ ...e, produtos: e.produtos.map((p) => p.id === ed.id ? { ...p, nome: f.nome.trim(), quantidade: Math.round(num(f.quantidade)), custo: num(f.custo), venda: num(f.venda) } : p) }));
    toast.success("Produto atualizado.");
    setEd(null);
  };

  return (
    <section className="rounded-xl border bg-card shadow-card">
      <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-lg font-semibold">{produtos.length} produtos</h2>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produto ou SKU…" className="pl-9" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>{["Nome do Produto", "Qtd. em Estoque", "Valor de Custo", "Valor de Venda", "Lucro / un.", "Lucro %", ""].map((h) => <th key={h} className="px-5 py-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const l = lucroUnit(p.custo, p.venda);
              return (
                <tr key={p.id} className="border-t hover:bg-muted/40">
                  <td className="px-5 py-3"><p className="font-medium">{p.nome}</p>{p.sku && <p className="font-mono text-xs text-muted-foreground">{p.sku}</p>}</td>
                  <td className="px-5 py-3"><span className={`font-semibold ${p.quantidade <= 0 ? "text-destructive" : ""}`}>{p.quantidade}</span></td>
                  <td className="px-5 py-3">{brl(p.custo)}</td>
                  <td className="px-5 py-3">{brl(p.venda)}</td>
                  <td className={`px-5 py-3 font-medium ${l < 0 ? "text-destructive" : "text-primary"}`}>{brl(l)}</td>
                  <td className={`px-5 py-3 font-medium ${l < 0 ? "text-destructive" : "text-primary"}`}>{pctTxt(p.custo, p.venda)}</td>
                  <td className="px-5 py-3 text-right"><Button size="sm" variant="outline" onClick={() => abrir(p)}><Pencil className="mr-1 size-4" />Editar Produto / Ajustar Estoque</Button></td>
                </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">Nenhum produto encontrado.</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={!!ed} onOpenChange={(o) => !o && setEd(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Produto / Ajustar Estoque</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5"><Label>Nome do Produto</Label><Input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label>Quantidade em Estoque</Label><Input type="number" value={f.quantidade} onChange={(e) => setF({ ...f, quantidade: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Valor de Compra (R$)</Label><Input inputMode="decimal" value={f.custo} onChange={(e) => setF({ ...f, custo: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>Valor de Venda (R$)</Label><Input inputMode="decimal" value={f.venda} onChange={(e) => setF({ ...f, venda: e.target.value })} /></div>
            </div>
            <LucroPreview custo={num(f.custo)} venda={num(f.venda)} />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEd(null)}>Cancelar</Button><Button onClick={salvar}>Salvar alterações</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Cadastro({ onDone }: { onDone: () => void }) {
  const vazio = { nome: "", sku: "", quantidade: "", custo: "", venda: "" };
  const [f, setF] = useState(vazio);
  const salvar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.nome.trim()) return toast.error("Informe o nome do produto.");
    setEstado((s) => ({ ...s, produtos: [...s.produtos, { id: uid(), nome: f.nome.trim(), sku: f.sku.trim(), quantidade: Math.round(num(f.quantidade)), custo: num(f.custo), venda: num(f.venda) }] }));
    toast.success("Produto cadastrado.");
    setF(vazio);
    onDone();
  };
  return (
    <form onSubmit={salvar} className="max-w-2xl rounded-xl border bg-card p-6 shadow-card">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5 sm:col-span-2"><Label>Nome do Produto *</Label><Input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Tela Samsung A54" /></div>
        <div className="grid gap-1.5"><Label>Código/SKU (opcional)</Label><Input value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} /></div>
        <div className="grid gap-1.5"><Label>Quantidade Inicial</Label><Input type="number" min={0} value={f.quantidade} onChange={(e) => setF({ ...f, quantidade: e.target.value })} placeholder="0" /></div>
        <div className="grid gap-1.5"><Label>Valor que custou (Compra) R$</Label><Input inputMode="decimal" value={f.custo} onChange={(e) => setF({ ...f, custo: e.target.value })} placeholder="0,00" /></div>
        <div className="grid gap-1.5"><Label>Valor que será vendido (Venda) R$</Label><Input inputMode="decimal" value={f.venda} onChange={(e) => setF({ ...f, venda: e.target.value })} placeholder="0,00" /></div>
        <div className="sm:col-span-2"><LucroPreview custo={num(f.custo)} venda={num(f.venda)} /></div>
      </div>
      <Button type="submit" className="mt-6"><PackagePlus className="mr-2 size-4" />Cadastrar Produto</Button>
    </form>
  );
}
