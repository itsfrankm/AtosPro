import { useSyncExternalStore } from "react";
import {
  loginSchema,
  criarUsuarioAdminSchema,
  alterarSenhaSchema,
  editarUsuarioSchema,
  verificarRateLimit,
  TEMPO_EXPIRACAO_INATIVIDADE_MS,
} from "./security";

export type UserRole = "admin" | "usuario";

export type UsuarioSistema = {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  senha?: string;
  senhaHash?: string;
  role: UserRole;
  ativo: boolean;
  criadoEm: string;
};

export type RegistroTentativaLogin = {
  email: string;
  failed_attempts: number;
  locked_until: number | null; // timestamp ms
  last_attempt_at: number;
};

type AuthSnapshot = {
  usuarioAtual: UsuarioSistema | null;
  usuarios: UsuarioSistema[];
};

const STORAGE_KEY_USERS = "tecnofix_auth_users_v1";
const STORAGE_KEY_SESSION = "tecnofix_auth_session_v1";
const STORAGE_KEY_TOKEN = "tecnofix_auth_supabase_token_v1";
const STORAGE_KEY_ATTEMPTS = "tecnofix_login_attempts_v1";
const STORAGE_KEY_LAST_ACTIVITY = "tecnofix_auth_last_activity_v1";

export const MAX_TENTATIVAS_LOGIN = 5;
export const DURACAO_BLOQUEIO_LOGIN_MS = 15 * 60 * 1000; // 15 minutos

/** Função de hash para garantir que nenhuma senha seja persistida em texto claro no localStorage */
export function gerarHashSenhaSync(senha: string): string {
  let h = 0x811c9dc5;
  const str = `atospro_salt_${senha}`;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `sha256_mock_${(h >>> 0).toString(16).padStart(8, "0")}`;
}

export const ADMIN_PADRAO_UUID = "00000000-0000-0000-0000-000000000001";

export const ADMIN_PADRAO: UsuarioSistema = {
  id: ADMIN_PADRAO_UUID,
  user_id: ADMIN_PADRAO_UUID,
  nome: "Administrador (Dono)",
  email: "admin@atospro.com",
  senha: "",
  senhaHash: gerarHashSenhaSync("123456"),
  role: "admin",
  ativo: true,
  criadoEm: "2026-01-01 08:00",
};

/**
 * Padroniza o ID de qualquer usuário para que `id` e `user_id` sejam sempre
 * exatamente o mesmo UUID canônico vinculado ao `auth.users(id)`.
 */
export function padronizarUsuarioId(u: UsuarioSistema): UsuarioSistema {
  const canonicalId = (
    u.user_id ||
    (u.id?.startsWith("usr-") ? u.id.slice(4) : u.id) ||
    ADMIN_PADRAO_UUID
  ).trim();
  return {
    ...u,
    id: canonicalId,
    user_id: canonicalId,
  };
}

const usuariosIniciais: UsuarioSistema[] = [ADMIN_PADRAO];

function carregarUsuariosIniciais(): UsuarioSistema[] {
  if (typeof window === "undefined") return usuariosIniciais;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_USERS);
    if (!raw) return usuariosIniciais;
    const parsed = JSON.parse(raw) as UsuarioSistema[];
    if (!Array.isArray(parsed) || parsed.length === 0) return usuariosIniciais;
    const normalizados = parsed.map(padronizarUsuarioId);
    const temAdmin = normalizados.some((u) => u.role === "admin");
    if (!temAdmin) {
      return [ADMIN_PADRAO, ...normalizados];
    }
    return normalizados;
  } catch {
    return usuariosIniciais;
  }
}

function carregarSessaoInicial(listaUsuarios: UsuarioSistema[]): UsuarioSistema | null {
  if (typeof window === "undefined") return null;
  try {
    const lastAct = Number(window.localStorage.getItem(STORAGE_KEY_LAST_ACTIVITY) || "0");
    if (lastAct > 0 && Date.now() - lastAct > TEMPO_EXPIRACAO_INATIVIDADE_MS) {
      window.localStorage.removeItem(STORAGE_KEY_SESSION);
      window.localStorage.removeItem(STORAGE_KEY_TOKEN);
      window.localStorage.removeItem(STORAGE_KEY_LAST_ACTIVITY);
      return null;
    }

    const raw = window.localStorage.getItem(STORAGE_KEY_SESSION);
    if (!raw) return null;
    const parsed = padronizarUsuarioId(JSON.parse(raw) as UsuarioSistema);
    if (!parsed?.email) return null;
    const encontrado = listaUsuarios.find(
      (u) => u.user_id === parsed.user_id || u.email.toLowerCase() === parsed.email.toLowerCase(),
    );
    if (encontrado) {
      return encontrado.ativo ? padronizarUsuarioId(encontrado) : null;
    }
    return parsed.ativo !== false ? parsed : null;
  } catch {
    return null;
  }
}

function carregarMapaTentativas(): Record<string, RegistroTentativaLogin> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_ATTEMPTS);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, RegistroTentativaLogin>;
  } catch {
    return {};
  }
}

function salvarMapaTentativas(mapa: Record<string, RegistroTentativaLogin>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY_ATTEMPTS, JSON.stringify(mapa));
  } catch {
    // ignore
  }
}

let tentativasState: Record<string, RegistroTentativaLogin> = carregarMapaTentativas();
let usuariosState: UsuarioSistema[] = carregarUsuariosIniciais();
let usuarioAtualState: UsuarioSistema | null = carregarSessaoInicial(usuariosState);

let cachedAuthSnapshot: AuthSnapshot = {
  usuarioAtual: usuarioAtualState,
  usuarios: usuariosState,
};

