const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const digits=value=>String(value||'').replace(/\D/g,'');
function phoneBR(value){let p=digits(value);if(!p)return'';return p.startsWith('55')?p:`55${p}`}

async function verifyOwner(request){
  const accessToken=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
  if(!accessToken)throw new Error('Sessão não enviada.');
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const u=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:`Bearer ${accessToken}`}});
  if(!u.ok)throw new Error('Sessão inválida ou expirada.');
  const user=await u.json();
  const r=await fetch(`${url}/rest/v1/perfis?id=eq.${encodeURIComponent(user.id)}&select=role&limit=1`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
  const profiles=await r.json();
  if(profiles?.[0]?.role!=='dono')throw new Error('Acesso permitido somente ao dono.');
}

export default {async fetch(request){
  if(request.method!=='POST')return json({error:'Método não permitido.'},405);
  const needed=['WHATSAPP_TOKEN','WHATSAPP_PHONE_NUMBER_ID','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];
  const missing=needed.filter(k=>!process.env[k]);
  if(missing.length)return json({error:`Variáveis ausentes: ${missing.join(', ')}`},500);
  try{
    await verifyOwner(request);
    const {pedido={}}=await request.json();
    const to=phoneBR(pedido.cliente_telefone);
    if(!to)return json({error:'O pedido não possui telefone válido.'},400);
    const templateName=process.env.WHATSAPP_STATUS_TEMPLATE_NAME||'pedido_status';
    const language=process.env.WHATSAPP_STATUS_TEMPLATE_LANGUAGE||'pt_BR';
    const apiVersion=process.env.WHATSAPP_API_VERSION||'v25.0';
    const body={messaging_product:'whatsapp',recipient_type:'individual',to,type:'template',template:{name:templateName,language:{code:language},components:[{type:'body',parameters:[{type:'text',text:String(pedido.numero||pedido.id||'')},{type:'text',text:String(pedido.status||'Atualizado')}]}]}};
    const response=await fetch(`https://graph.facebook.com/${apiVersion}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{method:'POST',headers:{Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok){const e=payload?.error;throw new Error(e?.error_data?.details||e?.message||'Erro retornado pelo WhatsApp.');}
    return json({sent:true,messageId:payload?.messages?.[0]?.id||null});
  }catch(error){return json({error:error.message||'Erro ao avisar o cliente.'},400)}
}};
