-- ============================================================================
-- ARQUITETURA MULTI-TENANT (100% ISOLADA POR USUÁRIO - user_id)
-- Tabelas:
--   1. user_roles & profiles (Autenticação e Controle de Acesso Admin)
--   2. customers (Clientes)
--   3. service_orders (Ordens de Serviço - numeração sequencial por usuário)
--   4. products (Estoque)
--   5. suppliers (Fornecedores)
--   6. purchase_invoices (Notas de Compra)
--   7. purchase_invoice_items (Itens das Notas de Compra)
--   8. sales (Vendas - numeração sequencial por usuário)
--   9. sale_items (Itens da Venda)
--  10. sale_payments (Pagamentos Combinados da Venda)
--  11. cash_register_movements (Movimentações Físicas de Caixa)
--  12. store_settings (Perfil da Empresa e Personalização exclusivos por usuário)
-- ============================================================================

-- 1. Enum de funções (admin = dono administrador, usuario = demais usuários)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'usuario');
  end if;
end
$$;

-- 2. Tabela user_roles (diferencia 'admin' de 'usuario')
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  role public.app_role not null default 'usuario',
  created_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;
create unique index if not exists idx_only_one_admin on public.user_roles (role) where (role = 'admin');

-- 3. Tabela profiles (dados e status ativo/inativo dos logins criados)
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  nome text not null,
  email text not null unique,
  role public.app_role not null default 'usuario',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- ============================================================================
-- TABELAS OPERACIONAIS MULTI-TENANT (Isoladas por user_id)
-- ============================================================================

-- 4. Tabela customers (Clientes)
create table if not exists public.customers (
  id text not null default gen_random_uuid()::text,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null,
  documento text not null default '',
  whatsapp text not null default '',
  email text not null default '',
  cep text not null default '',
  endereco text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.customers enable row level security;

-- 5. Tabela service_orders (Ordens de Serviço - sequencial por user_id)
create table if not exists public.service_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  seq_numero integer not null default 1,
  numero text not null,
  cliente text not null,
  aparelho text not null,
  defeito text not null default '',
  status text not null default 'Em Orçamento' check (
    status in ('Na Bancada', 'Em Orçamento', 'Aguardando Peça', 'Concluída', 'Finalizado', 'Entregue', 'Cancelada')
  ),
  entrada text not null,
  finalizacao text,
  valor numeric(12, 2) not null default 0,
  custo_peca numeric(12, 2) not null default 0,
  equipamento text,
  serie text,
  estado text,
  acessorios text,
  sintomas text[] default '{}',
  laudo text,
  tecnico text,
  servico text,
  pecas text,
  garantia text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, numero)
);

alter table public.service_orders enable row level security;

