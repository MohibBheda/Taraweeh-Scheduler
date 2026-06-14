const { getEbayToken } = require('./ebayAuthService');

async function getSoldComps(query) {
  const appId = process.env.EBAY_APP_ID;
  if (!appId) return null;
  try {
    const params = new URLSearchParams({
      'OPERATION-NAME':              'findCompletedItems',
      'SERVICE-VERSION':             '1.0.0',
      'SECURITY-APPNAME':            appId,
      'RESPONSE-DATA-FORMAT':        'JSON',
      'keywords':                    query,
      'itemFilter(0).name':          'SoldItemsOnly',
      'itemFilter(0).value':         'true',
      'sortOrder':                   'EndTimeSoonest',
      'paginationInput.entriesPerPage': '25'
    });
    const res  = await fetch(`https://svcs.ebay.com/services/search/FindingService/v1?${params}`);
    if (!res.ok) return null;
    const data  = await res.json();
    const items = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || [];
    const prices = items
      .filter(i => i.sellingStatus?.[0]?.sellingState?.[0] === 'EndedWithSales')
      .map(i => parseFloat(i.sellingStatus[0].currentPrice[0].__value__))
      .filter(p => Number.isFinite(p) && p > 0);
    if (!prices.length) return null;
    const avg = parseFloat((prices.reduce((s,p) => s+p, 0) / prices.length).toFixed(2));
    return { prices, count: prices.length, avg };
  } catch { return null; }
}

async function getActiveListings(query) {
  if (!process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET) return null;
  try {
    const token  = await getEbayToken();
    const params = new URLSearchParams({ q: query, limit: '50', filter: 'buyingOptions:{FIXED_PRICE}' });
    const res    = await fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' }
    });
    if (!res.ok) return null;
    const data   = await res.json();
    const items  = data.itemSummaries || [];
    return {
      count:  data.total || 0,
      prices: items.map(i => parseFloat(i.price?.value || 0)).filter(p => p > 0)
    };
  } catch { return null; }
}

module.exports = { getSoldComps, getActiveListings };
