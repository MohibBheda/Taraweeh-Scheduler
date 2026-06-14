const { getMarketData } = require('./marketData');
const { calculateEbayFees } = require('../utils/fees');
const { estimateShipping } = require('../utils/shipping');
const { getDb } = require('../db/database');

const SAFETY_BUFFER_RATE = 0.12; // 12% of resale price reserved for unknowns

/**
 * evaluateItem(item)
 *
 * Returns structured evaluation with:
 *   - cost breakdown (purchase + fees + shipping + buffer)
 *   - net_profit, roi_percentage
 *   - risk_score (1–10)
 *   - decision (BUY / CONSIDER / INVESTIGATE / REJECT)
 *
 * No prices are fabricated. When data quality is low, confidence is
 * explicitly surfaced and the safety buffer absorbs estimation error.
 */
async function evaluateItem(item) {
  const {
    title,
    purchase_price,
    source_url,
    category,
    weight_class = 'medium',
    condition = 'used',
    comparable_sales,
    notes
  } = item;

  if (!title || typeof title !== 'string' || !title.trim()) {
    throw new Error('title is required');
  }

  const pp = parseFloat(purchase_price);
  if (!Number.isFinite(pp) || pp <= 0) {
    throw new Error('purchase_price must be a positive number');
  }

  const marketData = await getMarketData(title.trim(), {
    purchasePrice: pp,
    category,
    providedComps: comparable_sales
  });

  if (marketData.insufficient_data) {
    return {
      decision: { action: 'INSUFFICIENT_DATA', reason: marketData.note },
      title:           title.trim(),
      purchase_price:  pp,
      market_data:     marketData,
      evaluation:      null
    };
  }

  const resalePrice = marketData.avg_sold_price;
  const fees        = calculateEbayFees(resalePrice);
  const shipping    = estimateShipping(weight_class);
  const buffer      = parseFloat((resalePrice * SAFETY_BUFFER_RATE).toFixed(2));

  const totalCosts = parseFloat((pp + fees.total + shipping.estimate_avg + buffer).toFixed(2));
  const netProfit  = parseFloat((resalePrice - totalCosts).toFixed(2));
  const roi        = parseFloat(((netProfit / pp) * 100).toFixed(1));
  const riskScore  = calcRisk({ marketData, roi, purchasePrice: pp, resalePrice, weightClass: weight_class });
  const decision   = decide(roi, riskScore, marketData);

  const evaluation = {
    resale_price_estimate: resalePrice,
    cost_breakdown: {
      purchase_price:   pp,
      ebay_fees:        fees.total,
      ebay_fee_detail:  fees,
      shipping_estimate: shipping.estimate_avg,
      shipping_detail:  shipping,
      safety_buffer:    buffer,
      total_costs:      totalCosts
    },
    net_profit:     netProfit,
    roi_percentage: roi,
    risk_score:     riskScore,
    decision,
    data_quality: {
      confidence:   marketData.confidence,
      data_source:  marketData.data_source,
      sample_size:  marketData.sample_size,
      data_label:   marketData.data_label || null,
      note:         marketData.note || null
    }
  };

  const id = persist({ title, source_url, category, weight_class, condition, notes }, evaluation, marketData);

  return { id, title: title.trim(), market_data: marketData, ...evaluation };
}

function calcRisk({ marketData, roi, purchasePrice, resalePrice, weightClass }) {
  let score = 0;

  // Data confidence (0–3)
  score += { none: 3, low: 2.5, medium: 1, high: 0 }[marketData.confidence] ?? 2.5;

  // Price spread — wide spread means high uncertainty (0–3)
  if (marketData.sold_range_low != null && marketData.sold_range_high != null) {
    const spreadRatio = (marketData.sold_range_high - marketData.sold_range_low) / resalePrice;
    if (spreadRatio > 1.5)      score += 3;
    else if (spreadRatio > 0.8) score += 2;
    else if (spreadRatio > 0.4) score += 1;
  } else {
    score += 2;
  }

  // Thin ROI = higher sensitivity to errors (0–2)
  if (roi < 10)      score += 2;
  else if (roi < 25) score += 1;

  // Shipping complexity (0–2)
  if (weightClass === 'freight') score += 2;
  else if (weightClass === 'heavy') score += 1;

  return Math.min(10, Math.max(1, parseFloat(score.toFixed(1))));
}

function decide(roi, riskScore, marketData) {
  if (marketData.confidence === 'none') {
    return { action: 'INVESTIGATE', reason: 'No market data — verify comps manually before acting.' };
  }
  if (roi < 0) {
    return { action: 'REJECT', reason: `Negative ROI (${roi}%). Loss after fees, shipping, and buffer.` };
  }
  if (roi < 15 && riskScore > 6) {
    return { action: 'REJECT', reason: `Low ROI (${roi}%) paired with high risk (${riskScore}/10). Downside not justified.` };
  }
  if (roi >= 40 && riskScore <= 5) {
    return { action: 'BUY', reason: `Strong ROI (${roi}%) with acceptable risk (${riskScore}/10).` };
  }
  if (roi >= 20 && riskScore <= 6) {
    return { action: 'BUY', reason: `Good ROI (${roi}%) with manageable risk (${riskScore}/10).` };
  }
  if (roi >= 10) {
    return { action: 'CONSIDER', reason: `Marginal ROI (${roi}%). Pull real comps before committing.` };
  }
  return { action: 'REJECT', reason: `ROI too low (${roi}%) relative to cost/risk.` };
}

function confidenceToScore(conf) {
  return { high: 0.9, medium: 0.6, low: 0.3, none: 0.1 }[conf] ?? 0.1;
}

function persist({ title, source_url, category, weight_class, condition, notes }, evaluation, marketData) {
  const db = getDb();
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO items (
      title, source_url, purchase_price, estimated_resale_price,
      fees_estimate, shipping_estimate, net_profit, roi_percentage,
      risk_score, category, weight_class, condition, notes,
      data_source, confidence_score, status
    ) VALUES (
      @title, @source_url, @purchase_price, @estimated_resale_price,
      @fees_estimate, @shipping_estimate, @net_profit, @roi_percentage,
      @risk_score, @category, @weight_class, @condition, @notes,
      @data_source, @confidence_score, 'candidate'
    )
  `).run({
    title,
    source_url:             source_url || null,
    purchase_price:         evaluation.cost_breakdown.purchase_price,
    estimated_resale_price: evaluation.resale_price_estimate,
    fees_estimate:          evaluation.cost_breakdown.ebay_fees,
    shipping_estimate:      evaluation.cost_breakdown.shipping_estimate,
    net_profit:             evaluation.net_profit,
    roi_percentage:         evaluation.roi_percentage,
    risk_score:             evaluation.risk_score,
    category:               category || null,
    weight_class,
    condition,
    notes:                  notes || null,
    data_source:            marketData.data_source,
    confidence_score:       confidenceToScore(marketData.confidence)
  });
  return lastInsertRowid;
}

module.exports = { evaluateItem };
