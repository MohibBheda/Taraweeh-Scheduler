let _token = null;
let _expiry = 0;

async function getEbayToken() {
  if (_token && Date.now() < _expiry - 60000) return _token;

  const id     = process.env.EBAY_CLIENT_ID;
  const secret = process.env.EBAY_CLIENT_SECRET;
  if (!id || !secret) throw new Error('EBAY_CLIENT_ID and EBAY_CLIENT_SECRET not set');

  const creds = Buffer.from(`${id}:${secret}`).toString('base64');
  const res   = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${creds}`,
      'Content-Type':  'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope'
  });

  if (!res.ok) throw new Error(`eBay auth failed: ${res.status}`);
  const data  = await res.json();
  _token  = data.access_token;
  _expiry = Date.now() + data.expires_in * 1000;
  return _token;
}

module.exports = { getEbayToken };
