import { useEffect, useState } from "react";
import { z } from "zod";

// ============================================================================
// 1. PREVENÇÃO CONTRA SQL INJECTION (.ilike) E XSS
// ============================================================================

/**
 * Escapa caracteres curinga e metacaracteres SQL (%, _, ', ;, --, \)
 * antes de qualquer busca .ilike() ou filtro textual.
 */
export function escaparBuscaIlike(termo: string): string {
  if (!termo) return "";
  return termo
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/'/g, "''")
    .replace(/;/g, "")
    .replace(/--/g, "")
    .trim()
    .slice(0, 120);
}

/**
 * Sanitiza strings removendo tags HTML/scripts (<script>, on*=, javascript:)
 * para prevenção estrita contra XSS em telas e folhas de impressão.
 */
export function sanitizarTexto(valor: string, maxLen = 500): string {
  if (typeof valor !== "string") return "";
  return valor
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/\bon\w+\s*=/gi, "")
    .trim()
    .slice(0, maxLen);
}

/**
 * Normaliza um termo de busca no frontend aplicando sanitização + escape de curingas.
 */
export function normalizarBuscaSegura(termo: string): string {
  return sanitizarTexto(termo, 120).toLowerCase();
}

// ============================================================================
// 2. HOOK DE DEBOUNCE DE 300ms PARA BUSCAS
// ============================================================================

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

// ============================================================================
// 3. REQUEST RATE LIMITING (LIMITE DE TAXA DE REQUISIÇÕES POR MINUTO)
// ============================================================================

export type TipoAcaoRateLimit =
  | "login"
  | "criar_os"
  | "venda"
  | "edge_function"
  | "cliente"
  | "estoque"
  | "fornecedor"
  | "caixa"
  | "perfil";

const LIMITES_POR_MINUTO: Record<TipoAcaoRateLimit, { maxPorMinuto: number; janelaMs: number }> = {
  login: { maxPorMinuto: 8, janelaMs: 60_000 },
  criar_os: { maxPorMinuto: 15, janelaMs: 60_000 },
  venda: { maxPorMinuto: 15, janelaMs: 60_000 },
  edge_function: { maxPorMinuto: 10, janelaMs: 60_000 },
  cliente: { maxPorMinuto: 20, janelaMs: 60_000 },
  estoque: { maxPorMinuto: 25, janelaMs: 60_000 },
  fornecedor: { maxPorMinuto: 20, janelaMs: 60_000 },
  caixa: { maxPorMinuto: 20, janelaMs: 60_000 },
  perfil: { maxPorMinuto: 12, janelaMs: 60_000 },
};

const historicoRequisicoes = new Map<string, number[]>();

export const MENSAGEM_RATE_LIMIT = "Muitas tentativas em sequência, aguarde alguns segundos";

export function verificarRateLimit(
  acao: TipoAcaoRateLimit,
  identificador = "sessao-atual",
): { permitido: boolean; erro?: string; segundosRestantes?: number } {
  const cfg = LIMITES_POR_MINUTO[acao];
  const chave = `${acao}:${identificador}`;
  const agora = Date.now();
  const registros = (historicoRequisicoes.get(chave) ?? []).filter(
    (ts) => agora - ts < cfg.janelaMs,
  );

  // Evita cliques duplicados em menos de 400ms em operações de escrita
  if (acao !== "login" && registros.length > 0) {
    const ultimo = registros[registros.length - 1]!;
    if (agora - ultimo < 400) {
      return {
        permitido: false,
        erro: MENSAGEM_RATE_LIMIT,
        segundosRestantes: 1,
      };
    }
  }

  if (registros.length >= cfg.maxPorMinuto) {
    const maisAntigo = registros[0]!;
    const segundosRestantes = Math.max(1, Math.ceil((cfg.janelaMs - (agora - maisAntigo)) / 1000));
    historicoRequisicoes.set(chave, registros);
    return {
      permitido: false,
      erro: MENSAGEM_RATE_LIMIT,
      segundosRestantes,
    };
  }

  registros.push(agora);
  historicoRequisicoes.set(chave, registros);
  return { permitido: true };
}

export function resetarRateLimitParaTestes() {
  historicoRequisicoes.clear();
}

// ============================================================================
// 4. VALIDAÇÃO DE UPLOAD DE LOGO (PNG, JPG, WEBP <= 5MB e pasta {user_id}/)
// ============================================================================

