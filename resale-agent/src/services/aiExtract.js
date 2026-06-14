function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function extractFromText(text) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: `Extract structured data from this marketplace listing. Return ONLY valid JSON — no explanation, no markdown:
{
  "title": "brand + model number, as specific as possible",
  "condition": "new|like_new|excellent|good|fair|parts",
  "category": "smartphones|laptops|electronics|gaming|tools|clothing|collectibles|jewelry|books|furniture|appliances|sporting",
  "weight_class": "light|medium|heavy|freight",
  "asking_price": <number or null>,
  "notes": "brief condition notes"
}

Listing:
${text.substring(0, 2500)}`
        }]
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return JSON.parse(data.content?.[0]?.text || 'null');
  } catch { return null; }
}

async function extractFromUrl(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ResaleAgent/1.0)' },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return null;
    const html = await res.text();
    return extractFromText(stripHtml(html));
  } catch { return null; }
}

module.exports = { extractFromText, extractFromUrl };
