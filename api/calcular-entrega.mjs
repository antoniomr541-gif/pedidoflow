const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const digits = value => String(value || '').replace(/\D/g, '');

async function fetchJson(url, label) {
  const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'PedidoFlow/3.5' } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${label} não encontrado.`);
  return data;
}

function coordinatesFromCep(data) {
  const coords = data?.location?.coordinates || {};
  const longitude = Number(coords.longitude);
  const latitude = Number(coords.latitude);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    throw new Error('Não foi possível localizar esse CEP no mapa. Confira o CEP ou informe outro próximo.');
  }
  return { longitude, latitude };
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
    try {
      const { cep } = await request.json();
      const customerCep = digits(cep);
      if (customerCep.length !== 8) return json({ error: 'Informe um CEP válido com 8 números.' }, 400);

      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !serviceKey) throw new Error('Configuração do servidor incompleta.');

      const configResponse = await fetch(`${supabaseUrl}/rest/v1/configuracoes?select=cep_loja,valor_km,taxa_minima_entrega,distancia_maxima_km,taxa_entrega&order=id&limit=1`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
      });
      const configs = await configResponse.json().catch(() => []);
      if (!configResponse.ok || !configs?.length) throw new Error('Configure a entrega no painel do dono.');
      const config = configs[0];
      const storeCep = digits(config.cep_loja);
      if (storeCep.length !== 8) throw new Error('O CEP da loja ainda não foi configurado.');

      const [storeData, customerData] = await Promise.all([
        fetchJson(`https://brasilapi.com.br/api/cep/v2/${storeCep}`, 'CEP da loja'),
        fetchJson(`https://brasilapi.com.br/api/cep/v2/${customerCep}`, 'CEP do cliente')
      ]);
      const store = coordinatesFromCep(storeData);
      const customer = coordinatesFromCep(customerData);

      const routeUrl = `https://router.project-osrm.org/route/v1/driving/${store.longitude},${store.latitude};${customer.longitude},${customer.latitude}?overview=false&alternatives=false&steps=false`;
      const route = await fetchJson(routeUrl, 'Rota');
      const distanceMeters = Number(route?.routes?.[0]?.distance);
      if (!Number.isFinite(distanceMeters)) throw new Error('Não foi possível calcular uma rota até esse CEP.');

      const distanceKm = distanceMeters / 1000;
      const maximumDistance = Number(config.distancia_maxima_km || 0);
      if (maximumDistance > 0 && distanceKm > maximumDistance) {
        return json({ error: `Esse endereço fica a ${distanceKm.toFixed(1).replace('.', ',')} km. A loja entrega até ${maximumDistance.toFixed(1).replace('.', ',')} km.` }, 422);
      }

      const pricePerKm = Math.max(0, Number(config.valor_km || 0));
      const minimumFee = Math.max(0, Number(config.taxa_minima_entrega ?? config.taxa_entrega ?? 0));
      const fee = Math.round(Math.max(minimumFee, distanceKm * pricePerKm) * 100) / 100;

      return json({
        fee,
        distanceKm: Math.round(distanceKm * 10) / 10,
        address: {
          cep: customerData.cep || customerCep,
          street: customerData.street || '',
          neighborhood: customerData.neighborhood || '',
          city: customerData.city || '',
          state: customerData.state || ''
        }
      });
    } catch (error) {
      return json({ error: error.message || 'Não foi possível calcular a entrega.' }, 500);
    }
  }
};
