const { getSoldComps, getActiveListings } = require('../services/ebayService');
const { getMarketData }    = require('../services/marketData');
const { calculateProfit }  = require('../services/valuationService');
const { scoreItem }        = require('../services/scoringService');
const { getDb }            = require('../db/database');

async function evaluateItem(input) {
  const {
    title, purchase_price, category, weight_class = 'medium',
    condition = 'good', comparable_sales, source_url, notes
  } = input;

  if (!title?.trim())  throw new Error('title is required');
  const pp = parseFloat(purchase_price);
  if (!(pp > 0))       throw new Error('purchase_price must be a positive number');

  // ── Market data ─────────────────────────────────────────
  let soldPrices    = [];
  let activeCount   = 0;
  let activePrices  = [];
  let dataSource    = 'manual';
  let confidence    = 'none';
  let ebay_sold_count   = 0;
  let ebay_active_count = 0;

  const [soldRes, activeRes] = await Promise.allSettled([
    getSoldComps(title.trim()),
    getActiveListings(title.trim())
  ]);

  if (soldRes.status === 'fulfilled' && soldRes.value?.prices?.length) {
    soldPrices      = soldRes.value.prices;
    dataSource      = 'ebay_api';
    confidence      = soldPrices.length >= 10 ? 'high' : soldPrices.length >= 5 ? 'medium' : 'low';
    ebay_sold_count = soldPrices.length;
  }

  if (activeRes.status === 'fulfilled' && activeRes.value) {
    ebay_active_count = activeRes.value.count;
    activePrices      = activeRes.value.prices;
  }

  if (!soldPrices.length && Array.isArray(comparable_sales) && comparable_sales.length) {
    soldPrices = comparable_sales.map(Number).filter(p => p > 0 && isFinite(p));
    dataSource = 'provided_comps';
    confidence = soldPrices.length >= 10 ? 'high' : soldPrices.length >= 5 ? 'medium' : 'low';
  }

  let marketData;
  if (soldPrices.length) {
    soldPrices.sort((a, b) => a - b);
    const avg = parseFloat((soldPrices.reduce((s, p) => s + p, 0) / soldPrices.length).toFixed(2));
    marketData = {
      avg_sold_price:  avg,
      sold_range_low:  soldPrices[0],
      sold_range_high: soldPrices[soldPrices.length - 1],
      sample_size:     soldPrices.length,
      confidence,
      data_source: dataSource
    };
  } else {
    marketData = await getMarketData(title.trim(), { purchasePrice: pp, category });
    confidence = marketData.confidence || 'none';
    if (marketData.insufficient_data) {
      return {
        decision: { action: 'INSUFFICIENT_DATA', reason: marketData.note },
        title: title.trim(), purchase_price: pp, market_data: marketData,
        scores: null, valuation: null
      };
    }
  }

  // ── Valuation & scoring ──────────────────────────────────
  const valuation = calculateProfit(pp, marketData.avg_sold_price, weight_class);

  const scores = scoreItem({
    roi:          valuation.roi,
    category,
    condition,
    soldCount:    ebay_sold_count || marketData.sample_size || 0,
    activeCount:  ebay_active_count,
    activePrices,
    confidence
  });

  // ── Persist ──────────────────────────────────────────────
  const id = persistItem({
    title: title.trim(), source_url, category, weight_class, condition, notes,
    pp, marketData, valuation, scores, ebay_sold_count, ebay_active_count
  });

  return {
    id,
    title: title.trim(),
    purchase_price: pp,
    market_data:  marketData,
    valuation,
    scores,
    decision: { action: scores.decision, reason: decisionReason(scores) },
    data_quality: {
      confidence,
      data_source:  marketData.data_source,
      sample_size:  marketData.sample_size,
      data_label:   marketData.data_label || null
    }
  };
}

function decisionReason({ decision, dealScore, profitScore, liquidityScore, riskScore }) {
  if (decision === 'BUY')
    return `Strong deal (${dealScore}/100). Profit ${profitScore.toFixed(0)}% ROI, liquidity ${liquidityScore}/10, risk ${riskScore}/10.`;
  if (decision === 'CONSIDER')
    return `Marginal deal (${dealScore}/100). Verify comps before committing.`;
  return `Weak deal (${dealScore}/100). Low profit or high risk relative to opportunity cost.`;
}

function confidenceToNum(c) {
  return { high: 0.9, medium: 0.6, low: 0.3, none: 0.1 }[c] ?? 0.1;
}

function persistItem({ title, source_url, category, weight_class, condition, notes,
                       pp, marketData, valuation, scores, ebay_sold_count, ebay_active_count }) {
  const db = getDb();
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO items (
      title, source_url, purchase_price, estimated_resale_price,
      fees_estimate, shipping_estimate, net_profit, roi_percentage,
      risk_score, liquidity_score, competition_score, deal_score,
      ebay_sold_avg, ebay_active_count, ebay_sold_count,
      category, weight_class, condition, notes,
      data_source, confidence_score, status
    ) VALUES (
      @title, @source_url, @purchase_price, @estimated_resale_price,
      @fees_estimate, @shipping_estimate, @net_profit, @roi_percentage,
      @risk_score, @liquidity_score, @competition_score, @deal_score,
      @ebay_sold_avg, @ebay_active_count, @ebay_sold_count,
      @category, @weight_class, @condition, @notes,
      @data_source, @confidence_score, 'candidate'
    )
  `).run({
    title,
    source_url:            source_url || null,
    purchase_price:        pp,
    estimated_resale_price: marketData.avg_sold_price,
    fees_estimate:         valuation.ebay_fees,
    shipping_estimate:     valuation.shipping,
    net_profit:            valuation.net_profit,
    roi_percentage:        valuation.roi,
    risk_score:            scores.riskScore,
    liquidity_score:       scores.liquidityScore,
    competition_score:     scores.competitionScore,
    deal_score:            scores.dealScore,
    ebay_sold_avg:         marketData.avg_sold_price,
    ebay_active_count:     ebay_active_count || 0,
    ebay_sold_count:       ebay_sold_count || 0,
    category:              category || null,
    weight_class,
    condition,
    notes:                 notes || null,
    data_source:           marketData.data_source,
    confidence_score:      confidenceToNum(marketData.confidence)
  });
  return lastInsertRowid;
}

module.exports = { evaluateItem };
