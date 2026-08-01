# PedidoFlow — Dois Logins

Arquivos:
- index.html: cardápio público
- login.html: login de cliente e dono
- conta.html: área do cliente
- admin.html: painel protegido do dono
- supabase-login.sql: configuração obrigatória do banco

## Ordem
1. Execute supabase-login.sql no SQL Editor.
2. Publique todos os arquivos no GitHub.
3. Crie a conta que será do dono em login.html.
4. Em Authentication > Users, copie o UUID da conta.
5. Execute o último INSERT indicado em supabase-login.sql para marcar a conta como dono.

Clientes podem criar suas próprias contas. Eles nunca conseguem se tornar donos pelo navegador.
