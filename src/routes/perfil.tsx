import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Building2, Check, ImagePlus, Trash2, Wrench, FileText } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useEstoque,
  setEstado,
  formatCNPJ,
  formatFone,
  perfilInicial,
  type PerfilEmpresa,
} from "@/lib/estoque";
import {
  validarArquivoLogo,
  perfilEmpresaSchema,
  verificarRateLimit,
} from "@/lib/security";
import { getTenantUserId, getSupabaseAuthHeaders } from "@/lib/auth";

export const Route = createFileRoute("/perfil")({
  head: () => ({
    meta: [
      { title: "AtosPro" },
      {
        name: "description",
        content: "Configuração da logo e dados cadastrais da assistência técnica para impressão de OS e PDF.",
      },
      { property: "og:title", content: "AtosPro" },
      {
        property: "og:description",
        content: "Configuração da logo e dados cadastrais da assistência técnica para impressão de OS e PDF.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaginaPerfilEmpresa,
});

function PaginaPerfilEmpresa() {
  const { perfil = perfilInicial } = useEstoque();
  const [form, setForm] = useState<PerfilEmpresa>({ ...perfil });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const inputLogoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm({ ...perfil });
  }, [perfil]);

  const atualizarCampo = (k: keyof PerfilEmpresa, valor: string) => {
    setForm((atual) => ({ ...atual, [k]: valor }));
  };

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || uploadingLogo) return;

    const userId = getTenantUserId();
    const rate = verificarRateLimit("perfil", userId);
    if (!rate.permitido) {
      toast.error(rate.erro);
      return;
    }

    // Validação estrita: apenas PNG, JPG e WEBP com tamanho máximo de 5MB e pasta isolada {user_id}/
    const validacaoLogo = validarArquivoLogo(file, userId);
    if (!validacaoLogo.valido || !validacaoLogo.caminhoStorage) {
      toast.error(validacaoLogo.erro ?? "Arquivo de logo inválido.");
      return;
    }

    setUploadingLogo(true);
    try {
      // Tenta enviar para o bucket store-logos na pasta isolada {user_id}/
      const authCfg = getSupabaseAuthHeaders();
      if (authCfg && authCfg.userId === userId) {
        try {
          await fetch(
            `${authCfg.url}/storage/v1/object/store-logos/${validacaoLogo.caminhoStorage}`,
            {
              method: "POST",
              headers: {
                apikey: authCfg.headers["apikey"]!,
                Authorization: authCfg.headers["Authorization"]!,
                "Content-Type": file.type,
                "x-upsert": "true",
              },
              body: file,
            },
          );
        } catch {
          // Segue com DataURL local para funcionamento imediato na impressão/PDF A4
        }
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === "string" ? reader.result : "";
        if (!dataUrl) return;
        const atualizado = { ...form, logo: dataUrl };
        setForm(atualizado);
        setEstado((est) => ({ ...est, perfil: atualizado }));
        toast.success(
          `Logo validada e salva na pasta isolada (${userId.slice(0, 8)}/…)!`,
        );
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingLogo(false);
    }
  };

  const removerLogo = () => {
    const atualizado = { ...form, logo: "" };
    setForm(atualizado);
    setEstado((est) => ({ ...est, perfil: atualizado }));
    toast.success("Logo removida. Ícone padrão restaurado.");
  };

  const salvarPerfil = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const userId = getTenantUserId();
    const rate = verificarRateLimit("perfil", userId);
    if (!rate.permitido) {
      toast.error(rate.erro);
      return;
    }

    const validacao = perfilEmpresaSchema.safeParse(form);
    if (!validacao.success) {
      toast.error(validacao.error.issues[0]?.message ?? "Verifique os dados do Perfil da Empresa.");
      return;
    }

    setIsSubmitting(true);
    try {
      const novoPerfil: PerfilEmpresa = validacao.data;
      setForm(novoPerfil);
      setEstado((est) => ({ ...est, perfil: novoPerfil }));
      toast.success("Perfil da Empresa salvo! Dados sincronizados com a Ordem de Serviço (Impressão e PDF).");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Perfil da Empresa"
        subtitle="Personalize a logo e os dados da sua assistência técnica. Essas informações são 100% isoladas na sua conta e aparecem no menu lateral e no cabeçalho da Ordem de Serviço."
      />

      <div className="grid gap-6 lg:grid-cols-5">
        {/* FORMULÁRIO DE DADOS E UPLOAD DE LOGO */}
        <form
          onSubmit={salvarPerfil}
          className="space-y-6 rounded-xl border bg-card p-6 shadow-card lg:col-span-3"
        >
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <Building2 className="size-5 text-primary" />
              Identidade Visual e Logo da Loja
            </h2>
            <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border bg-muted/30 p-4">
              <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl border bg-background shadow-sm">
                {form.logo ? (
                  <img
                    src={form.logo}
                    alt={form.nome || "Logo da Empresa"}
                    className="h-full w-full object-contain p-1"
                  />
                ) : (
                  <Wrench className="size-8 text-primary" />
                )}
              </div>

              <div className="space-y-2">
                <input
                  ref={inputLogoRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                  onChange={handleUploadLogo}
                  className="hidden"
                  id="upload-logo-input"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingLogo}
                    onClick={() => inputLogoRef.current?.click()}
                  >
                    <ImagePlus className="mr-1.5 size-4" />
                    {uploadingLogo
                      ? "Validando..."
                      : form.logo
                        ? "Trocar Logo da Loja"
                        : "Fazer Upload da Logo"}
                  </Button>
                  {form.logo && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={removerLogo}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="mr-1.5 size-4" />
                      Remover Logo
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Formatos permitidos: <strong>PNG, JPG e WEBP</strong> · Tamanho máximo: <strong>5MB</strong>.
                </p>
              </div>
            </div>
          </div>

          <div className="border-t pt-5">
            <h3 className="mb-4 font-display text-base font-semibold">
              Dados Cadastrais da Assistência
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="empresa-nome">Nome da Empresa</Label>
                <Input
                  id="empresa-nome"
                  maxLength={140}
                  placeholder="Ex.: AtosPro Assistência Técnica"
                  value={form.nome}
                  onChange={(e) => atualizarCampo("nome", e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="empresa-cnpj">CNPJ</Label>
                <Input
                  id="empresa-cnpj"
                  maxLength={20}
                  placeholder="00.000.000/0001-00"
                  value={form.cnpj}
                  onChange={(e) => atualizarCampo("cnpj", formatCNPJ(e.target.value))}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="empresa-telefone">Telefone / WhatsApp</Label>
                <Input
                  id="empresa-telefone"
                  maxLength={25}
                  placeholder="(11) 99999-0000"
                  value={form.telefone}
                  onChange={(e) => atualizarCampo("telefone", formatFone(e.target.value))}
                />
              </div>

              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="empresa-email">E-mail</Label>
                <Input
                  id="empresa-email"
                  type="email"
                  maxLength={160}
                  placeholder="contato@empresa.com.br"
                  value={form.email}
                  onChange={(e) => atualizarCampo("email", e.target.value)}
                />
              </div>

              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="empresa-endereco">Endereço Completo</Label>
                <Input
                  id="empresa-endereco"
                  maxLength={250}
                  placeholder="Rua, número, bairro, cidade/UF e CEP"
                  value={form.endereco}
                  onChange={(e) => atualizarCampo("endereco", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t pt-4">
            <Button type="submit" size="lg" disabled={isSubmitting}>
              <Check className="mr-2 size-4" />
              {isSubmitting ? "Salvando..." : "Salvar Perfil da Empresa"}
            </Button>
          </div>
        </form>

        {/* PRÉ-VISUALIZAÇÃO DO CABEÇALHO DA OS E DO MENU LATERAL */}
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-xl border bg-card p-6 shadow-card">
            <h3 className="flex items-center gap-2 font-display text-base font-semibold">
              <FileText className="size-4 text-primary" />
              Prévia no Cabeçalho da Ordem de Serviço (A4)
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Assim aparecerão os dados da sua loja ao clicar em <strong>Imprimir OS</strong> ou <strong>Baixar em PDF</strong>:
            </p>

            <div className="mt-4 rounded-lg border bg-white p-4 text-slate-900 shadow-sm">
              <div className="flex items-start justify-between gap-3 border-b-2 border-blue-700 pb-3">
                <div className="flex items-center gap-3">
                  {form.logo && (
                    <img
                      src={form.logo}
                      alt={form.nome}
                      className="h-12 w-12 shrink-0 rounded object-contain"
                    />
                  )}
                  <div className="text-xs leading-snug">
                    <p className="text-base font-extrabold text-blue-700">
                      {form.nome || "Nome da Empresa"}
                    </p>
                    <p className="text-[11px] text-slate-600">
                      {form.endereco || "Endereço não informado"}
                    </p>
                    <p className="text-[11px] text-slate-600">
                      {[form.telefone, form.email].filter(Boolean).join(" · ") || "Telefone · E-mail"}
                    </p>
                    <p className="text-[11px] font-medium text-slate-600">
                      CNPJ: {form.cnpj || "—"}
                    </p>
                  </div>
                </div>
                <div className="rounded border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-right">
                  <span className="block text-[9px] uppercase text-slate-500">Ordem de Serviço</span>
                  <span className="font-mono text-sm font-extrabold text-slate-900">OS-1</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
