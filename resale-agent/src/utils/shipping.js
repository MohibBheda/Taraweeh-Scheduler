// Shipping estimates (continental US, USPS/UPS ground, 2024 rates)
const SHIPPING_TABLE = {
  light:   { min: 5.00,  avg: 7.50,  max: 10.00, label: '<1 lb — envelope / small parcel' },
  medium:  { min: 10.00, avg: 14.00, max: 20.00, label: '1–5 lbs — standard box' },
  heavy:   { min: 20.00, avg: 32.00, max: 55.00, label: '5–20 lbs — large box' },
  freight: { min: 75.00, avg: 125.00, max: 220.00, label: '20+ lbs — freight / pallet' }
};

function estimateShipping(weightClass = 'medium') {
  const row = SHIPPING_TABLE[weightClass] || SHIPPING_TABLE.medium;
  return {
    weight_class:  weightClass,
    estimate_low:  row.min,
    estimate_avg:  row.avg,
    estimate_high: row.max,
    label:         row.label,
    note: 'Estimate only. Verify with actual weight/dims before listing.'
  };
}

module.exports = { estimateShipping, SHIPPING_TABLE };
