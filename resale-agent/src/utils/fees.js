// eBay fee structure (2024 standard seller rates)
const FINAL_VALUE_FEE_RATE = 0.1325; // 13.25% — most categories
const INSERTION_FEE = 0.35;          // per listing above 250 free/month

function calculateEbayFees(salePrice) {
  const fvf = parseFloat((salePrice * FINAL_VALUE_FEE_RATE).toFixed(2));
  return {
    final_value_fee: fvf,
    insertion_fee: INSERTION_FEE,
    total: parseFloat((fvf + INSERTION_FEE).toFixed(2)),
    rate_applied: FINAL_VALUE_FEE_RATE
  };
}

module.exports = { calculateEbayFees, FINAL_VALUE_FEE_RATE, INSERTION_FEE };
