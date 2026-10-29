import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bug, Check, DollarSign, FileDown, MessageSquareText, Plus, Printer, Search, UserRound, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { OSDocument, type OSDocumentData } from "@/components/OSDocument";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { brl, isOSCancelada, isOSFinalizada, proximoNumeroOS, salvarCliente, salvarOrdem, statusClass, statusList, useClientes, useOrdens, type Cliente, type OSStatus } from "@/lib/os-data";
import { useEstoque, perfilInicial } from "@/lib/estoque";
import {
  useDebouncedValue,
  escaparBuscaIlike,
  normalizarBuscaSegura,
  ordemServicoSchema,
  clienteSchema,
  verificarRateLimit,
} from "@/lib/security";
import { getTenantUserId } from "@/lib/auth";
import { num } from "@/lib/utils";

export const Route = createFileRoute("/nova-os")({
  validateSearch: (s: Record<string, unknown>): { os?: string } => (typeof s["os"] === "string" ? { os: s["os"] } : {}),
  head: () => ({
    meta: [
      { title: "AtosPro" },
      { name: "description", content: "Abrir ou editar uma ordem de serviço." },
      { property: "og:title", content: "AtosPro" },
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

function Field({ label, htmlFor, children, className = "" }: { label: string; htmlFor?: string; children: React.ReactNode; className?: string }) {
  return <div className={`grid gap-1.5 ${className}`}><Label htmlFor={htmlFor}>{label}</Label>{children}</div>;
}

function NovaOS() {
  const { os } = Route.useSearch();
  const listaOrdens = useOrdens();
  const listaClientes = useClientes();
  const { perfil = perfilInicial } = useEstoque();
  const existente = os ? listaOrdens.find((o) => o.numero === os) : undefined;

  const numeroGerado = useMemo(
    () => existente?.numero ?? proximoNumeroOS(listaOrdens),
    [existente?.numero, listaOrdens],
  );
  const [numeroFixo, setNumeroFixo] = useState<string | null>(existente?.numero ?? null);
  const numero = numeroFixo ?? numeroGerado;
  const [status, setStatus] = useState<OSStatus>(existente?.status ?? "Em Orçamento");
  const [entrada, setEntrada] = useState(existente?.entrada ?? hoje());
  const [finalizacao, setFinalizacao] = useState(
    existente?.finalizacao ?? (existente && isOSFinalizada(existente.status) ? existente.entrada : ""),
  );
  const [cliente, setCliente] = useState<Cliente | null>(
    existente ? listaClientes.find((c) => c.nome === existente.cliente) ?? { id: "temp", nome: existente.cliente, documento: "", whatsapp: "", email: "", cep: "", endereco: "" } : null,
  );
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(false);
  const [aparelho, setAparelho] = useState({
    equipamento: existente?.equipamento ?? "",
    marcaModelo: existente?.aparelho ?? "",
    serie: existente?.serie ?? "",
    estado: existente?.estado ?? "",
    acessorios: existente?.acessorios ?? "",
  });
  const [defeitoRelatado, setDefeitoRelatado] = useState(existente?.defeito ?? "");
  const [sintomas, setSintomas] = useState<string[]>(existente?.sintomas ?? []);
  const [laudo, setLaudo] = useState(existente?.laudo ?? "");
  const [tecnico, setTecnico] = useState(existente?.tecnico ?? "");
  const [servico, setServico] = useState(existente?.servico ?? "");
  const [pecas, setPecas] = useState(existente?.pecas ?? "");
  const [garantia, setGarantia] = useState(existente?.garantia ?? "90 dias");
  const [observacoes, setObservacoes] = useState(existente?.observacoes ?? "");
  const [valorCobrado, setValorCobrado] = useState(existente?.valor ? String(existente.valor) : "");
  const [custoPeca, setCustoPeca] = useState(existente?.custoPeca ? String(existente.custoPeca) : "");
  const [gerando, setGerando] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const buscaDebounced = useDebouncedValue(busca, 300);
  const docRef = useRef<HTMLDivElement>(null);

  const valorNum = num(valorCobrado);
  const custoNum = num(custoPeca);
  const lucroServico = valorNum - custoNum;

  const toggleSintoma = (s: string) =>
    setSintomas((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  const mudarStatus = (s: OSStatus) => {
    setStatus(s);
    if (isOSFinalizada(s) && !finalizacao) setFinalizacao(hoje());
  };

  const resultados = useMemo(() => {
    const t = normalizarBuscaSegura(escaparBuscaIlike(buscaDebounced));
    if (!t) return [];
    const d = t.replace(/\D/g, "");
    return listaClientes
      .filter((c) => c.nome.toLowerCase().includes(t) || (d && (c.documento.replace(/\D/g, "").includes(d) || c.whatsapp.replace(/\D/g, "").includes(d))))
      .slice(0, 6);
  }, [buscaDebounced, modal, listaClientes]);

  const salvar = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!cliente) { toast.error("Selecione um cliente."); return; }

    const rate = verificarRateLimit("criar_os", getTenantUserId());
    if (!rate.permitido) {
      toast.error(rate.erro);
      return;
    }

    const dataFinal = finalizacao || (isOSFinalizada(status) ? hoje() : "");
    const payloadOS = {
      numero,
      cliente: cliente.nome,
      aparelho: aparelho.marcaModelo.trim(),
      defeito: defeitoRelatado.trim() || "Em avaliação",
      status,
      entrada,
      finalizacao: dataFinal,
      valor: valorNum,
      custoPeca: custoNum,
      equipamento: aparelho.equipamento,
      serie: aparelho.serie,
      estado: aparelho.estado,
      acessorios: aparelho.acessorios,
      sintomas,
      laudo,
      tecnico,
      servico,
      pecas,
      garantia,
      observacoes,
    };

    const validacao = ordemServicoSchema.safeParse(payloadOS);
    if (!validacao.success) {
      toast.error(validacao.error.issues[0]?.message ?? "Verifique os dados da Ordem de Serviço.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (dataFinal !== finalizacao) setFinalizacao(dataFinal);
      setNumeroFixo(numero);
      salvarOrdem(validacao.data);
      toast.success(existente ? `${numero} atualizada com dados financeiros.` : `${numero} aberta com sucesso.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const ap = (k: keyof typeof aparelho) => ({
    value: aparelho[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setAparelho((a) => ({ ...a, [k]: e.target.value })),
  });

  const docData: OSDocumentData = {
    numero, status, entrada, finalizacao, cliente, aparelho,
    defeito: defeitoRelatado, sintomas, laudo, tecnico, servico, pecas, garantia, observacoes,
    valor: valorNum, custoPeca: custoNum, empresa: perfil,
  };

  const imprimir = () => window.print();

  const baixarPDF = async () => {
    if (!docRef.current) return;
    setGerando(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
      const canvas = await html2canvas(docRef.current, { scale: 2, backgroundColor: "#ffffff" });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const margin = 8;
      const maxW = 210 - margin * 2; // 194mm
      const maxH = 297 - margin * 2; // 281mm
      let w = maxW;
      let h = (canvas.height * w) / canvas.width;
      if (h > maxH) {
        h = maxH;
        w = (canvas.width * h) / canvas.height;
      }
      const x = margin + (maxW - w) / 2;
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", x, margin, w, h);
      pdf.save(`${numero}.pdf`);
    } catch {
      toast.error("Não foi possível gerar o PDF.");
    } finally {
      setGerando(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title={existente ? `Editar ${numero}` : "Nova Ordem de Serviço"} subtitle="Registre a entrada do aparelho, execução e valores financeiros da OS." />
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="lg" onClick={imprimir}><Printer className="mr-2 h-4 w-4" />Imprimir OS</Button>
          <Button type="button" size="lg" onClick={baixarPDF} disabled={gerando}><FileDown className="mr-2 h-4 w-4" />{gerando ? "Gerando..." : "Baixar em PDF"}</Button>
        </div>
      </div>
      <div className="os-print-holder" aria-hidden><OSDocument ref={docRef} data={docData} /></div>
      <form onSubmit={salvar} className="grid max-w-5xl gap-6">
        <Section title="Dados da OS">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Número da OS"><Input value={numero} readOnly className="font-mono font-semibold text-primary" /></Field>
            <Field label="Status">
              <Select value={status} onValueChange={(v) => mudarStatus(v as OSStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusList.map((s) => (
                    <SelectItem key={s} value={s}>
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClass[s]}`}>
                        {s}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
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
                  {["Não Liga", "Não Carrega", "Tela com Defeito", "Sem Áudio",
                    "Superaquecimento", "Bateria Viciada/Estufada", "Câmera não Funciona", "Botões não Respondem"].map((s) => (
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

        <Section
          title="Valores e Dados Financeiros da OS"
          action={
            isOSCancelada(status) ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-3 py-1 text-xs font-semibold text-destructive">
                OS Cancelada · Ignorada no Financeiro
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <DollarSign className="size-3.5" /> Integração Financeira Automática
              </span>
            )
          }
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Valor Cobrado (R$)" htmlFor="valor-cobrado-servico">
              <Input
                id="valor-cobrado-servico"
                inputMode="decimal"
                placeholder="0,00"
                value={valorCobrado}
                onChange={(e) => setValorCobrado(e.target.value)}
              />
            </Field>
            <Field label="Custo de Peça (R$)" htmlFor="custo-peca-utilizada">
              <Input
                id="custo-peca-utilizada"
                inputMode="decimal"
                placeholder="0,00"
                value={custoPeca}
                onChange={(e) => setCustoPeca(e.target.value)}
              />
            </Field>
            <div className="flex flex-col justify-center rounded-lg border bg-accent/40 px-4 py-3">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Lucro Líquido do Serviço</span>
              <span
                className={`mt-0.5 font-display text-2xl font-bold ${
                  isOSCancelada(status)
                    ? "text-muted-foreground line-through"
                    : lucroServico < 0
                      ? "text-destructive"
                      : "text-primary"
                }`}
              >
                {brl(lucroServico)}
              </span>
            </div>
          </div>
          {isOSCancelada(status) ? (
            <p className="mt-3 text-xs font-medium text-destructive">
              Esta OS está com status <strong>Cancelada</strong>: o valor fica preservado no histórico de Ordens de Serviço, mas é totalmente excluído do faturamento e lucro no módulo <strong>Financeiro</strong>.
            </p>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              Ao marcar a OS como <strong>Concluída</strong>, <strong>Finalizado</strong> ou <strong>Entregue</strong>, estes valores alimentam automaticamente os dashboards e relatórios do módulo <strong>Financeiro</strong>.
            </p>
          )}
        </Section>

        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={isSubmitting}>
            <Check className="size-4" />{" "}
            {isSubmitting ? "Salvando..." : existente ? "Salvar alterações" : "Abrir OS"}
          </Button>
        </div>
      </form>

      <CadastroRapido open={modal} onOpenChange={setModal} onSave={(c) => { salvarCliente(c); setCliente(c); setModal(false); }} />
    </>
  );
}

function CadastroRapido({ open, onOpenChange, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; onSave: (c: Cliente) => void }) {
  const [f, setF] = useState({ nome: "", documento: "", whatsapp: "", email: "", cep: "", endereco: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const campos: [keyof typeof f, string][] = [["nome", "Nome Completo"], ["documento", "CPF/CNPJ"], ["whatsapp", "Telefone/WhatsApp"], ["email", "E-mail"]];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Cadastro rápido de cliente</DialogTitle></DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isSubmitting) return;
            const validacao = clienteSchema.safeParse(f);
            if (!validacao.success) {
              toast.error(validacao.error.issues[0]?.message ?? "Dados do cliente inválidos.");
              return;
            }
            setIsSubmitting(true);
            try {
              onSave({ id: crypto.randomUUID(), ...validacao.data });
              setF({ nome: "", documento: "", whatsapp: "", email: "", cep: "", endereco: "" });
            } finally {
              setIsSubmitting(false);
            }
          }}
          className="grid gap-4"
        >
          {campos.map(([k, l]) => (
            <Field key={k} label={l}><Input required={k === "nome"} maxLength={160} type={k === "email" ? "email" : "text"} value={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} /></Field>
          ))}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Cadastrando..." : "Cadastrar e selecionar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
