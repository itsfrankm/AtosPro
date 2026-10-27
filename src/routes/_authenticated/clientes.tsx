import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { History, Pencil, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { clientes as inicial, ordens, brl, dataBR, statusClass, type Cliente } from "@/lib/os-data";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes · TecnoFix OS" },
      { name: "description", content: "Cadastro de clientes da assistência técnica." },
      { property: "og:title", content: "Clientes · TecnoFix OS" },
      { property: "og:description", content: "Cadastro de clientes da assistência técnica." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Clientes,
});

const vazio: Omit<Cliente, "id"> = { nome: "", documento: "", whatsapp: "", email: "", cep: "", endereco: "" };
const campos: [keyof typeof vazio, string, string, boolean?][] = [
  ["nome", "Nome Completo", "Nome do cliente", true],
  ["documento", "CPF/CNPJ", "000.000.000-00"],
  ["whatsapp", "Telefone/WhatsApp", "(00) 00000-0000"],
  ["email", "E-mail", "cliente@email.com"],
  ["cep", "CEP", "00000-000"],
  ["endereco", "Endereço completo", "Rua, número, bairro, cidade/UF", true],
];

function Clientes() {
  const [lista, setLista] = useState<Cliente[]>(inicial);
  const [q, setQ] = useState("");
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState(vazio);
  const [historico, setHistorico] = useState<Cliente | null>(null);

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    const d = t.replace(/\D/g, "");
    if (!t) return lista;
    return lista.filter(
      (c) => c.nome.toLowerCase().includes(t) || (d && (c.documento.replace(/\D/g, "").includes(d) || c.whatsapp.replace(/\D/g, "").includes(d))),
    );
  }, [q, lista]);

  const abrir = (c?: Cliente) => {
    setEditando(c ?? null);
    setForm(c ? { ...c } : vazio);
    setAberto(true);
  };

  const salvar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    if (editando) setLista((l) => l.map((c) => (c.id === editando.id ? { ...editando, ...form } : c)));
    else setLista((l) => [{ id: crypto.randomUUID(), ...form }, ...l]);
    setAberto(false);
  };

  const osDo = (c: Cliente) => ordens.filter((o) => o.cliente === c.nome);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Clientes" subtitle={`${lista.length} clientes cadastrados.`} />
        <Button onClick={() => abrir()}><Plus className="size-4" /> Novo Cliente</Button>
      </div>

      <section className="rounded-xl border bg-card shadow-card">
        <div className="border-b p-5">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, CPF/CNPJ ou WhatsApp…" className="pl-9" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {["Nome", "CPF/CNPJ", "WhatsApp", "E-mail", "Endereço", "Ações"].map((h) => (
                  <th key={h} className="px-5 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => (
                <tr key={c.id} className="border-t transition-colors hover:bg-muted/40">
                  <td className="px-5 py-3 font-medium">{c.nome}</td>
                  <td className="px-5 py-3 font-mono text-xs">{c.documento || "—"}</td>
                  <td className="px-5 py-3">{c.whatsapp || "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{c.email || "—"}</td>
                  <td className="max-w-64 truncate px-5 py-3 text-muted-foreground">{c.endereco || "—"}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => abrir(c)}><Pencil className="size-3.5" /> Editar</Button>
                      <Button size="sm" variant="ghost" onClick={() => setHistorico(c)}><History className="size-3.5" /> Histórico</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">Nenhum cliente encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editando ? "Editar Cliente" : "Novo Cliente"}</DialogTitle></DialogHeader>
          <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
            {campos.map(([k, l, p, full]) => (
              <div key={k} className={`grid gap-1.5 ${full ? "sm:col-span-2" : ""}`}>
                <Label htmlFor={k}>{l}</Label>
                <Input id={k} placeholder={p} value={form[k]} required={k === "nome"} type={k === "email" ? "email" : "text"}
                  onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
              </div>
            ))}
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
              <Button type="submit">{editando ? "Salvar alterações" : "Cadastrar cliente"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historico} onOpenChange={(o) => !o && setHistorico(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Histórico de OS · {historico?.nome}</DialogTitle></DialogHeader>
          {historico && osDo(historico).length > 0 ? (
            <div className="divide-y rounded-lg border">
              {osDo(historico).map((o) => (
                <div key={o.numero} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                  <div>
                    <p className="font-mono font-semibold text-primary">{o.numero}</p>
                    <p className="font-medium">{o.aparelho}</p>
                    <p className="text-muted-foreground">{o.defeito} · {dataBR(o.entrada)}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[o.status]}`}>{o.status}</span>
                    <p className="mt-1 font-medium">{o.valor ? brl(o.valor) : "—"}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-muted-foreground">Nenhuma ordem de serviço para este cliente.</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