export const TIPOS_LOGO_PERMITIDOS = ["image/png", "image/jpeg", "image/webp"] as const;
export const TAMANHO_MAXIMO_LOGO_BYTES = 5 * 1024 * 1024; // 5MB

export function validarArquivoLogo(
  file: { name: string; type: string; size: number },
  userId: string,
): {
  valido: boolean;
  erro?: string;
  extensao?: "png" | "jpg" | "webp";
  caminhoStorage?: string;
} {
  if (!TIPOS_LOGO_PERMITIDOS.includes(file.type as (typeof TIPOS_LOGO_PERMITIDOS)[number])) {
    return {
      valido: false,
      erro: "Formato inválido. Envie apenas imagens nos formatos PNG, JPG ou WEBP.",
    };
  }

  const extMatch = file.name.toLowerCase().match(/\.(png|jpe?g|webp)$/);
  if (!extMatch) {
    return {
      valido: false,
      erro: "Extensão de arquivo inválida. Utilize apenas .png, .jpg, .jpeg ou .webp.",
    };
  }

  if (file.size > TAMANHO_MAXIMO_LOGO_BYTES) {
    return {
      valido: false,
      erro: "O arquivo excede o tamanho máximo permitido de 5MB.",
    };
  }

  if (file.size <= 0) {
    return {
      valido: false,
      erro: "O arquivo de imagem selecionado está vazio.",
    };
  }

  const extensao: "png" | "jpg" | "webp" =
    file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "");
  const caminhoStorage = `${safeUserId}/logo-${Date.now()}.${extensao}`;

  return {
    valido: true,
    extensao,
    caminhoStorage,
  };
}

// ============================================================================
// 5. SCHEMAS DO ZOD PARA TODOS OS FORMULÁRIOS DO SISTEMA
// ============================================================================

const regexCnpjOuCpf = /^(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{11}|\d{14})?$/;

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(3, "Informe um e-mail válido.")
    .max(160, "O e-mail pode ter no máximo 160 caracteres.")
    .email("Formato de e-mail inválido."),
  senha: z
    .string()
    .min(1, "Informe a senha.")
    .max(128, "A senha pode ter no máximo 128 caracteres."),
});

export const criarUsuarioAdminSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, "O nome deve ter pelo menos 2 caracteres.")
    .max(120, "O nome pode ter no máximo 120 caracteres.")
    .transform((v) => sanitizarTexto(v, 120)),
  email: z
    .string()
    .trim()
    .max(160, "O e-mail pode ter no máximo 160 caracteres.")
    .email("Informe um e-mail válido."),
  senha: z
    .string()
    .min(6, "A senha deve ter no mínimo 6 caracteres.")
    .max(128, "A senha pode ter no máximo 128 caracteres."),
});

export const alterarSenhaSchema = z.object({
  novaSenha: z
    .string()
    .min(6, "A nova senha deve ter no mínimo 6 caracteres.")
    .max(128, "A senha pode ter no máximo 128 caracteres."),
});

export const editarUsuarioSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, "O nome deve ter pelo menos 2 caracteres.")
    .max(120, "O nome pode ter no máximo 120 caracteres.")
    .transform((v) => sanitizarTexto(v, 120)),
  email: z
    .string()
    .trim()
    .max(160, "O e-mail pode ter no máximo 160 caracteres.")
    .email("Informe um e-mail válido."),
});

export const clienteSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, "Informe o nome completo do cliente.")
    .max(140, "O nome pode ter no máximo 140 caracteres.")
    .transform((v) => sanitizarTexto(v, 140)),
  documento: z
    .string()
    .trim()
    .max(20, "CPF/CNPJ inválido.")
    .refine((v) => !v || regexCnpjOuCpf.test(v), "Formato de CPF ou CNPJ inválido.")
    .transform((v) => sanitizarTexto(v, 20)),
  whatsapp: z
    .string()
    .trim()
    .max(25, "Telefone pode ter no máximo 25 caracteres.")
    .transform((v) => sanitizarTexto(v, 25)),
  email: z
    .string()
    .trim()
    .max(160, "O e-mail pode ter no máximo 160 caracteres.")
    .refine((v) => !v || z.string().email().safeParse(v).success, "E-mail do cliente inválido."),
  cep: z
    .string()
    .trim()
    .max(12, "CEP pode ter no máximo 12 caracteres.")
    .transform((v) => sanitizarTexto(v, 12)),
  endereco: z
    .string()
    .trim()
    .max(250, "Endereço pode ter no máximo 250 caracteres.")
    .transform((v) => sanitizarTexto(v, 250)),
});

