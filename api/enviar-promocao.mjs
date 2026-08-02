const json = (data, status = 200) => Response.json(data, {
  status,
  headers: { 'Cache-Control': 'no-store' }
});

const digits = (value = '') => String(value).replace(/\D/g, '');

function normalizeBrazilPhone(value) {
  let phone = digits(value);
  if (!phone) return '';
  if (!phone.startsWith('55')) phone = `55${phone}`;
  return phone;
}

async function verifyOwner(request) {
  const authorization = request.headers.get('authorization') || '';
  const accessToken = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!accessToken) throw new Error('Sessão não enviada. Entre novamente no painel.');

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${accessToken}` }
  });
  if (!userResponse.ok) throw new Error('Sessão inválida ou expirada.');
  const user = await userResponse.json();

  const roleResponse = await fetch(
    `${supabaseUrl}/rest/v1/perfis?id=eq.${encodeURIComponent(user.id)}&select=role&limit=1`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  if (!roleResponse.ok) throw new Error('Não foi possível validar o dono da loja.');
  const profiles = await roleResponse.json();
  if (profiles?.[0]?.role !== 'dono') throw new Error('Acesso permitido somente ao dono.');
}

async function sendTemplate(to) {
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v25.0';
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || 'hello_world';
  const languageCode = process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en_US';

  // Teste limpo: não envia imagem, legenda nem botão. O template padrão não aceita componentes.
  const requestBody = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode }
    }
  };

  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    }
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const meta = payload?.error || {};
    const details = meta?.error_data?.details || meta?.message || 'Erro da API do WhatsApp.';
    const code = meta?.code ? ` (#${meta.code})` : '';
    const subcode = meta?.error_subcode ? ` subcódigo ${meta.error_subcode}` : '';
    throw new Error(`${details}${code}${subcode}`);
  }
  return payload;
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

    const required = [
      'WHATSAPP_TOKEN',
      'WHATSAPP_PHONE_NUMBER_ID',
      'WHATSAPP_TEMPLATE_NAME',
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY'
    ];
    const missing = required.filter((name) => !process.env[name]);
    if (missing.length) return json({ error: `Variáveis ausentes: ${missing.join(', ')}` }, 500);

    try {
      await verifyOwner(request);
      const body = await request.json();
      const received = Array.isArray(body.recipients) ? body.recipients : [];

      const unique = [];
      const seen = new Set();
      for (const recipient of received) {
        const phone = normalizeBrazilPhone(recipient.whatsapp);
        if (!phone || seen.has(phone)) continue;
        seen.add(phone);
        unique.push({ id: recipient.id, nome: recipient.nome || 'Cliente', phone });
      }

      if (!unique.length) return json({ error: 'Nenhum telefone válido recebido.' }, 400);

      let sent = 0;
      let failed = 0;
      const results = [];

      for (const recipient of unique) {
        try {
          const response = await sendTemplate(recipient.phone);
          sent += 1;
          results.push({
            id: recipient.id,
            nome: recipient.nome,
            telefone: recipient.phone,
            ok: true,
            messageId: response?.messages?.[0]?.id || null
          });
        } catch (error) {
          failed += 1;
          const item = {
            id: recipient.id,
            nome: recipient.nome,
            telefone: recipient.phone,
            ok: false,
            error: error.message
          };
          results.push(item);
          console.error('WHATSAPP_SEND_ERROR', JSON.stringify(item));
        }
      }

      return json({
        sent,
        failed,
        totalReceived: received.length,
        totalUnique: unique.length,
        template: process.env.WHATSAPP_TEMPLATE_NAME,
        results
      });
    } catch (error) {
      console.error('CAMPAIGN_ERROR', error);
      return json({ error: error.message || 'Erro interno.' }, 401);
    }
  }
};
