# Flow Pedidos 2.3

Versão completa e responsiva do sistema de pedidos.

## Recursos incluídos
- cardápio público responsivo;
- busca e categorias;
- carrinho e observações por item;
- cadastro obrigatório antes do primeiro pedido;
- cadastro sem e-mail, usando celular e senha;
- aceite obrigatório dos termos;
- autorização de promoções destacada;
- dados e endereço salvos para próximos pedidos;
- histórico na área do cliente;
- pedido salvo no Supabase antes de abrir o WhatsApp;
- painel do dono com dashboard, pedidos, produtos e clientes;
- alteração de status dos pedidos;
- central de marketing com mensagem e banner;
- exportação CSV dos clientes autorizados;
- layout otimizado para celular, tablet e computador.

## Instalação
1. Abra o Supabase e acesse **SQL Editor > New query**.
2. Execute todo o arquivo `instalar-cliente-sem-email.sql`.
3. No Supabase Authentication, crie a conta do dono.
4. Publique todos os arquivos desta pasta no GitHub, Netlify ou Vercel.
5. Acesse `dono.html` para entrar no painel administrativo.

## Páginas
- `index.html`: cardápio;
- `login.html`: cadastro e entrada do cliente;
- `conta.html`: conta e histórico do cliente;
- `dono.html`: login do dono;
- `admin.html`: painel administrativo.

## Marketing no WhatsApp
O sistema gera a mensagem e exporta um CSV apenas com clientes que aceitaram receber promoções. O disparo automático para todos exige integração oficial com a Plataforma WhatsApp Business.

## Atualização — WhatsApp com imagens

### 1. Atualizar o Supabase
Execute `atualizar-whatsapp-imagens.sql` no SQL Editor. Ele cria:
- bucket público `promocoes` para os banners;
- tabela `campanhas`;
- tabela `campanha_envios`;
- políticas para que apenas o dono gerencie campanhas.

### 2. Configurar a API oficial no Netlify
Em **Site configuration → Environment variables**, adicione:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WHATSAPP_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_TEMPLATE_NAME`
- `WHATSAPP_TEMPLATE_LANGUAGE` = `pt_BR`
- `WHATSAPP_GRAPH_VERSION` = versão atual configurada na Meta

Nunca coloque o token ou a service role dentro dos arquivos HTML.

### 3. Modelo exigido na Meta
Crie e aprove um modelo de marketing com esta estrutura:
- cabeçalho: imagem variável;
- corpo: `Olá, {{1}}! {{2}}`;
- botão de URL: `Pedir agora`, com parte variável.

O nome aprovado deve ser usado em `WHATSAPP_TEMPLATE_NAME`.

### 4. Publicação pelo GitHub
Envie todos os arquivos desta pasta para o mesmo repositório. O Netlify reconhecerá automaticamente as funções dentro de `netlify/functions`.

### Uso sem API
Mesmo antes de configurar a Meta, a tela permite:
- criar e visualizar o banner;
- copiar a legenda;
- baixar a imagem;
- exportar os clientes autorizados.
