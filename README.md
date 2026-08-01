# PedidoFlow — Logins Separados

- index.html: cardápio público
- login.html: login e cadastro de clientes
- conta.html: área do cliente
- dono.html: login exclusivo do dono, sem cadastro
- admin.html: painel protegido
- supabase-login.sql: regras e tabela de perfis

## Publicação
Envie todos os arquivos ao GitHub e faça commit. A Vercel atualiza automaticamente.

## Importante
A conta do dono precisa existir no Supabase Auth e ter role = 'dono' na tabela perfis.
Clientes criados pelo site recebem apenas role = 'cliente'.