const listeners = new Set<() => void>();
const tenantListeners = new Set<(userId: string) => void>();
const tenantInitCallbacks = new Set<(userId: string) => void>();
const tenantDeleteCallbacks = new Set<(userId: string) => void>();

export function getTenantUserId(): string {
  return usuarioAtualState?.user_id || ADMIN_PADRAO.user_id;
}

export function isDemoOwnerTenant(userId: string): boolean {
  return userId === ADMIN_PADRAO.user_id;
}

export function onTenantChange(cb: (userId: string) => void): () => void {
  tenantListeners.add(cb);
  return () => tenantListeners.delete(cb);
}

export function onTenantInitBlank(cb: (userId: string) => void): () => void {
  tenantInitCallbacks.add(cb);
  return () => tenantInitCallbacks.delete(cb);
}

export function onTenantDelete(cb: (userId: string) => void): () => void {
  tenantDeleteCallbacks.add(cb);
  return () => tenantDeleteCallbacks.delete(cb);
}

export function formatarTempoBloqueio(segundos: number): string {
  const s = Math.max(0, Math.ceil(segundos));
  const min = Math.floor(s / 60);
  const seg = s % 60;
  if (min <= 0) return `${seg}s`;
  return `${min}m ${String(seg).padStart(2, "0")}s`;
}

export function obterStatusBloqueioEmail(emailInput: string): {
  bloqueado: boolean;
  falhas: number;
  bloqueadoAte: number | null;
  segundosRestantes: number;
} {
  const email = emailInput.trim().toLowerCase();
  if (!email) {
    return { bloqueado: false, falhas: 0, bloqueadoAte: null, segundosRestantes: 0 };
  }

  const reg = tentativasState[email];
  if (!reg) {
    return { bloqueado: false, falhas: 0, bloqueadoAte: null, segundosRestantes: 0 };
  }

  const agora = Date.now();
  if (reg.locked_until && reg.locked_until > agora) {
    const segundosRestantes = Math.max(1, Math.ceil((reg.locked_until - agora) / 1000));
    return {
      bloqueado: true,
      falhas: reg.failed_attempts,
      bloqueadoAte: reg.locked_until,
      segundosRestantes,
    };
  }

  return {
    bloqueado: false,
    falhas: reg.locked_until ? 0 : reg.failed_attempts,
    bloqueadoAte: null,
    segundosRestantes: 0,
  };
}

export function registrarTentativaLoginLocal(
  emailInput: string,
  sucesso: boolean,
): {
  bloqueado: boolean;
  falhas: number;
  bloqueadoAte: number | null;
  segundosRestantes: number;
} {
  const email = emailInput.trim().toLowerCase();
  const agora = Date.now();
  const atual = tentativasState[email];

  // Se estiver bloqueado no momento, mantém o bloqueio mesmo se a senha estiver certa
  if (atual?.locked_until && atual.locked_until > agora) {
    const segundosRestantes = Math.max(1, Math.ceil((atual.locked_until - agora) / 1000));
    return {
      bloqueado: true,
      falhas: atual.failed_attempts,
      bloqueadoAte: atual.locked_until,
      segundosRestantes,
    };
  }

  // Ao logar com sucesso após o prazo de bloqueio, zera o contador de falhas
  if (sucesso) {
    delete tentativasState[email];
    salvarMapaTentativas(tentativasState);
    void sincronizarTentativaSupabase(email, true);
    return { bloqueado: false, falhas: 0, bloqueadoAte: null, segundosRestantes: 0 };
  }

  // Se o bloqueio anterior expirou, reinicia a contagem a partir de 1
  const falhasAnteriores =
    atual && (!atual.locked_until || atual.locked_until > agora) ? atual.failed_attempts : 0;
  const novasFalhas = falhasAnteriores + 1;
  const bloqueadoAte =
    novasFalhas >= MAX_TENTATIVAS_LOGIN ? agora + DURACAO_BLOQUEIO_LOGIN_MS : null;

  tentativasState[email] = {
    email,
    failed_attempts: novasFalhas,
    locked_until: bloqueadoAte,
    last_attempt_at: agora,
  };
  salvarMapaTentativas(tentativasState);
  void sincronizarTentativaSupabase(email, false);

  const segundosRestantes = bloqueadoAte
    ? Math.max(1, Math.ceil((bloqueadoAte - agora) / 1000))
    : 0;

  return {
    bloqueado: Boolean(bloqueadoAte),
    falhas: novasFalhas,
    bloqueadoAte,
    segundosRestantes,
  };
}

export function limparTentativasLoginParaTestes() {
  tentativasState = {};
  salvarMapaTentativas(tentativasState);
}

/** Desbloqueia o login para o administrador principal evitando ataques de DoS por terceiros na tela de login */
export function desbloquearLoginAdmin(emailInput: string): boolean {
  const email = emailInput.trim().toLowerCase();
  if (tentativasState[email]) {
    delete tentativasState[email];
    salvarMapaTentativas(tentativasState);
    return true;
  }
  return false;
}

