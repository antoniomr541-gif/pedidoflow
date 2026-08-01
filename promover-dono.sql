-- Substitua pelo e-mail real do dono e execute:

insert into public.perfis (id,nome,role)
select id,'Dono da loja','dono'
from auth.users
where email='EMAIL_DO_DONO'
on conflict(id) do update set nome='Dono da loja',role='dono';
