import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bug, Check, MessageSquareText, Plus, Search, UserRound, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { clientes, ordens, statusList, type Cliente, type OSStatus } from "@/lib/os-data";

export const Route = createFileRoute("/nova-os")({
  validateSearch: (s: Record<string, unknown>): { os?: string } => (typeof s["os"] === "string" ? { os: s["os"] } : {}),
  head: () => ({
    meta: [
      { title: "Nova OS · TecnoFix OS" },
      { name: "description", content: "Abrir ou editar uma ordem de serviço." },
      { property: "og:title", content: "Nova OS · TecnoFix OS" },
      { property: "og:description", content: "Abrir ou editar uma ordem de serviço." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NovaOS,
});

const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const proximoNumero = () => `OS-${Math.max(...ordens.map((o) => Number(o.numero.replace(/\D/g, "")))) + 1}`;

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-6 shadow-card">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={`grid gap-1.5 ${className}`}><Label>{label}</Label>{children}</div>;
}

function NovaOS() {
  const { os } = Route.useSearch();
  const existente = os ? ordens.find((o) => o.numero === os) : undefined;

  const [numero] = useState(existente?.numero ?? proximoNumero());
  const [status, setStatus] = useState<OSStatus>(existente?.status ?? "Em Orçamento");
  const [entrada, setEntrada] = useState(existente?.entrada ?? hoje());
  const [finalizacao, setFinalizacao] = useState("");
  const [cliente, setCliente] = useState<Cliente | null>(existente ? clientes.find((c) => c.nome === existente.cliente) ?? null : null);
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(false);
  const [aparelho, setAparelho] = useState({
    equipamento: "", marcaModelo: existente?.aparelho ?? "", serie: "", estado: "", acessorios: "",
  });
  const [defeitoRelatado, setDefeitoRelatado] = useState(existente?.defeito ?? "");
  const [sintomas, setSintomas] = useState<string[]>([]);
  const [laudo, setLaudo] = useState("");
  const [tecnico, setTecnico] = useState("");
  const [servico, setServico] = useState("");
  const [pecas, setPecas] = useState("");
  const [garantia, setGarantia] = useState("90 dias");
  const [observacoes, setObservacoes] = useState("");

  const toggleSintoma = (s: string) =>
    setSintomas((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  const mudarStatus = (s: OSStatus) => {
    setStatus(s);
    if (s === "Finalizado" && !finalizacao) setFinalizacao(hoje());
  };

  const resultados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return [];
    const d = t.replace(/\D/g, "");
    return clientes.filter((c) => c.nome.toLowerCase().includes(t) || (d && (c.documento.replace(/\D/g, "").includes(d) || c.whatsapp.replace(/\D/g, "").includes(d)))).slice(0, 6);
  }, [busca, modal]);

  const salvar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliente) { toast.error("Selecione um cliente."); return; }
    if (!aparelho.marcaModelo.trim()) { toast.error("Informe a marca/modelo do aparelho."); return; }
    toast.success(existente ? `${numero} atualizada.` : `${numero} aberta com sucesso.`);
  };

  const ap = (k: keyof typeof aparelho) => ({
    value: aparelho[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setAparelho((a) => ({ ...a, [k]: e.target.value })),
  });

  return (
    <>
      <PageHeader title={existente ? `Editar ${numero}` : "Nova Ordem de Serviço"} subtitle="Registre a entrada do aparelho e os dados do cliente." />
      <form onSubmit={salvar} className="grid max-w-5xl gap-6">
        <Section title="Dados da OS">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Número da OS"><Input value={numero} readOnly className="font-mono font-semibold text-primary" /></Field>
            <Field label="Status">
              <Select value={status} onValueChange={(v) => mudarStatus(v as OSStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{statusList.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Data de Entrada"><Input type="date" value={entrada} onChange={(e) => setEntrada(e.target.value)} /></Field>
            <Field label="Data de Finalização"><Input type="date" value={finalizacao} onChange={(e) => setFinalizacao(e.target.value)} /></Field>
          </div>
        </Section>

        <Section title="Cliente" action={<Button type="button" variant="outline" size="sm" onClick={() => setModal(true)}><Plus className="size-4" /> Cadastro rápido</Button>}>
          {cliente ? (
            <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/40 p-4">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary"><UserRound className="size-5" /></div>
                <div>
                  <p className="font-medium">{cliente.nome}</p>
                  <p className="text-sm text-muted-foreground">{[cliente.documento, cliente.whatsapp].filter(Boolean).join(" · ") || "Sem documento/telefone"}</p>
                </div>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setCliente(null)}><X className="size-4" /> Trocar</Button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente por nome, CPF/CNPJ ou WhatsApp…" className="pl-9" />
              {busca.trim() && (
                <div className="mt-2 divide-y rounded-lg border">
                  {resultados.map((c) => (
                    <button type="button" key={c.id} onClick={() => { setCliente(c); setBusca(""); }} className="flex w-full items-center justify-between p-3 text-left text-sm hover:bg-muted/50">
                      <span className="font-medium">{c.nome}</span>
                      <span className="text-muted-foreground">{c.whatsapp}</span>
                    </button>
                  ))}
                  {resultados.length === 0 && <p className="p-3 text-sm text-muted-foreground">Nenhum cliente encontrado. Use o cadastro rápido.</p>}
                </div>
              )}
            </div>
          )}
        </Section>

        <Section title="Dados do Aparelho">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Equipamento"><Input placeholder="Ex.: Celular, Notebook, Console" {...ap("equipamento")} /></Field>
            <Field label="Marca/Modelo"><Input placeholder="Ex.: Samsung Galaxy S22" {...ap("marcaModelo")} /></Field>
            <Field label="Nº de Série/IMEI"><Input placeholder="Opcional" {...ap("serie")} /></Field>
            <Field label="Estado Físico/Avarias prévias" className="sm:col-span-3"><Textarea rows={3} placeholder="Riscos, amassados, tela trincada…" {...ap("estado")} /></Field>
            <Field label="Acessórios deixados" className="sm:col-span-3"><Input placeholder="Ex.: Carregador, capinha, chip" {...ap("acessorios")} /></Field>
          </div>
        </Section>

        <Section title="Diagnóstico e Execução">
          <Tabs defaultValue="defeito" className="gap-0 overflow-hidden rounded-lg border">
            <TabsList className="grid h-auto w-full grid-cols-3 rounded-none border-b bg-muted/40 p-0">
              <TabsTrigger
                value="defeito"
                className="flex h-auto flex-col gap-1 rounded-none py-3 data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary"
              >
                <MessageSquareText className="size-4 text-status-quote" />
                <span className="font-medium">Defeito Relatado (Cliente)</span>
              </TabsTrigger>
              <TabsTrigger
                value="laudo"
                className="flex h-auto flex-col gap-1 rounded-none border-l py-3 data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary"
              >
                <Bug className="size-4 text-status-bench" />
                <span className="font-medium">Avaliação Técnica (Laudo)</span>
              </TabsTrigger>
              <TabsTrigger
                value="servico"
                className="flex h-auto flex-col gap-1 rounded-none border-l py-3 data-[state=active]:bg-background data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary"
              >
                <Wrench className="size-4 text-status-done" />
                <span className="font-medium">Serviço Realizado</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="defeito" className="grid gap-4 p-6">
              <Field label="O que o cliente relatou">
                <Textarea rows={4} placeholder="Descrição do defeito nas palavras do cliente…" value={defeitoRelatado} onChange={(e) => setDefeitoRelatado(e.target.value)} />
              </Field>
              <div className="grid gap-2">
                <Label>Sintomas comuns</Label>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {["Não liga", "Não carrega", "Tela com defeito", "Sem áudio",
                    "Superaquecimento", "Bateria vicia/estufa", "Câmera não funciona", "Botões não respondem"].map((s) => (
                    <label key={s} className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm font-normal cursor-pointer hover:bg-muted/60 has-[[data-state=checked]]:border-primary/40 has-[[data-state=checked]]:bg-primary/5">
                      <Checkbox checked={sintomas.includes(s)} onCheckedChange={() => toggleSintoma(s)} />
                      {s}
                    </label>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="laudo" className="grid gap-4 p-6">
              <Field label="Diagnóstico técnico — o que foi visto na bancada">
                <Textarea rows={4} placeholder="Ex.: Testado com fonte externa, placa apresenta oxidação no conector de carga…" value={laudo} onChange={(e) => setLaudo(e.target.value)} />
              </Field>
              <Field label="Técnico Responsável" className="max-w-xs">
                <Input placeholder="Ex.: Marcos Silva" value={tecnico} onChange={(e) => setTecnico(e.target.value)} />
              </Field>
            </TabsContent>

            <TabsContent value="servico" className="grid gap-4 p-6">
              <Field label="O que foi feito no aparelho">
                <Textarea rows={4} placeholder="Ex.: Troca de display e vedação revisada, aparelho testado por 2h…" value={servico} onChange={(e) => setServico(e.target.value)} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Peças trocadas"><Input placeholder="Ex.: Display iPhone 13 Pro (original)" value={pecas} onChange={(e) => setPecas(e.target.value)} /></Field>
                <Field label="Prazo de garantia"><Input placeholder="Ex.: 90 dias" value={garantia} onChange={(e) => setGarantia(e.target.value)} /></Field>
              </div>
              <Field label="Observações finais"><Textarea rows={3} placeholder="Recomendações ao cliente, pendências…" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></Field>
            </TabsContent>
          </Tabs>
        </Section>

        <div className="flex justify-end">
          <Button type="submit" size="lg"><Check className="size-4" /> {existente ? "Salvar alterações" : "Abrir OS"}</Button>
        </div>
      </form>

      <CadastroRapido open={modal} onOpenChange={setModal} onSave={(c) => { clientes.unshift(c); setCliente(c); setModal(false); }} />
    </>
  );
}

function CadastroRapido({ open, onOpenChange, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; onSave: (c: Cliente) => void }) {
  const [f, setF] = useState({ nome: "", documento: "", whatsapp: "", email: "", cep: "", endereco: "" });
  const campos: [keyof typeof f, string][] = [["nome", "Nome Completo"], ["documento", "CPF/CNPJ"], ["whatsapp", "Telefone/WhatsApp"], ["email", "E-mail"]];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Cadastro rápido de cliente</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); if (!f.nome.trim()) return; onSave({ id: crypto.randomUUID(), ...f }); setF({ nome: "", documento: "", whatsapp: "", email: "", cep: "", endereco: "" }); }} className="grid gap-4">
          {campos.map(([k, l]) => (
            <Field key={k} label={l}><Input required={k === "nome"} type={k === "email" ? "email" : "text"} value={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} /></Field>
          ))}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">Cadastrar e selecionar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