export const ordemServicoSchema = z.object({
  numero: z.string().trim().min(1).max(30),
  cliente: z
    .string()
    .trim()
    .min(1, "Selecione um cliente.")
    .max(140)
    .transform((v) => sanitizarTexto(v, 140)),
  aparelho: z
    .string()
    .trim()
    .min(1, "Informe a marca/modelo do aparelho.")
    .max(140, "Marca/modelo pode ter no máximo 140 caracteres.")
    .transform((v) => sanitizarTexto(v, 140)),
  defeito: z
    .string()
    .trim()
    .max(1000, "Descrição do defeito muito longa (máx. 1000 caracteres).")
    .transform((v) => sanitizarTexto(v || "Em avaliação", 1000)),
  status: z.enum([
    "Na Bancada",
    "Em Orçamento",
    "Aguardando Peça",
    "Concluída",
    "Finalizado",
    "Entregue",
    "Cancelada",
  ]),
  entrada: z.string().trim().min(8).max(20),
  finalizacao: z.string().trim().max(20).optional(),
  valor: z
    .number({ invalid_type_error: "Valor cobrado inválido." })
    .min(0, "O valor cobrado não pode ser negativo.")
    .max(1_000_000, "Valor acima do limite permitido."),
  custoPeca: z
    .number({ invalid_type_error: "Custo de peça inválido." })
    .min(0, "O custo da peça não pode ser negativo.")
    .max(1_000_000, "Custo acima do limite permitido."),
  equipamento: z
    .string()
    .max(100)
    .optional()
    .transform((v) => sanitizarTexto(v ?? "", 100)),
  serie: z
    .string()
    .max(80)
    .optional()
    .transform((v) => sanitizarTexto(v ?? "", 80)),
  estado: z
    .string()
    .max(600)
    .optional()
    .transform((v) => sanitizarTexto(v ?? "", 600)),
  acessorios: z
    .string()
    .max(300)
    .optional()
    .transform((v) => sanitizarTexto(v ?? "", 300)),
  sintomas: z.array(z.string().max(80)).max(20).optional(),
  laudo: z
    .string()
    .max(1200)
    .optional()
    .transform((v) => sanitizarTexto(v ?? "", 1200)),
  tecnico: z
    .string()
    .max(120)
    .optional()
    .transform((v) => sanitizarTexto(v ?? "", 120)),
  servico: z
    .string()
    .max(1200)
    .optional()
    .transform((v) => sanitizarTexto(v ?? "", 1200)),
  pecas: z
    .string()
    .max(400)
    .optional()
    .transform((v) => sanitizarTexto(v ?? "", 400)),
  garantia: z
    .string()
    .max(80)
    .optional()
    .transform((v) => sanitizarTexto(v ?? "", 80)),
  observacoes: z
    .string()
    .max(1000)
    .optional()
    .transform((v) => sanitizarTexto(v ?? "", 1000)),
});

export const produtoSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, "Informe o nome do produto.")
    .max(140, "O nome do produto pode ter no máximo 140 caracteres.")
    .transform((v) => sanitizarTexto(v, 140)),
  sku: z
    .string()
    .trim()
    .max(60, "O SKU pode ter no máximo 60 caracteres.")
    .transform((v) => sanitizarTexto(v, 60)),
  quantidade: z
    .number()
    .int("A quantidade deve ser um número inteiro.")
    .min(-10000, "Quantidade inválida.")
    .max(1_000_000, "Quantidade acima do limite."),
  custo: z
    .number()
    .min(0, "O valor de custo não pode ser negativo.")
    .max(1_000_000, "Valor de custo acima do limite."),
  venda: z
    .number()
    .min(0, "O valor de venda não pode ser negativo.")
    .max(1_000_000, "Valor de venda acima do limite."),
});