-- 6. Tabela products (Estoque)
create table if not exists public.products (
  id text not null default gen_random_uuid()::text,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null,
  sku text not null default '',
  quantidade integer not null default 0,
  custo numeric(12, 2) not null default 0,
  venda numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.products enable row level security;

-- 7. Tabela suppliers (Fornecedores)
create table if not exists public.suppliers (
  id text not null default gen_random_uuid()::text,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null,
  cnpj text not null default '',
  telefone text not null default '',
  endereco text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.suppliers enable row level security;

-- 8. Tabela purchase_invoices (Notas de Compra de Fornecedores)
create table if not exists public.purchase_invoices (
  id text not null default gen_random_uuid()::text,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fornecedor_id text not null,
  data text not null,
  numero text not null,
  total numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.purchase_invoices enable row level security;

-- 9. Tabela purchase_invoice_items (Itens das Notas de Compra)
create table if not exists public.purchase_invoice_items (
  id text not null default gen_random_uuid()::text,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nota_id text not null,
  produto_id text not null,
  quantidade integer not null default 1,
  valor_unit numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.purchase_invoice_items enable row level security;

-- 10. Tabela sales (Vendas - numeração sequencial por user_id)
create table if not exists public.sales (
  id text not null default gen_random_uuid()::text,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  numero integer not null default 1,
  data_hora timestamptz not null default now(),
  subtotal numeric(12, 2) not null default 0,
  desconto numeric(12, 2) not null default 0,
  arredondamento numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, numero)
);

alter table public.sales enable row level security;

-- 11. Tabela sale_items (Itens das Vendas)
create table if not exists public.sale_items (
  id text not null default gen_random_uuid()::text,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  venda_id text not null,
  produto_id text not null,
  nome text not null,
  quantidade integer not null default 1,
  preco numeric(12, 2) not null default 0,
  custo_unit numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.sale_items enable row level security;

-- 12. Tabela sale_payments (Pagamentos Combinados das Vendas)
create table if not exists public.sale_payments (
  id text not null default gen_random_uuid()::text,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  venda_id text not null,
  venda_numero integer,
  forma text not null check (forma in ('Cartão de Crédito', 'Cartão de Débito', 'PIX', 'Dinheiro')),
  valor numeric(12, 2) not null check (valor >= 0),
  data_hora timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.sale_payments enable row level security;

-- 13. Tabela cash_register_movements (Movimentações Físicas de Caixa)
create table if not exists public.cash_register_movements (
  id text not null default gen_random_uuid()::text,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('entrada', 'saida')),
  valor numeric(12, 2) not null check (valor >= 0),
  descricao text not null,
  data_hora timestamptz not null default now(),
  origem_venda_id text,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.cash_register_movements enable row level security;

-- 14. Tabela store_settings (Perfil da Empresa e Personalização em branco por user_id)
create table if not exists public.store_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  nome_empresa text not null default '',
  cnpj text not null default '',
  telefone text not null default '',
  email text not null default '',
  endereco text not null default '',
  logo text not null default '',
  paleta_cores text not null default 'azul-escuro' check (paleta_cores in ('verde-claro', 'roxo', 'azul-escuro', 'ambar', 'grafite')),
  modo_tema text not null default 'light' check (modo_tema in ('light', 'dark')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.store_settings enable row level security;

-- ============================================================================
-- GARANTIA DE COLUNA user_id EM TABELAS PREEXISTENTES (Idempotência)
-- ============================================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'customers',
    'service_orders',
    'products',
    'suppliers',
    'purchase_invoices',
    'purchase_invoice_items',
    'sales',
    'sale_items',
    'sale_payments',
    'cash_register_movements',
    'store_settings'
  ]
  loop
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = t
        and column_name = 'user_id'
    ) then
      execute format(
        'alter table public.%I add column user_id uuid not null default auth.uid() references auth.users(id) on delete cascade',
        t
      );
    end if;
  end loop;
end
$$;

-- ============================================================================
-- FUNÇÕES DE NUMERAÇÃO SEQUENCIAL INDIVIDUAL POR USUÁRIO (OS #1 e Venda #1)
-- ============================================================================
create or replace function public.assign_user_service_order_seq()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;

  select coalesce(max(seq_numero), 0) + 1
    into v_next
    from public.service_orders
   where user_id = new.user_id;

  if new.seq_numero is null or new.seq_numero <= 0 then
    new.seq_numero := v_next;
  end if;

  if new.numero is null or btrim(new.numero) = '' then
    new.numero := 'OS-' || new.seq_numero::text;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_service_orders_seq on public.service_orders;
create trigger trg_service_orders_seq
  before insert on public.service_orders
  for each row execute procedure public.assign_user_service_order_seq();

create or replace function public.assign_user_sale_seq()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;

  if new.numero is null or new.numero <= 0 then
    select coalesce(max(numero), 0) + 1
      into v_next
      from public.sales
     where user_id = new.user_id;
    new.numero := v_next;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sales_seq on public.sales;
create trigger trg_sales_seq
  before insert on public.sales
  for each row execute procedure public.assign_user_sale_seq();

-- ============================================================================
-- FUNÇÕES AUXILIARES SECURITY DEFINER PARA AUTENTICAÇÃO E ROLES
-- ============================================================================
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  );
$$;

create or replace function public.is_active_user(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _user_id is not null and (
    exists (
      select 1
      from public.profiles p
      where p.user_id = _user_id
        and p.ativo = true
    )
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = _user_id
        and ur.role = 'admin'
    )
  );
$$;

create or replace function public.is_active_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_user(_user_id) and public.has_role(_user_id, 'admin');
$$;

-- ============================================================================
-- POLÍTICAS DE SEGURANÇA (RLS)
-- 1. user_roles & profiles: Gerenciamento exclusivo pelo Admin
-- 2. Tabelas Operacionais: Isolamento estrito Multi-Tenant
--    USING (auth.uid() = user_id) e WITH CHECK (auth.uid() = user_id)
-- ============================================================================

-- RLS: user_roles
drop policy if exists "Usuários podem ler sua própria role" on public.user_roles;
drop policy if exists "Somente admin gerencia user_roles" on public.user_roles;
drop policy if exists "user_roles_select_active" on public.user_roles;
drop policy if exists "user_roles_insert_admin_only" on public.user_roles;
drop policy if exists "user_roles_update_admin_only" on public.user_roles;
drop policy if exists "user_roles_delete_admin_only" on public.user_roles;

create policy "user_roles_select_active"
  on public.user_roles
  for select
  to authenticated
  using (
    (auth.uid() = user_id and public.is_active_user(auth.uid()))
    or public.is_active_admin(auth.uid())
  );

create policy "user_roles_insert_admin_only"
  on public.user_roles
  for insert
  to authenticated
  with check (public.is_active_admin(auth.uid()));

create policy "user_roles_update_admin_only"
  on public.user_roles
  for update
  to authenticated
  using (public.is_active_admin(auth.uid()))
  with check (public.is_active_admin(auth.uid()));

create policy "user_roles_delete_admin_only"
  on public.user_roles
  for delete
  to authenticated
  using (public.is_active_admin(auth.uid()));

-- RLS: profiles
drop policy if exists "Usuários leem próprio perfil e admin lê todos" on public.profiles;
drop policy if exists "Somente admin gerencia profiles" on public.profiles;
drop policy if exists "profiles_select_active" on public.profiles;
drop policy if exists "profiles_insert_admin_only" on public.profiles;
drop policy if exists "profiles_update_admin_only" on public.profiles;
drop policy if exists "profiles_delete_admin_only" on public.profiles;

create policy "profiles_select_active"
  on public.profiles
  for select
  to authenticated
  using (
    (auth.uid() = user_id and public.is_active_user(auth.uid()))
    or public.is_active_admin(auth.uid())
  );

create policy "profiles_insert_admin_only"
  on public.profiles
  for insert
  to authenticated
  with check (public.is_active_admin(auth.uid()));

create policy "profiles_update_admin_only"
  on public.profiles
  for update
  to authenticated
  using (public.is_active_admin(auth.uid()))
  with check (public.is_active_admin(auth.uid()));

create policy "profiles_delete_admin_only"
  on public.profiles
  for delete
  to authenticated
  using (public.is_active_admin(auth.uid()));

-- Macro para aplicar RLS estrito USING (auth.uid() = user_id) e WITH CHECK (auth.uid() = user_id)
-- em todas as 11 tabelas operacionais do sistema
do $$
declare
  t text;
begin
  foreach t in array array[
    'customers',
    'service_orders',
    'products',
    'suppliers',
    'purchase_invoices',
    'purchase_invoice_items',
    'sales',
    'sale_items',
    'sale_payments',
    'cash_register_movements',
    'store_settings'
  ]
  loop
    execute format('drop policy if exists "%I_select_active" on public.%I', t, t);
    execute format('drop policy if exists "%I_insert_active" on public.%I', t, t);
    execute format('drop policy if exists "%I_update_active" on public.%I', t, t);
    execute format('drop policy if exists "%I_delete_active" on public.%I', t, t);
    execute format('drop policy if exists "%I_delete_admin_only" on public.%I', t, t);
    execute format('drop policy if exists "%I_tenant_isolation_select" on public.%I', t, t);
    execute format('drop policy if exists "%I_tenant_isolation_insert" on public.%I', t, t);
    execute format('drop policy if exists "%I_tenant_isolation_update" on public.%I', t, t);
    execute format('drop policy if exists "%I_tenant_isolation_delete" on public.%I', t, t);

    execute format(
      'create policy "%I_tenant_isolation_select" on public.%I for select to authenticated using (auth.uid() = user_id and public.is_active_user(auth.uid()))',
      t, t
    );
    execute format(
      'create policy "%I_tenant_isolation_insert" on public.%I for insert to authenticated with check (auth.uid() = user_id and public.is_active_user(auth.uid()))',
      t, t
    );
    execute format(
      'create policy "%I_tenant_isolation_update" on public.%I for update to authenticated using (auth.uid() = user_id and public.is_active_user(auth.uid())) with check (auth.uid() = user_id and public.is_active_user(auth.uid()))',
      t, t
    );
    execute format(
      'create policy "%I_tenant_isolation_delete" on public.%I for delete to authenticated using (auth.uid() = user_id and public.is_active_user(auth.uid()))',
      t, t
    );
  end loop;
end
$$;

-- ============================================================================
-- TRIGGER DE CRIAÇÃO DE NOVO LOGIN:
-- 1. Define role ('admin' para conta principal, 'usuario' para demais)
-- 2. Cria registro em profiles
-- 3. Inicializa um Perfil de Empresa e Personalização em branco exclusivos
--    em store_settings para o novo usuário
-- ============================================================================
create or replace function public.handle_new_user_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_admin boolean;
  v_role public.app_role;
  v_nome text;
begin
  select exists (select 1 from public.user_roles where role = 'admin') into v_has_admin;

  -- Se o formulário solicitou 'usuario' ou já existir um admin cadastrado, força 'usuario':
  if v_has_admin or (new.raw_user_meta_data->>'role' = 'usuario') then
    v_role := 'usuario';
  else
    v_role := 'admin';
  end if;

  v_nome := coalesce(
    nullif(trim(new.raw_user_meta_data->>'nome'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    split_part(new.email, '@', 1)
  );

  insert into public.user_roles (id, user_id, role)
  values (new.id, new.id, v_role)
  on conflict (user_id) do update
    set id = excluded.id,
        role = excluded.role;

  insert into public.profiles (id, user_id, nome, email, role, ativo, updated_at)
  values (new.id, new.id, v_nome, new.email, v_role, true, now())
  on conflict (user_id) do update
    set id = excluded.id,
        nome = excluded.nome,
        email = excluded.email,
        role = excluded.role,
        updated_at = now();

  -- Inicializa Perfil da Empresa em branco e Personalização padrão exclusivos para este user_id
  insert into public.store_settings (
    user_id,
    nome_empresa,
    cnpj,
    telefone,
    email,
    endereco,
    logo,
    paleta_cores,
    modo_tema,
    updated_at
  )
  values (
    new.id,
    '',
    '',
    '',
    '',
    '',
    '',
    'azul-escuro',
    'light',
    now()
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_role on auth.users;
create trigger on_auth_user_created_role
  after insert on auth.users
  for each row execute procedure public.handle_new_user_role();


-- ============================================================================
-- 15. TABELA login_attempts (LIMITE DE 5 TENTATIVAS E BLOQUEIO DE 15 MINUTOS)
-- ============================================================================
create table if not exists public.login_attempts (
  email text primary key,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  last_attempt_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.login_attempts enable row level security;

drop policy if exists "login_attempts_admin_select" on public.login_attempts;
create policy "login_attempts_admin_select"
  on public.login_attempts
  for select
  to authenticated
  using (public.is_active_admin(auth.uid()));

-- Verifica se um e-mail está temporariamente bloqueado (locked_until > now())
create or replace function public.check_login_lockout(_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(_email, '')));
  v_rec public.login_attempts%rowtype;
  v_rem integer := 0;
begin
  select * into v_rec from public.login_attempts where email = v_email;

  if not found then
    return jsonb_build_object(
      'is_locked', false,
      'failed_attempts', 0,
      'locked_until', null,
      'seconds_remaining', 0
    );
  end if;

  if v_rec.locked_until is not null and v_rec.locked_until > now() then
    v_rem := greatest(1, ceil(extract(epoch from (v_rec.locked_until - now())))::integer);
    return jsonb_build_object(
      'is_locked', true,
      'failed_attempts', v_rec.failed_attempts,
      'locked_until', v_rec.locked_until,
      'seconds_remaining', v_rem
    );
  end if;

  return jsonb_build_object(
    'is_locked', false,
    'failed_attempts', v_rec.failed_attempts,
    'locked_until', null,
    'seconds_remaining', 0
  );
end;
$$;

-- Registra tentativa de login: bloqueia por 15 minutos ao atingir 5 falhas seguidas;
-- zera o contador ao logar com sucesso após o término do bloqueio.
create or replace function public.register_login_attempt(_email text, _success boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(_email, '')));
  v_rec public.login_attempts%rowtype;
  v_attempts integer;
  v_locked_until timestamptz := null;
  v_rem integer := 0;
begin
  select * into v_rec from public.login_attempts where email = v_email for update;

  -- Se ainda estiver bloqueado, impede qualquer tentativa (mesmo com senha correta)
  if found and v_rec.locked_until is not null and v_rec.locked_until > now() then
    v_rem := greatest(1, ceil(extract(epoch from (v_rec.locked_until - now())))::integer);
    return jsonb_build_object(
      'is_locked', true,
      'failed_attempts', v_rec.failed_attempts,
      'locked_until', v_rec.locked_until,
      'seconds_remaining', v_rem
    );
  end if;

  if _success then
    delete from public.login_attempts where email = v_email;
    return jsonb_build_object(
      'is_locked', false,
      'failed_attempts', 0,
      'locked_until', null,
      'seconds_remaining', 0
    );
  end if;

  -- Caso o bloqueio anterior já tenha expirado, reinicia a contagem a partir de 1
  if found and v_rec.locked_until is not null and v_rec.locked_until <= now() then
    v_attempts := 1;
  elsif found then
    v_attempts := v_rec.failed_attempts + 1;
  else
    v_attempts := 1;
  end if;

  if v_attempts >= 5 then
    v_locked_until := now() + interval '15 minutes';
    v_rem := 15 * 60;
  end if;

  insert into public.login_attempts (email, failed_attempts, locked_until, last_attempt_at, updated_at)
  values (v_email, v_attempts, v_locked_until, now(), now())
  on conflict (email) do update
    set failed_attempts = excluded.failed_attempts,
        locked_until = excluded.locked_until,
        last_attempt_at = now(),
        updated_at = now();

  return jsonb_build_object(
    'is_locked', v_locked_until is not null,
    'failed_attempts', v_attempts,
    'locked_until', v_locked_until,
    'seconds_remaining', v_rem
  );
end;
$$;

grant execute on function public.check_login_lockout(text) to anon, authenticated;
grant execute on function public.register_login_attempt(text, boolean) to anon, authenticated;

-- Alteração de senha de usuários pelo Admin ou pelo próprio usuário no auth.users
create or replace function public.admin_alterar_senha_usuario(
  _target_user_id uuid,
  _new_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_caller_id uuid := auth.uid();
  v_is_admin boolean;
  v_rows integer;
begin
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_caller_id
      and ur.role = 'admin'
  ) into v_is_admin;

  if v_caller_id is null or (v_caller_id <> _target_user_id and not v_is_admin) then
    raise exception 'Acesso negado: apenas o Administrador ou o próprio usuário pode alterar a senha.';
  end if;

  if _new_password is null or length(btrim(_new_password)) < 6 then
    raise exception 'A nova senha deve possuir no mínimo 6 caracteres.';
  end if;

  execute format(
    'update auth.users set encrypted_password = crypt(%L, gen_salt(%L)), updated_at = now() where id = %L',
    _new_password,
    'bf',
    _target_user_id
  );
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    raise exception 'Usuário não encontrado em auth.users.';
  end if;

  delete from public.login_attempts
  where lower(trim(email)) in (
    select lower(trim(email)) from auth.users where id = _target_user_id
  );

  return jsonb_build_object(
    'ok', true,
    'message', 'Senha atualizada com sucesso no backend.'
  );
end;
$$;

grant execute on function public.admin_alterar_senha_usuario(uuid, text) to authenticated;

-- ============================================================================
-- 16. STORAGE SEGURO PARA LOGO ({user_id}/ · PNG, JPG, WEBP · MÁX 5MB)
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'store-logos',
  'store-logos',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set file_size_limit = 5242880,
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

drop policy if exists "store_logos_user_select" on storage.objects;
drop policy if exists "store_logos_user_insert" on storage.objects;
drop policy if exists "store_logos_user_update" on storage.objects;
drop policy if exists "store_logos_user_delete" on storage.objects;

create policy "store_logos_user_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'store-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "store_logos_user_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'store-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "store_logos_user_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'store-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'store-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "store_logos_user_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'store-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
