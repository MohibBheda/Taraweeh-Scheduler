const express = require('express');
const router  = express.Router();
const { extractFromText, extractFromUrl } = require('../services/aiExtract');
const { evaluateItem } = require('../controllers/itemController');

router.post('/smart-evaluate', async (req, res, next) => {
  try {
    const { url, text, purchase_price } = req.body;
    if (!url && !text) return res.status(400).json({ error: 'Provide url or text' });

    let listing = text;
    if (url && !text) {
      const extracted = await extractFromUrl(url);
      if (!extracted) return res.status(400).json({ error: 'Could not fetch or parse the URL. Paste the listing text directly instead.' });
      const result = await evaluateItem({ ...extracted, purchase_price: purchase_price || extracted.asking_price });
      return res.json({ ...result, extracted });
    }

    const extracted = await extractFromText(listing);
    if (!extracted) return res.status(400).json({ error: 'Could not extract item details. Is ANTHROPIC_API_KEY set?' });

    const result = await evaluateItem({ ...extracted, purchase_price: purchase_price || extracted.asking_price });
    res.json({ ...result, extracted });
  } catch (err) { next(err); }
});

module.exports = router;
