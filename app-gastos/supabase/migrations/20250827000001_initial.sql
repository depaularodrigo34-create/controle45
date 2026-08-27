-- Migration: Controle de Gastos — Supabase Auth + RLS
-- Tabelas: profiles, transactions, budgets, shopping_items, goals
-- Dinheiro sempre em *_cents (bigint), nunca float

-- profiles (1:1 com auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- transactions
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('receita','despesa')),
  amount_cents bigint not null check (amount_cents >= 0),
  category text,
  description text,
  transaction_date date not null,
  person_name text,
  payment_method text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_transactions_user_date on public.transactions(user_id, transaction_date desc);
create index if not exists idx_transactions_user_type on public.transactions(user_id, type);

-- budgets
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  limit_cents bigint not null check (limit_cents >= 0),
  reference_month date not null, -- sempre dia 01 do mês
  created_at timestamptz default now(),
  unique(user_id, category, reference_month)
);
create index if not exists idx_budgets_user_month on public.budgets(user_id, reference_month);

-- shopping_items
create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  estimated_amount_cents bigint,
  purchased boolean not null default false,
  created_at timestamptz default now()
);
create index if not exists idx_shopping_user on public.shopping_items(user_id);

-- goals
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount_cents bigint not null check (target_amount_cents > 0),
  current_amount_cents bigint not null default 0 check (current_amount_cents >= 0),
  created_at timestamptz default now()
);
create index if not exists idx_goals_user on public.goals(user_id);

-- Trigger para updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_transactions_updated_at on public.transactions;
create trigger trg_transactions_updated_at before update on public.transactions for each row execute function public.handle_updated_at();

-- Trigger para criar profile automaticamente
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.shopping_items enable row level security;
alter table public.goals enable row level security;

-- profiles policies (id = auth.uid())
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles for delete using (auth.uid() = id);

-- transactions policies (user_id = auth.uid())
drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own" on public.transactions for select using (auth.uid() = user_id);
drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own" on public.transactions for insert with check (auth.uid() = user_id);
drop policy if exists "transactions_update_own" on public.transactions;
create policy "transactions_update_own" on public.transactions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "transactions_delete_own" on public.transactions;
create policy "transactions_delete_own" on public.transactions for delete using (auth.uid() = user_id);

-- budgets policies
drop policy if exists "budgets_select_own" on public.budgets;
create policy "budgets_select_own" on public.budgets for select using (auth.uid() = user_id);
drop policy if exists "budgets_insert_own" on public.budgets;
create policy "budgets_insert_own" on public.budgets for insert with check (auth.uid() = user_id);
drop policy if exists "budgets_update_own" on public.budgets;
create policy "budgets_update_own" on public.budgets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "budgets_delete_own" on public.budgets;
create policy "budgets_delete_own" on public.budgets for delete using (auth.uid() = user_id);

-- shopping_items policies
drop policy if exists "shopping_select_own" on public.shopping_items;
create policy "shopping_select_own" on public.shopping_items for select using (auth.uid() = user_id);
drop policy if exists "shopping_insert_own" on public.shopping_items;
create policy "shopping_insert_own" on public.shopping_items for insert with check (auth.uid() = user_id);
drop policy if exists "shopping_update_own" on public.shopping_items;
create policy "shopping_update_own" on public.shopping_items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "shopping_delete_own" on public.shopping_items;
create policy "shopping_delete_own" on public.shopping_items for delete using (auth.uid() = user_id);

-- goals policies
drop policy if exists "goals_select_own" on public.goals;
create policy "goals_select_own" on public.goals for select using (auth.uid() = user_id);
drop policy if exists "goals_insert_own" on public.goals;
create policy "goals_insert_own" on public.goals for insert with check (auth.uid() = user_id);
drop policy if exists "goals_update_own" on public.goals;
create policy "goals_update_own" on public.goals for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "goals_delete_own" on public.goals;
create policy "goals_delete_own" on public.goals for delete using (auth.uid() = user_id);

-- Comentário sobre isolamento:
-- Cada política usa auth.uid() = user_id, garantindo que usuário A não lê/escreve dados de B mesmo alterando chamadas no navegador.
-- Não há políticas com USING (true); RLS está ativo em todas as tabelas.
