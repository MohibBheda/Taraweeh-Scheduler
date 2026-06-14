const CATEGORY_DATA = {
  smartphones:  { liquidity: 9, counterfeit_risk: 7, test_difficulty: 4, return_rate: 5 },
  laptops:      { liquidity: 7, counterfeit_risk: 3, test_difficulty: 8, return_rate: 6 },
  gaming:       { liquidity: 8, counterfeit_risk: 4, test_difficulty: 5, return_rate: 4 },
  electronics:  { liquidity: 6, counterfeit_risk: 5, test_difficulty: 6, return_rate: 5 },
  tools:        { liquidity: 6, counterfeit_risk: 2, test_difficulty: 3, return_rate: 3 },
  clothing:     { liquidity: 5, counterfeit_risk: 6, test_difficulty: 1, return_rate: 7 },
  collectibles: { liquidity: 3, counterfeit_risk: 8, test_difficulty: 2, return_rate: 4 },
  jewelry:      { liquidity: 4, counterfeit_risk: 9, test_difficulty: 7, return_rate: 5 },
  books:        { liquidity: 4, counterfeit_risk: 1, test_difficulty: 1, return_rate: 2 },
  furniture:    { liquidity: 2, counterfeit_risk: 1, test_difficulty: 2, return_rate: 4 },
  appliances:   { liquidity: 3, counterfeit_risk: 2, test_difficulty: 7, return_rate: 6 },
  sporting:     { liquidity: 5, counterfeit_risk: 3, test_difficulty: 3, return_rate: 4 },
  default:      { liquidity: 5, counterfeit_risk: 4, test_difficulty: 4, return_rate: 4 }
};

function getCatData(category) {
  if (!category) return CATEGORY_DATA.default;
  const k = Object.keys(CATEGORY_DATA).find(k => category.toLowerCase().includes(k));
  return k ? CATEGORY_DATA[k] : CATEGORY_DATA.default;
}

function calcLiquidityScore({ category, soldCount = 0, activeCount = 0 }) {
  const cat = getCatData(category);
  let score = cat.liquidity * 0.6;                           // base 0-5.4
  score += Math.min(2, soldCount / 10);                      // sold momentum 0-2
  const total = soldCount + activeCount;
  if (total > 0) score += (soldCount / total) * 2;           // sell-through 0-2
  return Math.min(10, Math.max(0, parseFloat(score.toFixed(1))));
}

function calcRiskScore({ category, condition, confidence }) {
  const cat = getCatData(category);
  let score = 0;
  score += (cat.counterfeit_risk / 10) * 2.5;
  const condMap = { new: 0, like_new: 0.5, excellent: 0.8, good: 1.2, fair: 1.8, parts: 2.0 };
  score += condMap[condition?.toLowerCase()] ?? 1.2;
  score += (cat.test_difficulty / 10) * 2;
  score += (cat.return_rate / 10) * 1.5;
  const confMap = { high: 0, medium: 0.5, low: 1.5, none: 2 };
  score += confMap[confidence] ?? 1.5;
  return Math.min(10, Math.max(0, parseFloat(score.toFixed(1))));
}

function calcCompetitionScore({ activeCount = 0, soldCount = 0, activePrices = [] }) {
  let score = 0;
  if      (activeCount > 200) score += 5;
  else if (activeCount > 100) score += 4;
  else if (activeCount > 50)  score += 3;
  else if (activeCount > 20)  score += 2;
  else if (activeCount > 5)   score += 1;

  if (activePrices.length >= 3) {
    const mn = Math.min(...activePrices), mx = Math.max(...activePrices);
    const spread = (mx - mn) / ((mx + mn) / 2);
    if      (spread < 0.10) score += 3;
    else if (spread < 0.25) score += 2;
    else if (spread < 0.50) score += 1;
  }

  const total = soldCount + activeCount;
  if (total > 0) {
    const str = soldCount / total;
    if      (str < 0.1) score += 2;
    else if (str < 0.3) score += 1;
  }
  return Math.min(10, Math.max(0, parseFloat(score.toFixed(1))));
}

function calcDealScore({ roi, liquidityScore, riskScore, competitionScore }) {
  const profitScore        = Math.min(100, Math.max(0, roi));
  const liquidityNorm      = liquidityScore * 10;
  const riskInverse        = (10 - riskScore) * 10;
  const competitionInverse = (10 - competitionScore) * 10;

  const dealScore = parseFloat((
    profitScore        * 0.40 +
    liquidityNorm      * 0.35 +
    competitionInverse * 0.15 +
    riskInverse        * 0.10
  ).toFixed(1));

  const decision = dealScore >= 70 ? 'BUY' : dealScore >= 40 ? 'CONSIDER' : 'PASS';
  return { profitScore, liquidityScore, riskScore, competitionScore, dealScore, decision };
}

function scoreItem({ roi, category, condition, soldCount, activeCount, activePrices, confidence }) {
  const liquidityScore   = calcLiquidityScore({ category, soldCount, activeCount });
  const riskScore        = calcRiskScore({ category, condition, confidence });
  const competitionScore = calcCompetitionScore({ activeCount, soldCount, activePrices });
  return calcDealScore({ roi, liquidityScore, riskScore, competitionScore });
}

module.exports = { scoreItem, calcLiquidityScore, calcRiskScore, calcCompetitionScore, calcDealScore };
