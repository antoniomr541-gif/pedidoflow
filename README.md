# PedidoFlow V3 — Versão para apresentação

## O que foi revisado
- telefone aceita somente números e aplica máscara;
- nome validado;
- endereço, número e bairro obrigatórios para entrega;
- retirada oculta os campos de endereço;
- troco validado quando o pagamento é dinheiro;
- dados do cliente ficam salvos no navegador;
- pedidos aparecem no painel do dono;
- pedido mostra cliente, telefone, endereço, pagamento, observações e itens;
- alteração de status;
- botão para abrir WhatsApp do cliente;
- painel com contador de pedidos pendentes;
- cardápio de demonstração incluso.

## Instalação
1. Execute `supabase-v3.sql`.
2. Envie os arquivos HTML e `styles.css` ao GitHub.
3. Crie a conta do dono no Supabase Authentication.
4. Edite e execute `promover-dono.sql`.
5. No painel, configure WhatsApp, Pix, taxa e status da loja.

## Links
- `/` cardápio
- `/login.html` cliente
- `/dono.html` dono
- `/admin.html` painel
