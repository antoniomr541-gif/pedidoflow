# PedidoFlow 2.1 — Cliente sem e-mail

Esta versão remove definitivamente o cadastro do cliente pelo Supabase Auth.

## Cliente
- cadastro por nome, celular, senha e endereço;
- senha armazenada com hash;
- sem e-mail;
- sem confirmação;
- sem Twilio;
- sem `email rate limit exceeded`;
- dados preenchidos automaticamente nos próximos pedidos;
- histórico de pedidos por sessão segura.

## Dono
O dono continua entrando em `dono.html` com a conta do Supabase Authentication.

## Instalação
1. Execute `instalar-cliente-sem-email.sql` no SQL Editor.
2. Substitua no GitHub:
   - index.html
   - login.html
   - conta.html
   - admin.html
3. Mantenha `dono.html` e `styles.css`.
4. Faça commit e aguarde o deploy.

## Teste
1. Abra em janela anônima.
2. Adicione produto.
3. Finalize.
4. Crie conta com celular e senha.
5. Volte ao cardápio.
6. Finalize o pedido.
7. Confira em Painel do dono > Pedidos.


## Atualização
- Termos obrigatórios no cadastro.
- Promoções destacadas e marcadas por padrão, mas opcionais.
