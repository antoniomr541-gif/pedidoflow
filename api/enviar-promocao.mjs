const json = (data, status = 200) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" }
  });

const onlyNumbers = (value = "") => String(value).replace(/\D/g, "");

function normalizePhone(value) {
  let phone = onlyNumbers(value);

  if (!phone) return "";

  if (!phone.startsWith("55")) {
    phone = `55${phone}`;
  }

  return phone;
}

async function verifyOwner(request) {
  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();

  if (!accessToken) {
    throw new Error("Sessão não enviada. Entre novamente no painel.");
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!userResponse.ok) {
    throw new Error("Sessão inválida ou expirada.");
  }

  const user = await userResponse.json();

  const roleResponse = await fetch(
    `${supabaseUrl}/rest/v1/perfis?id=eq.${encodeURIComponent(
      user.id
    )}&select=role&limit=1`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`
      }
    }
  );

  if (!roleResponse.ok) {
    throw new Error("Não foi possível validar o dono da loja.");
  }

  const profiles = await roleResponse.json();

  if (profiles?.[0]?.role !== "dono") {
    throw new Error("Acesso permitido somente ao dono.");
  }
}

async function sendWhatsAppTemplate(to) {
  const apiVersion = process.env.WHATSAPP_API_VERSION || "v25.0";
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || "hello_world";
  const token = process.env.WHATSAPP_TOKEN;

  /*
   * Nesta primeira validação usamos o template de teste sem imagem,
   * legenda personalizada ou botão.
   */
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: templateName === "hello_world" ? "en_US" : "en_US"
      }
    }
  };

  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const metaError = payload?.error;

    const message =
      metaError?.error_data?.details ||
      metaError?.message ||
      "Erro desconhecido retornado pelo WhatsApp.";

    const code = metaError?.code ? ` Código ${metaError.code}.` : "";

    throw new Error(`${message}${code}`);
  }

  return payload;
}

async function saveCampaign({
  title,
  message,
  imageUrl,
  link,
  sent,
  failed,
  status
}) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    await fetch(`${supabaseUrl}/rest/v1/campanhas`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
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
  } catch (error) {
    console.error("Não foi possível salvar o histórico:", error);
  }
}

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return json({ error: "Método não permitido." }, 405);
    }

    const requiredVariables = [
      "WHATSAPP_TOKEN",
      "WHATSAPP_PHONE_NUMBER_ID",
      "WHATSAPP_TEMPLATE_NAME",
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY"
    ];

    const missing = requiredVariables.filter(
      variable => !process.env[variable]
    );

    if (missing.length) {
      return json(
        {
          error: `Variáveis ausentes na Vercel: ${missing.join(", ")}`
        },
        500
      );
    }

    try {
      await verifyOwner(request);

      const body = await request.json();

      const title = String(body.title || "Campanha").trim().slice(0, 120);
      const message = String(body.message || "").trim().slice(0, 700);
      const imageUrl = String(body.imageUrl || "").trim();
      const link = String(body.link || "").trim();

      const receivedRecipients = Array.isArray(body.recipients)
        ? body.recipients
        : [];

      /*
       * Remove números repetidos para impedir envio duplicado.
       */
      const uniqueRecipients = [];
      const usedPhones = new Set();

      for (const recipient of receivedRecipients) {
        const phone = normalizePhone(recipient.whatsapp);

        if (!phone || usedPhones.has(phone)) {
          continue;
        }

        usedPhones.add(phone);

        uniqueRecipients.push({
          id: recipient.id,
          nome: recipient.nome || "Cliente",
          phone
        });
      }

      if (!uniqueRecipients.length) {
        return json({ error: "Nenhum telefone válido foi recebido." }, 400);
      }

      let sent = 0;
      let failed = 0;
      const results = [];

      for (const recipient of uniqueRecipients) {
        try {
          const response = await sendWhatsAppTemplate(recipient.phone);

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

          results.push({
            id: recipient.id,
            nome: recipient.nome,
            telefone: recipient.phone,
            ok: false,
            error: error.message
          });
        }
      }

      await saveCampaign({
        title,
        message,
        imageUrl,
        link,
        sent,
        failed,
        status:
          failed === 0
            ? "Concluída"
            : sent > 0
              ? "Parcial"
              : "Falhou"
      });

      return json({
        sent,
        failed,
        totalReceived: receivedRecipients.length,
        totalUnique: uniqueRecipients.length,
        results
      });
    } catch (error) {
      return json(
        {
          error: error.message || "Erro interno na campanha."
        },
        401
      );
    }
  }
};
