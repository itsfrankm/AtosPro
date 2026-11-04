-- =============================================================================
-- ATOSPRO / TECNOFIX - SCHEMA PADRONIZADO E ISOLAMENTO MULTI-TENANT POR USUÁRIO
-- Pode ser executado diretamente no SQL Editor do Supabase (100% idempotente)
-- =============================================================================

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'usuario');
  end if;
end $$;

-- =============================================================================
-- 1. TABELAS DE AUTENTICAÇÃO E PERFIS (ID PADRONIZADO = auth.users.id)
-- =============================================================================

create table if not exists public.user_roles (
  id uuid not null,
  user_id uuid not null unique,
  role public.app_role not null default 'usuario'::public.app_role,
  created_at timestamp with time zone not null default now(),
  constraint user_roles_pkey primary key (id),
  constraint user_roles_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

create table if not exists public.profiles (
  id uuid not null,
  user_id uuid not null unique,
  nome text not null,
  email text not null unique,
  role public.app_role not null default 'usuario'::public.app_role,
  ativo boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint profiles_pkey primary key (id),
  constraint profiles_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

-- Padroniza os IDs existentes para que id seja sempre igual a user_id (auth.users.id)
update public.user_roles set id = user_id where id <> user_id;
update public.profiles set id = user_id where id <> user_id;

-- Garante que novos registros sem id explícito recebam auth.uid() por padrão
alter table public.user_roles alter column id set default auth.uid();
alter table public.profiles alter column id set default auth.uid();

-- =============================================================================
-- 2. TABELAS DE DADOS DO SISTEMA (ASSOCIADAS UNICAMENTE AO user_id DO USUÁRIO)
-- =============================================================================

-- 2.1 Clientes (whatsapp unificado como coluna única de Telefone/WhatsApp)
create table if not exists public.customers (
  id text not null default (gen_random_uuid())::text,
  user_id uuid not null default auth.uid(),
  nome text not null,
  documento text not null default ''::text,
  whatsapp text not null default ''::text,
  email text not null default ''::text,
  cep text not null default ''::text,
  endereco text not null default ''::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint customers_pkey primary key (user_id, id),
  constraint customers_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

-- Unifica telefone e whatsapp em customers: migra qualquer dado de telefone para whatsapp e remove a coluna duplicada telefone
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customers' and column_name = 'telefone'
  ) then
    execute $sql$
      update public.customers
      set whatsapp = coalesce(nullif(trim(whatsapp), ''), trim(telefone))
      where coalesce(trim(whatsapp), '') = ''
        and coalesce(trim(telefone), '') <> ''
    $sql$;

    alter table public.customers drop column telefone;
  end if;
end $$;

-- 2.2 Ordens de Serviço (vinculadas exclusivamente ao user_id, com numeração única por usuário)
create table if not exists public.service_orders (
  id text not null default (gen_random_uuid())::text,
  user_id uuid not null default auth.uid(),
  seq_numero integer not null default 1,
  numero text not null default ''::text,
  cliente text not null default ''::text,
  aparelho text not null,
  defeito text not null default ''::text,
  status text not null default 'Em Orçamento'::text,
  entrada text not null,
  finalizacao text,
  valor numeric not null default 0,
  custo_peca numeric not null default 0,
  equipamento text,
  serie text,
  estado text,
  acessorios text,
  sintomas text[] default '{}'::text[],
  laudo text default ''::text,
  tecnico text,
  servico text,
  pecas text,
  garantia text,
  observacoes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint service_orders_pkey primary key (user_id, id),
  constraint service_orders_user_id_numero_key unique (user_id, numero),
  constraint service_orders_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

-- Migra e remove colunas legadas duplicadas de service_orders caso existam
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'service_orders' and column_name = 'numero_serie'
  ) then
    execute $sql$
      update public.service_orders
      set serie = coalesce(nullif(trim(serie), ''), nullif(trim(numero_serie), ''))
      where coalesce(trim(serie), '') = '' and coalesce(trim(numero_serie), '') <> ''
    $sql$;
    alter table public.service_orders drop column numero_serie;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'service_orders' and column_name = 'servico_realizado'
  ) then
    execute $sql$
      update public.service_orders
      set servico = coalesce(nullif(trim(servico), ''), nullif(trim(servico_realizado), ''))
      where coalesce(trim(servico), '') = '' and coalesce(trim(servico_realizado), '') <> ''
    $sql$;
    alter table public.service_orders drop column servico_realizado;
  end if;

  alter table public.service_orders
    drop column if exists cliente_id,
    drop column if exists marca,
    drop column if exists modelo,
    drop column if exists cor,
    drop column if exists previsao,
    drop column if exists forma_pagamento;
end $$;

-- Garante constraint UNIQUE (user_id, numero) em service_orders para sincronização entre dispositivos
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.service_orders'::regclass
      and conname = 'service_orders_user_id_numero_key'
  ) then
    delete from public.service_orders a
    using public.service_orders b
    where a.user_id = b.user_id
      and a.numero = b.numero
      and a.ctid < b.ctid;

    alter table public.service_orders
      add constraint service_orders_user_id_numero_key unique (user_id, numero);
  end if;