async function sincronizarTentativaSupabase(email: string, sucesso: boolean): Promise<void> {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return;
  try {
    await fetch(`${url.replace(/\/+$/, "")}/rest/v1/rpc/register_login_attempt?apikey=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: getSupabaseRequestHeaders(key),
      body: JSON.stringify({ _email: email, _success: sucesso }),
    });
  } catch {
    // fallback local já salvo
  }
}

export function registrarAtividadeSessao() {
  if (typeof window === "undefined" || !usuarioAtualState) return;
  try {
    window.localStorage.setItem(STORAGE_KEY_LAST_ACTIVITY, String(Date.now()));
  } catch {
    // ignore
  }
}

export function verificarExpiracaoSessaoPorInatividade(): boolean {
  if (typeof window === "undefined" || !usuarioAtualState) return false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_LAST_ACTIVITY);
    const ultimaAtividade = raw ? Number(raw) : Date.now();
    if (Date.now() - ultimaAtividade >= TEMPO_EXPIRACAO_INATIVIDADE_MS) {
      realizarLogout();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function sanitizarUsuarioParaArmazenamento(u: UsuarioSistema): UsuarioSistema {
  const hash = u.senhaHash || (u.senha ? gerarHashSenhaSync(u.senha) : undefined);
  return {
    ...u,
    senha: "", // Nunca persiste senha em texto claro no localStorage
    ...(hash ? { senhaHash: hash } : {}),
  };
}

function salvarNoStorage() {
  if (typeof window === "undefined") return;
  try {
    const usuariosParaSalvar = usuariosState.map(sanitizarUsuarioParaArmazenamento);
    window.localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(usuariosParaSalvar));
    if (usuarioAtualState) {
      const sessaoParaSalvar = sanitizarUsuarioParaArmazenamento(usuarioAtualState);
      window.localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(sessaoParaSalvar));
      window.localStorage.setItem(STORAGE_KEY_LAST_ACTIVITY, String(Date.now()));
    } else {
      window.localStorage.removeItem(STORAGE_KEY_SESSION);
      window.localStorage.removeItem(STORAGE_KEY_LAST_ACTIVITY);
    }
  } catch {
    // ignore storage errors
  }
}

function emitAuth(notificarTrocaTenant = false) {
  cachedAuthSnapshot = {
    usuarioAtual: usuarioAtualState,
    usuarios: usuariosState,
  };
  salvarNoStorage();
  if (notificarTrocaTenant) {
    const activeTenantId = getTenantUserId();
    tenantListeners.forEach((cb) => cb(activeTenantId));
  }
  listeners.forEach((l) => l());
}

function formatarDataHoraAtual(iso?: string): string {
  const agora = iso ? new Date(iso) : new Date();
  if (Number.isNaN(agora.getTime())) return formatarDataHoraAtual();
  const yyyy = agora.getFullYear();
  const mm = String(agora.getMonth() + 1).padStart(2, "0");
  const dd = String(agora.getDate()).padStart(2, "0");
  const hh = String(agora.getHours()).padStart(2, "0");
  const min = String(agora.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

const DEFAULT_SUPABASE_URL = "https://bnurkbuijtundaaqrgrl.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJudXJrYnVpanR1bmRhYXFyZ3JsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzNTg1NzYsImV4cCI6MjEwODkzNDU3Nn0.dD20l_JEtyqf_7g6TXzLO9oHTC-GwjYJIXXQgXRYbW8";

export function getSupabaseConfig() {
  let url = (import.meta.env["VITE_SUPABASE_URL"] as string | undefined)?.trim();
  let key = (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined)?.trim();

  // Se a URL estiver vazia, for da Lovable legada ou diferente do projeto oficial do Supabase:
  if (!url || url.includes("lovable.cloud") || !url.includes("bnurkbuijtundaaqrgrl")) {
    url = DEFAULT_SUPABASE_URL;
  }

  // Se a chave estiver vazia, nao pertencer a este projeto ou for o token legado da Lovable:
  if (!key || (!key.includes("bnurkbuijtundaaqrgrl") && !key.startsWith("sb_publishable_"))) {
    key = DEFAULT_SUPABASE_ANON_KEY;
  }

  return { url, key };
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY_TOKEN);
  } catch {
    return null;
  }
}

function setAccessToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) {
      window.localStorage.setItem(STORAGE_KEY_TOKEN, token);
    } else {
      window.localStorage.removeItem(STORAGE_KEY_TOKEN);
    }
  } catch {
    // ignore
  }
}

function getSupabaseRequestHeaders(key: string, userToken?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: key,
    "Content-Type": "application/json",
  };
  if (userToken) {
    headers["Authorization"] = `Bearer ${userToken}`;
  } else if (key) {
    headers["Authorization"] = `Bearer ${key}`;
  }
  return headers;
}

export function getSupabaseAuthHeaders(): {
  url: string;
  userId: string;
  headers: Record<string, string>;
} | null {
  const { url, key } = getSupabaseConfig();
  const token = getAccessToken();
  const userId = usuarioAtualState?.user_id;
  if (!url || !key || !token || !userId) return null;
  return {
    url: url.replace(/\/+$/, ""),
    userId,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
}

export async function sincronizarUsuariosSupabase(): Promise<void> {
  const authCfg = getSupabaseAuthHeaders();
  if (!authCfg) return;

  try {
    const [profilesResp, rolesResp] = await Promise.all([
      fetch(`${authCfg.url}/rest/v1/profiles?select=*&order=created_at.desc`, {
        headers: authCfg.headers,
      }),
      fetch(`${authCfg.url}/rest/v1/user_roles?select=*`, {
        headers: authCfg.headers,
      }),
    ]);

    if (!profilesResp.ok) return;
    const profilesData = (await profilesResp.json()) as Array<{
      id: string;
      user_id: string;
      nome: string;
      email: string;
      role: UserRole;
      ativo: boolean;
      created_at: string;
    }>;

    const rolesMap = new Map<string, UserRole>();
    if (rolesResp.ok) {
      const rolesData = (await rolesResp.json()) as Array<{
        user_id: string;
        role: UserRole;
      }>;
      for (const r of rolesData) {
        rolesMap.set(r.user_id, r.role === "admin" ? "admin" : "usuario");
      }
    }

    if (!Array.isArray(profilesData) || profilesData.length === 0) return;

    const mesclados: UsuarioSistema[] = [...usuariosState];
    for (const p of profilesData) {
      const roleFinal = rolesMap.get(p.user_id) ?? (p.role === "admin" ? "admin" : "usuario");
      const idx = mesclados.findIndex(
        (u) => u.user_id === p.user_id || u.email.toLowerCase() === p.email.toLowerCase(),
      );
      if (idx >= 0) {
        mesclados[idx] = {
          ...mesclados[idx]!,
          id: p.user_id,
          user_id: p.user_id,
          nome: p.nome,
          email: p.email.toLowerCase(),
          role: roleFinal,
          ativo: p.ativo !== false,
        };
      } else {
        mesclados.push({
          id: p.user_id,
          user_id: p.user_id,
          nome: p.nome,
          email: p.email.toLowerCase(),
          role: roleFinal,
          ativo: p.ativo !== false,
          criadoEm: formatarDataHoraAtual(p.created_at),
        });
      }
    }

    usuariosState = mesclados;

    if (usuarioAtualState) {
      const atualizado = usuariosState.find(
        (u) => u.email.toLowerCase() === usuarioAtualState!.email.toLowerCase(),
      );
      if (atualizado && !atualizado.ativo) {
        usuarioAtualState = null;
        setAccessToken(null);
        emitAuth(true);
        return;
      } else if (atualizado) {
        usuarioAtualState = atualizado;
      }
    }

    emitAuth(false);
  } catch {
    // Mantém estado local caso offline
  }
}

interface AdminEdgeResponse {
  user?: { id?: string | undefined; email?: string | undefined } | undefined;
  profile?: { id?: string | undefined } | undefined;
}

async function invocarEdgeFunctionAdmin(payload: Record<string, unknown>): Promise<{
  ok: boolean;
  data?: AdminEdgeResponse | null;
  erro?: string;
}> {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) {
    return { ok: true, data: null };
  }

  const authCfg = getSupabaseAuthHeaders();
  if (authCfg) {
    try {
      const resp = await fetch(`${authCfg.url}/functions/v1/admin-users`, {
        method: "POST",
        headers: authCfg.headers,
        body: JSON.stringify(payload),
      });

      if (resp.ok) {
        const data = await resp.json();
        return { ok: true, data };
      }
    } catch {
      // Segue para fallback REST
    }
  }

  // Fallback REST API nativa do Supabase (opera sem precisar de Edge Function implantada)
  try {
    const baseUrl = url.replace(/\/+$/, "");

    if (payload["action"] === "create") {
      const email = String(payload["email"] || "");
      const password = String(payload["password"] || "");
      const nome = String(payload["nome"] || "");

      const signupResp = await fetch(`${baseUrl}/auth/v1/signup?apikey=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: getSupabaseRequestHeaders(key),
        body: JSON.stringify({
          email,
          password,
          data: { nome, role: "usuario" },
        }),
      });

      if (signupResp.ok) {
        const signupData = await signupResp.json();
        const createdUserId: string | undefined =
          signupData?.user?.id || signupData?.id;
        return {
          ok: true,
          data: {
            user: {
              id: createdUserId,
              email: signupData?.user?.email || signupData?.email || email,
            },
            profile: { id: createdUserId },
          },
        };
      } else {
        const errJson = await signupResp.json().catch(() => null);
        return {
          ok: false,
          erro:
            errJson?.msg ||
            errJson?.error_description ||
            errJson?.message ||
            "Erro ao registrar usuário no Supabase.",
        };
      }
    }

    const restHeaders = authCfg ? authCfg.headers : getSupabaseRequestHeaders(key);

    if (payload["action"] === "update_password") {
      const targetUserId = String(payload["userId"] || "");
      const targetEmail = String(payload["email"] || "");
      const newPassword = String(payload["password"] || "");

      // 1. Se o próprio usuário logado estiver alterando sua senha, atualiza também pela API de usuário do Supabase Auth
      if (authCfg && authCfg.userId === targetUserId) {
        try {
          await fetch(`${baseUrl}/auth/v1/user`, {
            method: "PUT",
            headers: authCfg.headers,
            body: JSON.stringify({ password: newPassword }),
          });
        } catch {
          // Continua para RPC
        }
      }

      // 2. Chama a RPC admin_alterar_senha_usuario no Supabase (com fallback para anon key caso o JWT local tenha expirado)
      const rpcBody = JSON.stringify({
        _target_user_id: targetUserId,
        _new_password: newPassword,
        _target_email: targetEmail,
      });

      let rpcResp = await fetch(`${baseUrl}/rest/v1/rpc/admin_alterar_senha_usuario`, {
        method: "POST",
        headers: restHeaders,
        body: rpcBody,
      });

      if (!rpcResp.ok && authCfg) {
        rpcResp = await fetch(`${baseUrl}/rest/v1/rpc/admin_alterar_senha_usuario`, {
          method: "POST",
          headers: getSupabaseRequestHeaders(key),
          body: rpcBody,
        });
      }

      if (rpcResp.ok) {
        return { ok: true, data: null };
      }

      const rpcErr = await rpcResp.json().catch(() => null);
      return {
        ok: false,
        erro:
          rpcErr?.message ||
          rpcErr?.error_description ||
          rpcErr?.msg ||
          "Erro ao alterar a senha no Supabase.",
      };
    }

    if (payload["action"] === "update") {
      const targetUserId = String(payload["userId"] || "");
      const oldEmail = String(payload["oldEmail"] || "");
      const novoNome = String(payload["nome"] || "");
      const novoEmail = String(payload["email"] || "").trim().toLowerCase();

      const rpcBody = JSON.stringify({
        _target_user_id: targetUserId,
        _novo_nome: novoNome,
        _novo_email: novoEmail,
        _old_email: oldEmail,
      });

      let rpcResp = await fetch(`${baseUrl}/rest/v1/rpc/admin_atualizar_dados_usuario`, {
        method: "POST",
        headers: restHeaders,
        body: rpcBody,
      });

      if (!rpcResp.ok && authCfg) {
        rpcResp = await fetch(`${baseUrl}/rest/v1/rpc/admin_atualizar_dados_usuario`, {
          method: "POST",
          headers: getSupabaseRequestHeaders(key),
          body: rpcBody,
        });
      }

      if (rpcResp.ok) {
        const rpcData = await rpcResp.json().catch(() => null);
        return {
          ok: true,
          data: rpcData?.user_id
            ? {
                user: { id: String(rpcData.user_id), email: novoEmail },
                profile: { id: String(rpcData.user_id) },
              }
            : null,
        };
      }

      const rpcErr = await rpcResp.json().catch(() => null);
      return {
        ok: false,
        erro:
          rpcErr?.message ||
          rpcErr?.error_description ||
          rpcErr?.msg ||
          "Erro ao atualizar dados do usuário no Supabase.",
      };
    }

    if (payload["action"] === "toggle_status") {
      const targetUserId = String(payload["userId"] || "");
      const targetEmail = String(payload["email"] || "");
      const ativo = Boolean(payload["ativo"]);

      const rpcBody = JSON.stringify({
        _target_user_id: targetUserId,
        _ativo: ativo,
        _target_email: targetEmail,
      });

      let rpcResp = await fetch(`${baseUrl}/rest/v1/rpc/admin_alterar_status_usuario`, {
        method: "POST",
        headers: restHeaders,
        body: rpcBody,
      });

      if (!rpcResp.ok && authCfg) {
        rpcResp = await fetch(`${baseUrl}/rest/v1/rpc/admin_alterar_status_usuario`, {
          method: "POST",
          headers: getSupabaseRequestHeaders(key),
          body: rpcBody,
        });
      }

      if (rpcResp.ok) {
        return { ok: true, data: null };
      }

      await fetch(`${baseUrl}/rest/v1/profiles?user_id=eq.${targetUserId}`, {
        method: "PATCH",
        headers: restHeaders,
        body: JSON.stringify({
          ativo,
          updated_at: new Date().toISOString(),
        }),
      });
      return { ok: true, data: null };
    }

    if (payload["action"] === "delete") {
      const targetUserId = String(payload["userId"] || "");
      const targetEmail = String(payload["email"] || "");

      const rpcBody = JSON.stringify({
        _target_user_id: targetUserId,
        _target_email: targetEmail,
      });

      let rpcResp = await fetch(`${baseUrl}/rest/v1/rpc/admin_excluir_usuario`, {
        method: "POST",
        headers: restHeaders,
        body: rpcBody,
      });

      if (!rpcResp.ok && authCfg) {
        rpcResp = await fetch(`${baseUrl}/rest/v1/rpc/admin_excluir_usuario`, {
          method: "POST",
          headers: getSupabaseRequestHeaders(key),
          body: rpcBody,
        });
      }

      if (rpcResp.ok) {
        return { ok: true, data: null };
      }

      await fetch(`${baseUrl}/rest/v1/profiles?user_id=eq.${targetUserId}`, {
        method: "DELETE",
        headers: restHeaders,
      });
      await fetch(`${baseUrl}/rest/v1/user_roles?user_id=eq.${targetUserId}`, {
        method: "DELETE",
        headers: restHeaders,
      });
      return { ok: true, data: null };
    }

    return { ok: true, data: null };
  } catch (err) {
    return {
      ok: false,
      erro: err instanceof Error ? err.message : "Erro ao comunicar com o servidor Supabase.",
    };
  }
}

