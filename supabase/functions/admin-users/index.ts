import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Rate Limiting em memória por usuário/IP na Edge Function (máx. 10 req/minuto)
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQ = 10;

function checkEdgeRateLimit(key: string): boolean {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(key) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  );
  if (timestamps.length >= RATE_LIMIT_MAX_REQ) {
    rateLimitMap.set(key, timestamps);
    return false;
  }
  timestamps.push(now);
  rateLimitMap.set(key, timestamps);
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Configuração SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 1. Verifica token de autenticação do usuário solicitante
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado: token de autenticação ausente." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const {
      data: { user: callerUser },
      error: callerError,
    } = await supabaseAdmin.auth.getUser(token);

    if (callerError || !callerUser) {
      return new Response(
        JSON.stringify({ error: "Sessão inválida ou expirada." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!checkEdgeRateLimit(callerUser.id)) {
      return new Response(
        JSON.stringify({ error: "Muitas tentativas em sequência, aguarde alguns segundos" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Confirma na tabela user_roles se o usuário solicitante possui role = 'admin'
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id)
      .single();

    if (roleError || roleData?.role !== "admin") {
      return new Response(
        JSON.stringify({
          error: "Acesso negado: apenas o usuário com role = 'admin' tem permissão para gerenciar logins.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Confirma na tabela profiles se o administrador solicitante está ativo
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("ativo")
      .eq("user_id", callerUser.id)
      .maybeSingle();

    if (callerProfile && callerProfile.ativo === false) {
      return new Response(
        JSON.stringify({ error: "Acesso negado: conta de usuário inativa." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const action = body.action ?? "create";

    // AÇÃO: CRIAR LOGIN DE ACESSO
    if (action === "create") {
      const { nome, email, password } = body;
      if (!nome || !email || !password) {
        return new Response(
          JSON.stringify({ error: "Informe Nome da Pessoa, E-mail e Senha." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (String(password).length < 6) {
        return new Response(
          JSON.stringify({ error: "A senha deve ter no mínimo 6 caracteres." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const emailLimpo = String(email).trim().toLowerCase();
      const nomeLimpo = String(nome).trim();

      // Cria a conta já ativa na hora, sem precisar confirmar e-mail e sem desconectar o admin
      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: emailLimpo,
        password: String(password),
        email_confirm: true,
        user_metadata: {
          nome: nomeLimpo,
          role: "usuario",
        },
      });

      if (createError || !created.user) {
        return new Response(
          JSON.stringify({ error: createError?.message ?? "Erro ao criar usuário." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await supabaseAdmin.from("user_roles").upsert(
        {
          user_id: created.user.id,
          role: "usuario",
        },
        { onConflict: "user_id" },
      );

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .upsert(
          {
            user_id: created.user.id,
            nome: nomeLimpo,
            email: emailLimpo,
            role: "usuario",
            ativo: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        )
        .select("*")
        .single();

      // Inicializa Perfil da Empresa e Personalização em branco exclusivos para o novo usuário
      await supabaseAdmin.from("store_settings").upsert(
        {
          user_id: created.user.id,
          nome_empresa: "",
          cnpj: "",
          telefone: "",
          email: "",
          endereco: "",
          logo: "",
          paleta_cores: "azul-escuro",
          modo_tema: "light",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

      return new Response(
        JSON.stringify({ user: created.user, profile }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // AÇÃO: ALTERAR SENHA / EDITAR LOGIN
    if (action === "update_password" || action === "update") {
      const { userId, password, nome, email } = body;
      if (!userId) {
        return new Response(
          JSON.stringify({ error: "ID do usuário é obrigatório." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const authUpdates: Record<string, unknown> = {};
      if (password) {
        if (String(password).length < 6) {
          return new Response(
            JSON.stringify({ error: "A nova senha deve ter no mínimo 6 caracteres." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        authUpdates.password = String(password);
      }

      if (email) {
        authUpdates.email = String(email).trim().toLowerCase();
        authUpdates.email_confirm = true;
      }

      if (nome) {
        authUpdates.user_metadata = { nome: String(nome).trim() };
      }

      if (Object.keys(authUpdates).length > 0) {
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, authUpdates);
        if (updateError) {
          return new Response(
            JSON.stringify({ error: updateError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }

      if (nome || email) {
        const profileUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (nome) profileUpdates.nome = String(nome).trim();
        if (email) profileUpdates.email = String(email).trim().toLowerCase();
        await supabaseAdmin
          .from("profiles")
          .update(profileUpdates)
          .eq("user_id", userId);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // AÇÃO: DESATIVAR / ATIVAR LOGIN DE ACESSO
    if (action === "toggle_status") {
      const { userId, ativo } = body;
      if (!userId || typeof ativo !== "boolean") {
        return new Response(
          JSON.stringify({ error: "Parâmetros inválidos." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (userId === callerUser.id && !ativo) {
        return new Response(
          JSON.stringify({ error: "O Administrador principal não pode desativar a própria conta." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: ativo ? "none" : "876000h",
      });

      if (banError) {
        return new Response(
          JSON.stringify({ error: banError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await supabaseAdmin
        .from("profiles")
        .update({ ativo, updated_at: new Date().toISOString() })
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({ success: true, ativo }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // AÇÃO: EXCLUIR / REMOVER LOGIN DE ACESSO
    if (action === "delete") {
      const { userId } = body;
      if (!userId) {
        return new Response(
          JSON.stringify({ error: "ID do usuário é obrigatório." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (userId === callerUser.id) {
        return new Response(
          JSON.stringify({ error: "Você não pode excluir a sua própria conta de Administrador." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteError) {
        return new Response(
          JSON.stringify({ error: deleteError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await supabaseAdmin.from("profiles").delete().eq("user_id", userId);
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Ação inválida." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno na função." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
