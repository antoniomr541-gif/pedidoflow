const digits = (value = '') => String(value).replace(/\D/g, '');

function normalizeBrazilPhone(value) {
  let phone = digits(value);
  if (!phone) return '';
  if (!phone.startsWith('55')) phone = `55${phone}`;
  return phone;
}

async function verifyOwner(req) {
  const authorization = req.headers.authorization || '';
  const accessToken = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!accessToken) throw new Error('Sessão não enviada. Entre novamente no painel.');

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${accessToken}`
    }
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
  return user;
}

async function sendTemplate({ to, customerName, message, imageUrl, link }) {
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v23.0';
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME;
  const languageCode = process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'pt_BR';

  const components = [
    {
      type: 'header',
      parameters: [{ type: 'image', image: { link: imageUrl } }]
    },
    {
      type: 'body',
      parameters: [
        { type: 'text', text: customerName || 'Cliente' },
        { type: 'text', text: message }
      ]
    }
  ];

  if (link) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: link }]
    });
  }

  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components
        }
      })
    }
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.error?.error_data?.details || payload?.error?.message || 'Erro da API do WhatsApp.';
    throw new Error(detail);
  }
  return payload;
}

async function saveCampaign({ title, message, imageUrl, link, sent, failed, status }) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const response = await fetch(`${supabaseUrl}/rest/v1/campanhas`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({
      titulo: title,
      mensagem: message,
      imagem_url: imageUrl,
      link,
      enviados: sent,
      falhas: failed,
      status
    })
  });
  return response.ok;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const required = [
    'WHATSAPP_TOKEN',
    'WHATSAPP_PHONE_NUMBER_ID',
    'WHATSAPP_TEMPLATE_NAME',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    return res.status(500).json({ error: `Variáveis ausentes na Vercel: ${missing.join(', ')}` });
  }

  try {
    await verifyOwner(req);
    const body = req.body || {};
    const title = String(body.title || 'Campanha').trim().slice(0, 120);
    const message = String(body.message || '').trim().slice(0, 700);
    const imageUrl = String(body.imageUrl || '').trim();
    const link = String(body.link || '').trim();
    const recipients = Array.isArray(body.recipients) ? body.recipients.slice(0, 50) : [];

    if (!message) return res.status(400).json({ error: 'Digite a mensagem da promoção.' });
    if (!/^https:\/\//i.test(imageUrl)) return res.status(400).json({ error: 'A imagem precisa ter uma URL pública HTTPS.' });
    if (!recipients.length) return res.status(400).json({ error: 'Nenhum destinatário recebido.' });

    let sent = 0;
    let failed = 0;
    const results = [];

    for (const recipient of recipients) {
      const to = normalizeBrazilPhone(recipient.whatsapp);
      if (!to) {
        failed += 1;
        results.push({ id: recipient.id, ok: false, error: 'Telefone inválido.' });
        continue;
      }

      try {
        const response = await sendTemplate({
          to,
          customerName: String(recipient.nome || 'Cliente').slice(0, 60),
          message,
          imageUrl,
          link
        });
        sent += 1;
        results.push({ id: recipient.id, ok: true, messageId: response?.messages?.[0]?.id || null });
      } catch (error) {
        failed += 1;
        results.push({ id: recipient.id, ok: false, error: error.message });
      }
    }

    await saveCampaign({
      title,
      message,
      imageUrl,
      link,
      sent,
      failed,
      status: failed === 0 ? 'Concluída' : sent ? 'Parcial' : 'Falhou'
    });

    return res.status(200).json({ sent, failed, results });
  } catch (error) {
    return res.status(401).json({ error: error.message || 'Erro interno.' });
  }
}