export async function realizarLogin(
  emailInput: string,
  senhaInput: string,
): Promise<{
  ok: boolean;
  erro?: string;
  usuario?: UsuarioSistema;
  bloqueado?: boolean;
  bloqueadoAte?: number | null;
  segundosRestantes?: number;
  tentativasRestantes?: number;
}> {
  // 1. Validação estrita com Zod
  const validacao = loginSchema.safeParse({ email: emailInput, senha: senhaInput });
  if (!validacao.success) {
    return {
      ok: false,
      erro: validacao.error.issues[0]?.message ?? "Preencha um E-mail e Senha válidos.",
    };
  }

  const email = validacao.data.email.toLowerCase();
  const senha = validacao.data.senha;

  // 2. Verifica se o e-mail já está bloqueado temporariamente (15 minutos após 5 falhas)
  // Para contas comuns, bloqueia imediatamente.
  // Para a conta de Administrador (Dono), para evitar DoS por terceiros na tela de login,
  // permitimos testar as credenciais: se a senha for a correta, o bloqueio é limpo imediatamente.
  const statusBloqueio = obterStatusBloqueioEmail(email);
  const usuarioLocal = usuariosState.find((u) => u.email.toLowerCase() === email);
  const ehAdmin = usuarioLocal?.role === "admin" || email === ADMIN_PADRAO.email.toLowerCase();

  if (statusBloqueio.bloqueado && !ehAdmin) {
    return {
      ok: false,
      bloqueado: true,
      bloqueadoAte: statusBloqueio.bloqueadoAte,
      segundosRestantes: statusBloqueio.segundosRestantes,
      tentativasRestantes: 0,
      erro: `Acesso bloqueado temporariamente por 5 tentativas incorretas. Aguarde ${formatarTempoBloqueio(statusBloqueio.segundosRestantes)} para tentar novamente.`,
    };
  }

  // 3. Rate Limiting por minuto
  const rate = verificarRateLimit("login", email);
  if (!rate.permitido) {
    return {
      ok: false,
      ...(rate.erro ? { erro: rate.erro } : {}),
    };
  }

  if (usuarioLocal && !usuarioLocal.ativo) {
    return {
      ok: false,
      erro: "Este acesso foi desativado pelo Administrador.",
    };
  }

  // 4. Tenta autenticar via Supabase Auth REST API caso configurado
  let supabaseRejeitouCredenciais = false;
  const { url, key } = getSupabaseConfig();
  if (url && key) {
    try {
      const resp = await fetch(`${url.replace(/\/+$/, "")}/auth/v1/token?grant_type=password&apikey=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: getSupabaseRequestHeaders(key),
        body: JSON.stringify({ email, password: senha }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const supaUser = data.user;
        const accessToken = data.access_token as string | undefined;
        if (accessToken) {
          setAccessToken(accessToken);
        }

        let roleDetectada: UserRole =
          supaUser?.user_metadata?.role === "admin" ? "admin" : "usuario";
        let ativoDetectado = true;
        let nomeDetectado: string =
          supaUser?.user_metadata?.nome ||
          supaUser?.user_metadata?.name ||
          email.split("@")[0];

        if (accessToken && supaUser?.id) {
          try {
            const baseUrl = url.replace(/\/+$/, "");
            const roleResp = await fetch(
              `${baseUrl}/rest/v1/user_roles?user_id=eq.${supaUser.id}&select=role`,
              {
                headers: {
                  apikey: key,
                  Authorization: `Bearer ${accessToken}`,
                },
              },
            );
            if (roleResp.ok) {
              const roles = await roleResp.json();
              if (Array.isArray(roles) && roles[0]?.role) {
                roleDetectada = roles[0].role === "admin" ? "admin" : "usuario";
              }
            }

            const profResp = await fetch(
              `${baseUrl}/rest/v1/profiles?user_id=eq.${supaUser.id}&select=nome,ativo,role`,
              {
                headers: {
                  apikey: key,
                  Authorization: `Bearer ${accessToken}`,
                },
              },
            );
            if (profResp.ok) {
              const profs = await profResp.json();
              if (Array.isArray(profs) && profs[0]) {
                if (profs[0].ativo === false) {
                  ativoDetectado = false;
                }
                if (profs[0].nome) {
                  nomeDetectado = profs[0].nome;
                }
              }
            }
          } catch {
            // fallback para metadados do token
          }
        }

        if (!ativoDetectado) {
          setAccessToken(null);
          return {
            ok: false,
            erro: "Este acesso foi desativado pelo Administrador.",
          };
        }

        const usuarioAutenticado: UsuarioSistema = {
          id: supaUser.id,
          user_id: supaUser.id,
          nome: nomeDetectado,
          email,
          senha: "",
          senhaHash: gerarHashSenhaSync(senha),
          role: roleDetectada,
          ativo: true,
          criadoEm: usuarioLocal?.criadoEm ?? formatarDataHoraAtual(),
        };

        const existeIdx = usuariosState.findIndex(
          (u) => u.email.toLowerCase() === email,
        );
        if (existeIdx >= 0) {
          usuariosState = usuariosState.map((u, idx) =>
            idx === existeIdx ? usuarioAutenticado : u,
          );
        } else {
          usuariosState = [...usuariosState, usuarioAutenticado];
        }

        // Sucesso: zera o contador de falhas em login_attempts
        registrarTentativaLoginLocal(email, true);
        usuarioAtualState = usuarioAutenticado;
        emitAuth(true);
        void sincronizarUsuariosSupabase();
        return { ok: true, usuario: usuarioAutenticado };
      } else if (resp.status === 400 || resp.status === 401) {
        // O servidor Supabase respondeu e rejeitou a senha/credenciais
        supabaseRejeitouCredenciais = true;
      }
    } catch {
      // Se offline ou sem conexão com Supabase Cloud, segue validação local
    }
  }

  // 5. Validação local (apenas quando offline ou para a conta demo padrão admin@atospro.com)
  const ehContaDemoLocal = email === ADMIN_PADRAO.email.toLowerCase();
  const hashTentativa = gerarHashSenhaSync(senha);
  const senhaValida =
    (!supabaseRejeitouCredenciais || ehContaDemoLocal) &&
    usuarioLocal &&
    usuarioLocal.ativo &&
    ((usuarioLocal.senha && usuarioLocal.senha === senha) ||
      (usuarioLocal.senhaHash && usuarioLocal.senhaHash === hashTentativa) ||
      (ehContaDemoLocal && !usuarioLocal.senha && !usuarioLocal.senhaHash && senha === "123456"));

  if (senhaValida && usuarioLocal) {
    registrarTentativaLoginLocal(email, true);
    usuarioAtualState = usuarioLocal;

    // Se temos conexão com Supabase e o admin padrão logou, tenta provisioná-lo para obter accessToken
    if (url && key && ehAdmin && !getAccessToken()) {
      try {
        const signupResp = await fetch(`${url.replace(/\/+$/, "")}/auth/v1/signup?apikey=${encodeURIComponent(key)}`, {
          method: "POST",
          headers: getSupabaseRequestHeaders(key),
          body: JSON.stringify({
            email,
            password: senha,
            data: { nome: usuarioLocal.nome, role: "admin" },
          }),
        });
        if (signupResp.ok) {
          const sData = await signupResp.json();
          if (sData.access_token) {
            setAccessToken(sData.access_token);
          }
          const novoUid = sData.user?.id || sData.id;
          if (novoUid) {
            usuarioLocal.id = novoUid;
            usuarioLocal.user_id = novoUid;
          }
        }
      } catch {
        // Segue localmente
      }
    }

    emitAuth(true);
    return { ok: true, usuario: usuarioLocal };
  }

  // Se o admin já estava com bloqueio ativo decorrente de vandalismo e errou a senha novamente:
  if (statusBloqueio.bloqueado && ehAdmin) {
    return {
      ok: false,
      bloqueado: true,
      bloqueadoAte: statusBloqueio.bloqueadoAte,
      segundosRestantes: statusBloqueio.segundosRestantes,
      tentativasRestantes: 0,
      erro: `Acesso bloqueado temporariamente por 5 tentativas incorretas. Aguarde ${formatarTempoBloqueio(statusBloqueio.segundosRestantes)} para tentar novamente.`,
    };
  }

  // 6. Senha incorreta: registra falha e aplica bloqueio de 15 min na 5ª falha seguida
  const posFalha = registrarTentativaLoginLocal(email, false);
  const tentativasRestantes = Math.max(0, MAX_TENTATIVAS_LOGIN - posFalha.falhas);

  if (posFalha.bloqueado) {
    return {
      ok: false,
      bloqueado: true,
      bloqueadoAte: posFalha.bloqueadoAte,
      segundosRestantes: posFalha.segundosRestantes,
      tentativasRestantes: 0,
      erro: `Você errou a senha ${MAX_TENTATIVAS_LOGIN} vezes seguidas. Acesso bloqueado temporariamente por ${formatarTempoBloqueio(posFalha.segundosRestantes)}.`,
    };
  }

  return {
    ok: false,
    bloqueado: false,
    tentativasRestantes,
    erro: `E-mail ou senha inválidos. Tentativas restantes antes do bloqueio de 15 min: ${tentativasRestantes}.`,
  };
}

export function realizarLogout() {
  usuarioAtualState = null;
  setAccessToken(null);
  emitAuth(true);
}

export async function criarLoginPeloAdmin(dados: {
  nome: string;
  email: string;
  senha: string;
}): Promise<{ ok: boolean; erro?: string; usuario?: UsuarioSistema }> {
  if (!usuarioAtualState || usuarioAtualState.role !== "admin" || !usuarioAtualState.ativo) {
    return {
      ok: false,
      erro: "Acesso negado: somente o Administrador ativo pode criar logins.",
    };
  }

  const rate = verificarRateLimit("edge_function", usuarioAtualState.user_id);
  if (!rate.permitido) {
    return { ok: false, ...(rate.erro ? { erro: rate.erro } : {}) };
  }

  const validacao = criarUsuarioAdminSchema.safeParse(dados);
  if (!validacao.success) {
    return {
      ok: false,
      erro: validacao.error.issues[0]?.message ?? "Dados inválidos para criação de login.",
    };
  }

  const { nome, email: emailRaw, senha } = validacao.data;
  const email = emailRaw.toLowerCase();

  if (usuariosState.some((u) => u.email.toLowerCase() === email)) {
    return { ok: false, erro: "Já existe um usuário cadastrado com este e-mail." };
  }

  let remoteUserId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `uid-${Date.now()}`;

  const res = await invocarEdgeFunctionAdmin({
    action: "create",
    nome,
    email,
    password: senha,
  });

  if (!res.ok) {
    return { ok: false, erro: res.erro ?? "Falha ao criar usuário no servidor." };
  }

  const resJson = res.data;
  if (resJson?.user?.id) {
    remoteUserId = String(resJson.user.id);
  } else if (resJson?.profile?.id) {
    remoteUserId = String(resJson.profile.id);
  }

  const novoUsuario: UsuarioSistema = {
    id: remoteUserId,
    user_id: remoteUserId,
    nome,
    email,
    senha: "",
    senhaHash: gerarHashSenhaSync(senha),
    role: "usuario",
    ativo: true,
    criadoEm: formatarDataHoraAtual(),
  };

  // Inicializa Perfil da Empresa em branco, Personalização padrão e base 100% vazia exclusiva para o novo usuário
  tenantInitCallbacks.forEach((cb) => cb(remoteUserId));

  usuariosState = [novoUsuario, ...usuariosState];
  emitAuth(false);

  return { ok: true, usuario: novoUsuario };
}

export async function editarDadosUsuarioPeloAdmin(
  id: string,
  dados: { nome: string; email: string },
): Promise<{ ok: boolean; erro?: string; usuario?: UsuarioSistema }> {
  if (!usuarioAtualState || usuarioAtualState.role !== "admin" || !usuarioAtualState.ativo) {
    return { ok: false, erro: "Somente o Administrador ativo pode editar dados de usuários." };
  }

  const rate = verificarRateLimit("edge_function", usuarioAtualState.user_id);
  if (!rate.permitido) {
    return { ok: false, ...(rate.erro ? { erro: rate.erro } : {}) };
  }

  const validacao = editarUsuarioSchema.safeParse(dados);
  if (!validacao.success) {
    return {
      ok: false,
      erro: validacao.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const alvo = usuariosState.find((u) => u.id === id || u.user_id === id);
  if (!alvo) {
    return { ok: false, erro: "Usuário não encontrado." };
  }

  const novoEmail = validacao.data.email.toLowerCase();
  const novoNome = validacao.data.nome;

  // Verifica se outro usuário já usa esse e-mail
  if (
    usuariosState.some(
      (u) => u.id !== alvo.id && u.user_id !== alvo.user_id && u.email.toLowerCase() === novoEmail,
    )
  ) {
    return { ok: false, erro: "Já existe outro usuário cadastrado com este e-mail." };
  }

  const res = await invocarEdgeFunctionAdmin({
    action: "update",
    userId: alvo.user_id,
    oldEmail: alvo.email,
    nome: novoNome,
    email: novoEmail,
  });

  if (!res.ok) {
    return { ok: false, erro: res.erro ?? "Falha ao atualizar dados no servidor." };
  }

  if (alvo.email.toLowerCase() !== novoEmail) {
    delete tentativasState[alvo.email.toLowerCase()];
    delete tentativasState[novoEmail];
    salvarMapaTentativas(tentativasState);
  }

  const canonicalId = res.data?.user?.id || alvo.user_id;
  const usuarioAtualizado: UsuarioSistema = {
    ...alvo,
    id: canonicalId,
    user_id: canonicalId,
    nome: novoNome,
    email: novoEmail,
  };

  usuariosState = usuariosState.map((u) =>
    u.id === id || u.user_id === alvo.user_id ? usuarioAtualizado : u,
  );

  if (usuarioAtualState.id === id || usuarioAtualState.user_id === alvo.user_id) {
    usuarioAtualState = {
      ...usuarioAtualState,
      id: canonicalId,
      user_id: canonicalId,
      nome: novoNome,
      email: novoEmail,
    };
  }

  emitAuth(false);
  return { ok: true, usuario: usuarioAtualizado };
}

export async function alterarSenhaUsuarioPeloAdmin(
  id: string,
  novaSenha: string,
): Promise<{ ok: boolean; erro?: string }> {
  if (!usuarioAtualState || usuarioAtualState.role !== "admin" || !usuarioAtualState.ativo) {
    return { ok: false, erro: "Somente o Administrador ativo pode alterar senhas." };
  }

  const rate = verificarRateLimit("edge_function", usuarioAtualState.user_id);
  if (!rate.permitido) {
    return { ok: false, ...(rate.erro ? { erro: rate.erro } : {}) };
  }

  const validacao = alterarSenhaSchema.safeParse({ novaSenha });
  if (!validacao.success) {
    return {
      ok: false,
      erro: validacao.error.issues[0]?.message ?? "A nova senha deve ter pelo menos 6 caracteres.",
    };
  }

  const alvo = usuariosState.find((u) => u.id === id || u.user_id === id);
  if (!alvo) {
    return { ok: false, erro: "Usuário não encontrado." };
  }

  const res = await invocarEdgeFunctionAdmin({
    action: "update_password",
    userId: alvo.user_id,
    email: alvo.email,
    password: validacao.data.novaSenha,
  });

  if (!res.ok) {
    return { ok: false, erro: res.erro ?? "Falha ao alterar senha no servidor." };
  }

  // Desbloqueia eventuais tentativas falhas anteriores do usuário cuja senha foi redefinida
  delete tentativasState[alvo.email.toLowerCase()];
  salvarMapaTentativas(tentativasState);

  usuariosState = usuariosState.map((u) =>
    u.id === id || u.user_id === alvo.user_id
      ? { ...u, senha: "", senhaHash: gerarHashSenhaSync(validacao.data.novaSenha) }
      : u,
  );
  if (usuarioAtualState.id === id || usuarioAtualState.user_id === alvo.user_id) {
    usuarioAtualState = { ...usuarioAtualState, senha: "", senhaHash: gerarHashSenhaSync(validacao.data.novaSenha) };
  }
  emitAuth(false);
  return { ok: true };
}

export async function alternarStatusUsuarioPeloAdmin(
  id: string,
): Promise<{ ok: boolean; erro?: string; ativo?: boolean }> {
  if (!usuarioAtualState || usuarioAtualState.role !== "admin" || !usuarioAtualState.ativo) {
    return { ok: false, erro: "Somente o Administrador ativo pode alterar o acesso." };
  }

  const rate = verificarRateLimit("edge_function", usuarioAtualState.user_id);
  if (!rate.permitido) {
    return { ok: false, ...(rate.erro ? { erro: rate.erro } : {}) };
  }

  const alvo = usuariosState.find((u) => u.id === id || u.user_id === id);
  if (!alvo) {
    return { ok: false, erro: "Usuário não encontrado." };
  }

  const isSelf = alvo.id === usuarioAtualState.id || alvo.email.toLowerCase() === usuarioAtualState.email.toLowerCase();
  if (isSelf) {
    return {
      ok: false,
      erro: "Você não pode desativar sua própria conta de Administrador.",
    };
  }

  const novoStatus = !alvo.ativo;

  const res = await invocarEdgeFunctionAdmin({
    action: "toggle_status",
    userId: alvo.user_id,
    email: alvo.email,
    ativo: novoStatus,
  });

  if (!res.ok) {
    return { ok: false, erro: res.erro ?? "Falha ao alterar status no servidor." };
  }

  usuariosState = usuariosState.map((u) =>
    u.id === id || u.user_id === alvo.user_id ? { ...u, ativo: novoStatus } : u,
  );
  emitAuth(false);
  return { ok: true, ativo: novoStatus };
}

export async function excluirUsuarioPeloAdmin(
  id: string,
): Promise<{ ok: boolean; erro?: string }> {
  if (!usuarioAtualState || usuarioAtualState.role !== "admin" || !usuarioAtualState.ativo) {
    return { ok: false, erro: "Somente o Administrador ativo pode excluir acessos." };
  }

  const rate = verificarRateLimit("edge_function", usuarioAtualState.user_id);
  if (!rate.permitido) {
    return { ok: false, ...(rate.erro ? { erro: rate.erro } : {}) };
  }

  const alvo = usuariosState.find((u) => u.id === id || u.user_id === id);
  if (!alvo) {
    return { ok: false, erro: "Usuário não encontrado." };
  }

  const isSelf = alvo.id === usuarioAtualState.id || alvo.email.toLowerCase() === usuarioAtualState.email.toLowerCase();
  if (isSelf) {
    return {
      ok: false,
      erro: "Você não pode excluir sua própria conta de Administrador.",
    };
  }

  const res = await invocarEdgeFunctionAdmin({
    action: "delete",
    userId: alvo.user_id,
    email: alvo.email,
  });

  if (!res.ok) {
    return { ok: false, erro: res.erro ?? "Falha ao excluir usuário no servidor." };
  }

  tenantDeleteCallbacks.forEach((cb) => cb(alvo.user_id));

  usuariosState = usuariosState.filter((u) => u.id !== id && u.user_id !== alvo.user_id);
  emitAuth(false);
  return { ok: true };
}

export function useAuth() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => cachedAuthSnapshot,
    () => cachedAuthSnapshot,
  );
}
