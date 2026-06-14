/**
 * generateListing(item)
 *
 * Produces an SEO-optimized eBay listing from structured item data.
 * Template-based — no hallucinated copy. All output is deterministic
 * and review-ready, not publish-ready without human verification.
 */
function generateListing(item) {
  const {
    title,
    category,
    condition = 'used',
    estimated_resale_price,
    sold_range_low,
    sold_range_high,
    notes,
    weight_class = 'medium'
  } = item;

  if (!title || typeof title !== 'string' || !title.trim()) {
    throw new Error('title is required');
  }

  const ebayTitle   = buildTitle(title.trim(), condition);
  const priceRange  = buildPricing(estimated_resale_price, sold_range_low, sold_range_high);
  const description = buildDescription(title.trim(), condition, notes);
  const keywords    = buildKeywords(title.trim(), category, condition);

  return {
    ebay_title:      ebayTitle,
    title_char_count: ebayTitle.length,
    title_valid:     ebayTitle.length <= 80,
    condition_label: CONDITION_LABELS[condition.toLowerCase()] || 'Used',
    suggested_price: priceRange,
    description,
    keywords,
    shipping_note:   SHIPPING_NOTES[weight_class] || SHIPPING_NOTES.medium,
    meta: {
      generated_at: new Date().toISOString(),
      disclaimer:   'Review all content before publishing. Verify item specifics match exactly.'
    }
  };
}

// eBay condition labels (maps to eBay's condition dropdown)
const CONDITION_LABELS = {
  new:      'New',
  like_new: 'Open Box',
  excellent: 'Used – Like New',
  good:     'Used – Good',
  fair:     'Used – Acceptable',
  parts:    'For Parts or Not Working'
};

const CONDITION_DESCRIPTIONS = {
  new:      'Item is new, unused, and in original sealed packaging.',
  like_new: 'Item is in like-new condition. Minimal use, if any. All original accessories included.',
  excellent: 'Item is in excellent used condition. Normal cosmetic wear only. Fully functional.',
  good:     'Item is in good used condition. May have visible wear or light scratches. Fully functional.',
  fair:     'Item is in fair condition. Noticeable wear. Sold as-is. Review all photos carefully.',
  parts:    'Item is sold for parts or repair only. Functionality is NOT guaranteed.'
};

const SHIPPING_NOTES = {
  light:   'Ships via USPS First Class or Priority Mail.',
  medium:  'Ships via USPS Priority Mail or UPS Ground.',
  heavy:   'Ships via UPS or FedEx Ground. Buyer pays actual shipping cost.',
  freight: 'Requires freight shipping. Local pickup strongly preferred. Contact seller for quote before purchasing.'
};

function buildTitle(title, condition) {
  const STOP_WORDS = new Set(['for', 'and', 'the', 'with', 'in', 'on', 'at', 'a', 'an']);
  const condMap = {
    new: 'NEW', like_new: 'Like New', excellent: 'Excellent',
    good: 'Good', fair: 'Fair', parts: 'For Parts'
  };
  const condLabel = condMap[condition.toLowerCase()] || condition;

  // eBay title: [Item] - [Condition]
  let candidate = `${title} - ${condLabel}`;

  // Truncate to 80 chars at word boundary
  if (candidate.length > 80) {
    candidate = candidate.substring(0, 77).replace(/\s\S+$/, '') + '...';
  }

  return candidate;
}

function buildPricing(avg, low, high) {
  if (!avg) {
    return {
      list_price:     null,
      buy_it_now:     null,
      minimum_accept: null,
      market_avg:     null,
      sold_range:     (low && high) ? { low, high } : null,
      note:           'No price data. Set manually based on current eBay sold comps.'
    };
  }

  return {
    list_price:     parseFloat((avg * 0.95).toFixed(2)),  // slightly below avg for velocity
    buy_it_now:     parseFloat((avg * 1.05).toFixed(2)),  // premium BIN option
    minimum_accept: parseFloat((avg * 0.80).toFixed(2)),  // Best Offer floor
    market_avg:     avg,
    sold_range:     (low && high) ? { low, high } : null,
    strategy:       'List 5% below market avg. Enable Best Offer with auto-accept at market avg and auto-decline below minimum_accept.'
  };
}

function buildDescription(title, condition, notes) {
  const condKey = condition.toLowerCase();
  const condText = CONDITION_DESCRIPTIONS[condKey] || 'See photos for actual item condition.';

  const lines = [
    `**${title}**`,
    '',
    `**Condition**`,
    condText,
    notes ? `\nSeller Notes: ${notes}` : '',
    '',
    '**What\'s Included**',
    `• ${title}`,
    '• See listing photos — all included items are shown',
    '',
    '**Important**',
    '• Review all photos carefully before purchasing',
    '• All sales final — no returns accepted',
    '• Item ships within 1–2 business days of cleared payment',
    condKey === 'parts' ? '• Sold for parts or repair only — not tested for functionality' : '',
    '',
    '**Shipping**',
    SHIPPING_NOTES[condition] || 'Fast shipping. Combined shipping available on multiple purchases.',
    '• International buyers: message for shipping quote before purchasing',
    '',
    '**Questions?**',
    'Message through eBay before purchasing. Additional photos available on request.'
  ].filter(l => l !== null && l !== undefined);

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function buildKeywords(title, category, condition) {
  const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'for', 'with', 'in', 'on', 'at', 'to', 'of', 'is', 'it']);

  const fromTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP.has(w));

  const extras = [
    category?.toLowerCase(),
    condition !== 'new' ? 'used' : 'new',
    condition === 'parts' ? 'repair' : null,
    condition === 'like_new' ? 'open box' : null
  ].filter(Boolean);

  return [...new Set([...fromTitle, ...extras])].slice(0, 15);
}

module.exports = { generateListing };