end $$;

-- 2.3 Produtos em Estoque
create table if not exists public.products (
  id text not null default (gen_random_uuid())::text,
  user_id uuid not null default auth.uid(),
  nome text not null,
  sku text not null default ''::text,
  quantidade integer not null default 0,
  custo numeric not null default 0,
  venda numeric not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint products_pkey primary key (user_id, id),
  constraint products_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

-- 2.4 Fornecedores
create table if not exists public.suppliers (
  id text not null default (gen_random_uuid())::text,
  user_id uuid not null default auth.uid(),
  nome text not null,
  cnpj text not null default ''::text,
  telefone text not null default ''::text,
  endereco text not null default ''::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint suppliers_pkey primary key (user_id, id),
  constraint suppliers_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

-- 2.5 Notas de Compra de Estoque
create table if not exists public.purchase_invoices (
  id text not null default (gen_random_uuid())::text,
  user_id uuid not null default auth.uid(),
  fornecedor_id text not null,
  numero text not null default ''::text,
  data text not null,
  total numeric not null default 0,
  created_at timestamp with time zone not null default now(),
  constraint purchase_invoices_pkey primary key (user_id, id),
  constraint purchase_invoices_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

-- 2.6 Itens das Notas de Compra
create table if not exists public.purchase_invoice_items (
  id text not null default (gen_random_uuid())::text,
  user_id uuid not null default auth.uid(),
  nota_id text not null,
  produto_id text not null,
  quantidade integer not null default 1,
  valor_unit numeric not null default 0,
  created_at timestamp with time zone not null default now(),
  constraint purchase_invoice_items_pkey primary key (user_id, id),
  constraint purchase_invoice_items_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

-- 2.7 Vendas
create table if not exists public.sales (
  id text not null default (gen_random_uuid())::text,
  user_id uuid not null default auth.uid(),
  seq_numero integer not null default 1,
  numero integer not null,
  data_hora text not null,
  subtotal numeric not null default 0,
  desconto numeric not null default 0,
  arredondamento numeric not null default 0,
  total numeric not null default 0,
  valor_recebido_dinheiro numeric,
  troco numeric,
  created_at timestamp with time zone not null default now(),
  constraint sales_pkey primary key (user_id, id),
  constraint sales_user_id_numero_key unique (user_id, numero),
  constraint sales_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.sales'::regclass
      and conname = 'sales_user_id_numero_key'
  ) then
    delete from public.sales a
    using public.sales b
    where a.user_id = b.user_id
      and a.numero = b.numero
      and a.ctid < b.ctid;

    alter table public.sales
      add constraint sales_user_id_numero_key unique (user_id, numero);
  end if;
end $$;

-- 2.8 Itens das Vendas
create table if not exists public.sale_items (
  id text not null default (gen_random_uuid())::text,
  user_id uuid not null default auth.uid(),
  venda_id text not null,
  produto_id text not null,
  nome text not null,
  quantidade integer not null default 1,
  preco numeric not null default 0,
  custo_unit numeric not null default 0,
  created_at timestamp with time zone not null default now(),
  constraint sale_items_pkey primary key (user_id, id),
  constraint sale_items_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

-- 2.9 Pagamentos das Vendas
create table if not exists public.sale_payments (
  id text not null default (gen_random_uuid())::text,
  user_id uuid not null default auth.uid(),
  venda_id text not null,
  venda_numero integer,
  forma text not null,
  valor numeric not null default 0,
  valor_recebido numeric,
  data_hora timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  constraint sale_payments_pkey primary key (user_id, id),
  constraint sale_payments_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

-- 2.10 Movimentações de Caixa
create table if not exists public.cash_register_movements (
  id text not null default (gen_random_uuid())::text,
  user_id uuid not null default auth.uid(),
  tipo text not null,
  valor numeric not null default 0,
  descricao text not null default ''::text,
  data_hora text not null,
  origem_venda_id text,
  created_at timestamp with time zone not null default now(),
  constraint cash_register_movements_pkey primary key (user_id, id),
  constraint cash_register_movements_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

-- 2.11 Configurações e Perfil da Empresa (1 registro exclusivo por user_id)
create table if not exists public.store_settings (
  user_id uuid not null default auth.uid(),
  nome_empresa text not null default ''::text,
  cnpj text not null default ''::text,
  telefone text not null default ''::text,
  email text not null default ''::text,
  endereco text not null default ''::text,
  logo text not null default ''::text,
  paleta_cores text not null default 'azul-escuro'::text check (paleta_cores = any (array['verde-claro'::text, 'roxo'::text, 'azul-escuro'::text, 'ambar'::text, 'grafite'::text])),
  modo_tema text not null default 'light'::text check (modo_tema = any (array['light'::text, 'dark'::text])),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint store_settings_pkey primary key (user_id),
  constraint store_settings_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

-- 2.12 Controle de Tentativas de Login (Brute-force protection)
create table if not exists public.login_attempts (
  email text not null,
  failed_attempts integer not null default 0,
  locked_until timestamp with time zone,
  last_attempt_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint login_attempts_pkey primary key (email)
);

-- =============================================================================
-- 3. PADRONIZAÇÃO DE FOREIGN KEYS (ON DELETE CASCADE EM TODAS AS TABELAS)
-- =============================================================================

do $$
declare
  t text;
  con_name text;
begin
  foreach t in array array[
    'user_roles',
    'profiles',
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
  ] loop
    con_name := t || '_user_id_fkey';
    if exists (
      select 1 from pg_constraint
      where conrelid = ('public.' || t)::regclass and conname = con_name
    ) then
      execute format('alter table public.%I drop constraint %I', t, con_name);
    end if;
    execute format(
      'alter table public.%I add constraint %I foreign key (user_id) references auth.users(id) on delete cascade',
      t,
      con_name
    );
  end loop;
end $$;

-- =============================================================================
-- 4. TRIGGER PADRONIZADA DE CRIAÇÃO DE USUÁRIOS (id = user_id = auth.users.id)
-- =============================================================================

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

create or replace function public.handle_new_user_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role public.app_role;
  assigned_nome text;
begin
  -- Se ainda não existir nenhum admin, o primeiro usuário criado recebe admin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    assigned_role := 'admin';
  else
    assigned_role := coalesce(
      (new.raw_user_meta_data ->> 'role')::public.app_role,
      'usuario'::public.app_role
    );
  end if;

  assigned_nome := coalesce(
    new.raw_user_meta_data ->> 'nome',
    split_part(new.email, '@', 1)
  );

  -- Padroniza id = new.id e user_id = new.id em user_roles
  insert into public.user_roles (id, user_id, role)
  values (new.id, new.id, assigned_role)
  on conflict (user_id) do update set
    id = excluded.id,
    role = excluded.role;

  -- Padroniza id = new.id e user_id = new.id em profiles
  insert into public.profiles (id, user_id, nome, email, role, ativo)
  values (new.id, new.id, assigned_nome, lower(trim(new.email)), assigned_role, true)
  on conflict (user_id) do update set
    id = excluded.id,
    nome = excluded.nome,
    email = excluded.email,
    role = excluded.role;

  -- Inicializa store_settings em branco exclusivo para o novo usuário
  insert into public.store_settings (
    user_id, nome_empresa, cnpj, telefone, email, endereco, logo, paleta_cores, modo_tema
  )
  values (
    new.id, '', '', '', '', '', '', 'azul-escuro', 'light'
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_role on auth.users;
create trigger on_auth_user_created_role
  after insert on auth.users
  for each row execute function public.handle_new_user_role();

-- Sincroniza todos os usuários já existentes em auth.users com ID padronizado
insert into public.user_roles (id, user_id, role)
select
  u.id,
  u.id,
  case
    when lower(trim(u.email)) = 'alvoradatech2023@gmail.com' then 'admin'::public.app_role
    else coalesce((u.raw_user_meta_data ->> 'role')::public.app_role, 'usuario'::public.app_role)
  end
from auth.users u
on conflict (user_id) do update set id = excluded.id;

insert into public.profiles (id, user_id, nome, email, role, ativo)
select
  u.id,
  u.id,
  coalesce(u.raw_user_meta_data ->> 'nome', split_part(u.email, '@', 1)),
  lower(trim(u.email)),
  coalesce(ur.role, 'usuario'::public.app_role),
  true
from auth.users u
left join public.user_roles ur on ur.user_id = u.id
on conflict (user_id) do update set id = excluded.id;

-- =============================================================================
-- 5. ISOLAMENTO ESTRITO POR USUÁRIO (ROW LEVEL SECURITY - RLS)
-- Remove qualquer policy antiga permissiva ("Team can...") e garante que cada
-- usuário carregue e modifique SOMENTE os registros do seu próprio user_id.
-- =============================================================================

do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

-- Habilita e força RLS em todas as tabelas
alter table public.user_roles enable row level security;
alter table public.profiles enable row level security;
alter table public.login_attempts enable row level security;
alter table public.customers enable row level security;
alter table public.service_orders enable row level security;
alter table public.products enable row level security;
alter table public.suppliers enable row level security;
alter table public.purchase_invoices enable row level security;
alter table public.purchase_invoice_items enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.sale_payments enable row level security;
alter table public.cash_register_movements enable row level security;
alter table public.store_settings enable row level security;

-- Policies para user_roles e profiles (autenticação e gerenciamento de acessos pelo admin)
create policy "user_roles_select"
  on public.user_roles for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

create policy "user_roles_admin_all"
  on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "profiles_select"
  on public.profiles for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

create policy "profiles_admin_all"
  on public.profiles for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "login_attempts_admin_select"
  on public.login_attempts for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Policies de ISOLAMENTO ABSOLUTO (auth.uid() = user_id) nas 11 tabelas de dados:
-- Nenhum usuário (nem mesmo admin) mistura dados de negócio com outro usuário.
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
  ] loop
    execute format('
      create policy %I on public.%I
      for select to authenticated
      using (auth.uid() = user_id);

      create policy %I on public.%I
      for insert to authenticated
      with check (auth.uid() = user_id);

      create policy %I on public.%I
      for update to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);

      create policy %I on public.%I
      for delete to authenticated
      using (auth.uid() = user_id);
    ',
      t || '_strict_select_own', t,
      t || '_strict_insert_own', t,
      t || '_strict_update_own', t,
      t || '_strict_delete_own', t
    );
  end loop;
end $$;