export const fornecedorSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, "Informe o nome da empresa/fornecedor.")
    .max(150, "O nome pode ter no máximo 150 caracteres.")
    .transform((v) => sanitizarTexto(v, 150)),
  cnpj: z
    .string()
    .trim()
    .max(20, "CNPJ inválido.")
    .refine((v) => !v || regexCnpjOuCpf.test(v), "Formato de CNPJ inválido.")
    .transform((v) => sanitizarTexto(v, 20)),
  telefone: z
    .string()
    .trim()
    .max(25, "Telefone pode ter no máximo 25 caracteres.")
    .transform((v) => sanitizarTexto(v, 25)),
  endereco: z
    .string()
    .trim()
    .max(250, "Endereço pode ter no máximo 250 caracteres.")
    .transform((v) => sanitizarTexto(v, 250)),
});

export const notaCompraSchema = z.object({
  numero: z
    .string()
    .trim()
    .min(1, "Informe o número da nota.")
    .max(60, "Número da nota pode ter no máximo 60 caracteres.")
    .transform((v) => sanitizarTexto(v, 60)),
  data: z.string().trim().min(8, "Informe a data da nota.").max(20),
  itens: z
    .array(
      z.object({
        produtoId: z.string().min(1),
        quantidade: z.number().int().min(1, "A quantidade deve ser maior que zero.").max(100_000),
        valorUnit: z.number().min(0, "O valor unitário não pode ser negativo.").max(1_000_000),
      }),
    )
    .min(1, "Adicione ao menos um produto com quantidade válida."),
});

export const vendaSchema = z.object({
  itens: z
    .array(
      z.object({
        produtoId: z.string().min(1),
        nome: z.string().min(1).max(140),
        quantidade: z.number().int().min(1).max(100_000),
        preco: z.number().min(0).max(1_000_000),
        custoUnit: z.number().min(0).max(1_000_000).optional(),
      }),
    )
    .min(1, "Adicione produtos à nota."),
  total: z.number().gt(0, "O valor total da venda deve ser maior que zero.").max(10_000_000),
  pagamentos: z
    .array(
      z.object({
        forma: z.enum(["Cartão de Crédito", "Cartão de Débito", "PIX", "Dinheiro"]),
        valor: z.number().gt(0).max(10_000_000),
        valorRecebido: z.number().min(0).max(10_000_000).optional(),
        troco: z.number().min(0).max(10_000_000).optional(),
      }),
    )
    .min(1, "Informe ao menos uma forma de pagamento válida."),
});

export const movimentacaoCaixaSchema = z.object({
  tipo: z.enum(["entrada", "saida"]),
  valor: z
    .number()
    .gt(0, "Informe um valor em R$ maior que zero.")
    .max(10_000_000, "Valor acima do limite permitido."),
  descricao: z
    .string()
    .trim()
    .min(2, "Informe a descrição ou motivo da movimentação.")
    .max(300, "A descrição pode ter no máximo 300 caracteres.")
    .transform((v) => sanitizarTexto(v, 300)),
  dataHora: z.string().trim().min(8).max(40),
});

export const perfilEmpresaSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, "Informe o Nome da Empresa.")
    .max(140, "O Nome da Empresa pode ter no máximo 140 caracteres.")
    .transform((v) => sanitizarTexto(v, 140)),
  cnpj: z
    .string()
    .trim()
    .max(20, "CNPJ inválido.")
    .refine((v) => !v || regexCnpjOuCpf.test(v), "Formato de CNPJ inválido.")
    .transform((v) => sanitizarTexto(v, 20)),
  telefone: z
    .string()
    .trim()
    .max(25, "Telefone pode ter no máximo 25 caracteres.")
    .transform((v) => sanitizarTexto(v, 25)),
  email: z
    .string()
    .trim()
    .max(160, "O e-mail pode ter no máximo 160 caracteres.")
    .refine((v) => !v || z.string().email().safeParse(v).success, "Formato de e-mail inválido."),
  endereco: z
    .string()
    .trim()
    .max(250, "O endereço pode ter no máximo 250 caracteres.")
    .transform((v) => sanitizarTexto(v, 250)),
  logo: z.string().max(8_000_000, "A imagem da logo excede o limite permitido."),
});

// ============================================================================
// 6. EXPIRAÇÃO AUTOMÁTICA DE SESSÃO POR INATIVIDADE (30 MINUTOS)
// ============================================================================

export const TEMPO_EXPIRACAO_INATIVIDADE_MS = 30 * 60 * 1000; // 30 minutos

