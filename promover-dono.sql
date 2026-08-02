-- Depois de criar a conta do dono no Supabase Auth,
-- copie o UUID do usuário e substitua abaixo:

insert into public.perfis (id,nome,role)
values ('COLE_O_UUID_DO_DONO','Dono da loja','dono')
on conflict (id) do update set nome='Dono da loja',role='dono';
