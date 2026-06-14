/**
 * rankOpportunities(items[])
 *
 * Composite score weighted:
 *   50% ROI (capped at 100% for scoring, not for display)
 *   30% Inverse risk (lower risk = higher score)
 *   20% Liquidity (category-based default sell speed estimate)
 *
 * Output is sorted best → worst, with rank and composite_score attached.
 */

const LIQUIDITY = {
  smartphones:  9,
  gaming:       8,
  electronics:  7,
  laptops:      7,
  tools:        6,
  sporting:     5,
  clothing:     5,
  books:        4,
  jewelry:      4,
  appliances:   3,
  collectibles: 3,
  furniture:    2,
  default:      5
};

function rankOpportunities(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { ranked: [], count: 0, summary: null };
  }

  const ranked = items
    .map(item => ({ ...item, _score: composite(item) }))
    .sort((a, b) => b._score - a._score)
    .map(({ _score, ...item }, i) => ({
      rank:            i + 1,
      composite_score: parseFloat(_score.toFixed(2)),
      ...item
    }));

  return {
    ranked,
    count: ranked.length,
    summary: {
      top_pick:         ranked[0]?.title ?? null,
      buys:             ranked.filter(i => i.decision?.action === 'BUY').length,
      considers:        ranked.filter(i => i.decision?.action === 'CONSIDER').length,
      rejects:          ranked.filter(i => i.decision?.action === 'REJECT').length,
      investigates:     ranked.filter(i => ['INVESTIGATE', 'INSUFFICIENT_DATA'].includes(i.decision?.action)).length,
      avg_roi:          avg(ranked.map(i => i.roi_percentage).filter(Number.isFinite)),
      avg_risk:         avg(ranked.map(i => i.risk_score).filter(Number.isFinite))
    }
  };
}

function composite(item) {
  const roi       = typeof item.roi_percentage === 'number' ? item.roi_percentage : 0;
  const risk      = typeof item.risk_score     === 'number' ? item.risk_score     : 5;
  const liquidity = getLiquidity(item.category);

  const roiNorm   = Math.min(Math.max(roi, 0), 100) / 100;
  const riskNorm  = (10 - risk) / 10;
  const liqNorm   = liquidity / 10;

  return (roiNorm * 0.5 + riskNorm * 0.3 + liqNorm * 0.2) * 100;
}

function getLiquidity(category) {
  if (!category) return LIQUIDITY.default;
  const key = Object.keys(LIQUIDITY).find(k => category.toLowerCase().includes(k));
  return key ? LIQUIDITY[key] : LIQUIDITY.default;
}

function avg(arr) {
  if (!arr.length) return null;
  return parseFloat((arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(1));
}

module.exports = { rankOpportunities };
