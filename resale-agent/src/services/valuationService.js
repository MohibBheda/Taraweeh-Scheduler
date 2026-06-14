const { calculateEbayFees } = require('../utils/fees');
const { estimateShipping }  = require('../utils/shipping');

const SAFETY_BUFFER = 0.12;

function calculateProfit(purchasePrice, resalePrice, weightClass = 'medium') {
  const fees     = calculateEbayFees(resalePrice);
  const shipping = estimateShipping(weightClass);
  const buffer   = parseFloat((resalePrice * SAFETY_BUFFER).toFixed(2));
  const costs    = parseFloat((purchasePrice + fees.total + shipping.estimate_avg + buffer).toFixed(2));
  const profit   = parseFloat((resalePrice - costs).toFixed(2));
  const roi      = parseFloat(((profit / purchasePrice) * 100).toFixed(1));
  return {
    resale_price: resalePrice,
    purchase_price: purchasePrice,
    ebay_fees: fees.total,
    ebay_fee_detail: fees,
    shipping: shipping.estimate_avg,
    shipping_detail: shipping,
    safety_buffer: buffer,
    total_costs: costs,
    net_profit: profit,
    roi
  };
}

module.exports = { calculateProfit };
