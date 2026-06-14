const { getDb } = require('../db/database');

/**
 * Conservative multiplier ranges by category keyword.
 * Applied only when real comps are not provided.
 * These are NOT prices — they are anchor-relative multipliers.
 *
 * low_mult  = pessimistic sold price / purchase price
 * high_mult = optimistic sold price / purchase price
 *
 * The estimate uses a conservative blend (35th percentile of the range)
 * to avoid overstating expected returns.
 */
const CATEGORY_RANGES = {
  smartphones:  { low: 0.50, high: 1.80, note: 'Model + carrier + storage drive price heavily' },
  laptops:      { low: 0.30, high: 1.20, note: 'Spec-verify before buying; condition-critical' },
  gaming:       { low: 0.60, high: 2.00, note: 'Trend-sensitive; check current demand' },
  electronics:  { low: 0.40, high: 2.50, note: 'High variance; always pull real comps' },
  tools:        { low: 0.50, high: 1.50, note: 'Stable demand; brand matters (Milwaukee, DeWalt)' },
  clothing:     { low: 0.20, high: 3.00, note: 'Brand + size critical; check sold 90 days' },
  collectibles: { low: 0.10, high: 10.0, note: 'Extremely variable — expert comps required' },
  jewelry:      { low: 0.30, high: 5.00, note: 'Verify authenticity and metal spot value' },
  books:        { low: 0.10, high: 2.00, note: 'ISBN-level comps required; check all editions' },
  furniture:    { low: 0.20, high: 1.50, note: 'Shipping often prohibitive; prefer local pickup' },
  appliances:   { low: 0.25, high: 0.90, note: 'Shipping cost often kills margin' },
  sporting:     { low: 0.30, high: 1.80, note: 'Season-sensitive; verify off-season demand' },
};

/**
 * getMarketData(query, options)
 *
 * Priority order:
 *   1. DB cache (valid ≤ 7 days)
 *   2. User-provided comparable_sales[]
 *   3. Category-based conservative estimate (labeled ESTIMATE)
 *   4. No data — returns insufficient_data: true
 *
 * IMPORTANT: This function never generates specific prices from thin air.
 * All estimates are clearly labeled with their source and confidence level.
 */
async function getMarketData(query, options = {}) {
  const { purchasePrice, category, providedComps, forceRefresh = false } = options;

  if (!forceRefresh) {
    const cached = getCached(query);
    if (cached) return cached;
  }

  if (Array.isArray(providedComps) && providedComps.length > 0) {
    return buildFromComps(query, providedComps);
  }

  if (purchasePrice && category) {
    return buildCategoryEstimate(query, purchasePrice, category);
  }

  return {
    item_query: query,
    avg_sold_price: null,
    sold_range_low: null,
    sold_range_high: null,
    sample_size: 0,
    data_source: 'none',
    confidence: 'none',
    insufficient_data: true,
    note: 'No market data. Provide comparable_sales[] or both category + purchase_price.'
  };
}

function getCached(query) {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM market_data
    WHERE item_query = ?
      AND datetime(updated_at) > datetime('now', '-7 days')
  `).get(query.toLowerCase().trim());
  if (!row) return null;
  return { ...row, from_cache: true };
}

function buildFromComps(query, comps) {
  const prices = comps.map(Number).filter(p => Number.isFinite(p) && p > 0);
  if (prices.length === 0) return null;

  prices.sort((a, b) => a - b);

  const raw_avg = prices.reduce((s, p) => s + p, 0) / prices.length;
  const stddev = Math.sqrt(
    prices.map(p => (p - raw_avg) ** 2).reduce((s, v) => s + v, 0) / prices.length
  );
  const filtered = prices.filter(p => Math.abs(p - raw_avg) <= 2 * stddev);
  const avg = parseFloat(
    (filtered.reduce((s, p) => s + p, 0) / filtered.length).toFixed(2)
  );

  const confidence = prices.length >= 10 ? 'high' : prices.length >= 5 ? 'medium' : 'low';

  const row = {
    item_query:      query.toLowerCase().trim(),
    avg_sold_price:  avg,
    sold_range_low:  prices[0],
    sold_range_high: prices[prices.length - 1],
    sample_size:     prices.length,
    data_source:     'provided_comps',
    confidence,
    updated_at:      new Date().toISOString()
  };

  upsert(row);
  return row;
}

function buildCategoryEstimate(query, purchasePrice, category) {
  const key = Object.keys(CATEGORY_RANGES).find(k =>
    category.toLowerCase().includes(k)
  );

  const range = key ? CATEGORY_RANGES[key] : CATEGORY_RANGES.electronics;
  const usedKey = key || 'electronics';

  // Conservative blend: 35th percentile of the low→high range
  const mult = range.low + (range.high - range.low) * 0.35;
  const avg = parseFloat((purchasePrice * mult).toFixed(2));

  return {
    item_query:      query.toLowerCase().trim(),
    avg_sold_price:  avg,
    sold_range_low:  parseFloat((purchasePrice * range.low).toFixed(2)),
    sold_range_high: parseFloat((purchasePrice * range.high).toFixed(2)),
    sample_size:     0,
    data_source:     'category_estimate',
    confidence:      'low',
    data_label:      'ESTIMATE — NOT REAL MARKET DATA',
    category_used:   usedKey,
    note:            `Conservative 35th-pctile estimate for "${usedKey}". ${range.note}. Verify against actual eBay sold listings before purchasing.`,
    insufficient_data: false
  };
}

function upsert(row) {
  const db = getDb();
  db.prepare(`
    INSERT INTO market_data
      (item_query, avg_sold_price, sold_range_low, sold_range_high, sample_size, data_source, confidence, updated_at)
    VALUES
      (@item_query, @avg_sold_price, @sold_range_low, @sold_range_high, @sample_size, @data_source, @confidence, @updated_at)
    ON CONFLICT(item_query) DO UPDATE SET
      avg_sold_price  = excluded.avg_sold_price,
      sold_range_low  = excluded.sold_range_low,
      sold_range_high = excluded.sold_range_high,
      sample_size     = excluded.sample_size,
      data_source     = excluded.data_source,
      confidence      = excluded.confidence,
      updated_at      = excluded.updated_at
  `).run(row);
}

module.exports = { getMarketData };
