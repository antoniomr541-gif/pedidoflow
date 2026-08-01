-- EXECUTE ESTE ARQUIVO UMA VEZ NO SQL EDITOR DO SUPABASE

create table if not exists public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text default '',
  role text not null default 'cliente' check (role in ('cliente','dono')),
  criado_em timestamptz default now()
);

alter table public.perfis enable row level security;

drop policy if exists "Usuário lê próprio perfil" on public.perfis;
create policy "Usuário lê próprio perfil"
on public.perfis for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Cliente cria próprio perfil" on public.perfis;
create policy "Cliente cria próprio perfil"
on public.perfis for insert
to authenticated
with check ((select auth.uid()) = id and role = 'cliente');

drop policy if exists "Usuário atualiza próprio nome" on public.perfis;
create policy "Usuário atualiza próprio nome"
on public.perfis for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id and role = 'cliente');

-- Protege alterações dos produtos: somente o dono autenticado.
drop policy if exists "Permitir cadastro de produtos" on public.produtos;
drop policy if exists "Permitir edição de produtos" on public.produtos;
drop policy if exists "Permitir exclusão de produtos" on public.produtos;

create policy "Dono cadastra produtos"
on public.produtos for insert
to authenticated
with check (
  exists (select 1 from public.perfis p where p.id = (select auth.uid()) and p.role = 'dono')
);

create policy "Dono edita produtos"
on public.produtos for update
to authenticated
using (
  exists (select 1 from public.perfis p where p.id = (select auth.uid()) and p.role = 'dono')
)
with check (
  exists (select 1 from public.perfis p where p.id = (select auth.uid()) and p.role = 'dono')
);

create policy "Dono exclui produtos"
on public.produtos for delete
to authenticated
using (
  exists (select 1 from public.perfis p where p.id = (select auth.uid()) and p.role = 'dono')
);

drop policy if exists "Permitir cadastro de configurações" on public.configuracoes;
drop policy if exists "Permitir edição de configurações" on public.configuracoes;

create policy "Dono cadastra configurações"
on public.configuracoes for insert
to authenticated
with check (
  exists (select 1 from public.perfis p where p.id = (select auth.uid()) and p.role = 'dono')
);

create policy "Dono edita configurações"
on public.configuracoes for update
to authenticated
using (
  exists (select 1 from public.perfis p where p.id = (select auth.uid()) and p.role = 'dono')
)
with check (
  exists (select 1 from public.perfis p where p.id = (select auth.uid()) and p.role = 'dono')
);

-- DEPOIS:
-- 1. Abra login.html e crie uma conta normalmente.
-- 2. No Supabase, vá em Authentication > Users e copie o UUID da conta do dono.
-- 3. Troque COLE_O_UUID_DO_DONO e execute apenas o comando abaixo:
--
-- insert into public.perfis (id, nome, role)
-- values ('COLE_O_UUID_DO_DONO', 'Dono da loja', 'dono')
-- on conflict (id) do update set role='dono', nome='Dono da loja';
