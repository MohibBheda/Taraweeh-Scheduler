const express = require('express');
const router  = express.Router();
const { evaluateItem }      = require('../services/evaluation');
const { rankOpportunities } = require('../services/ranking');

// POST /evaluate
router.post('/evaluate', async (req, res, next) => {
  try {
    const result = await evaluateItem(req.body);
    res.json(result);
  } catch (err) {
    const status = err.message.match(/required|must be|positive/) ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

// POST /batch-evaluate
router.post('/batch-evaluate', async (req, res, next) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items[] array is required and must not be empty' });
    }
    if (items.length > 50) {
      return res.status(400).json({ error: 'Max 50 items per batch request' });
    }

    const settled = await Promise.allSettled(items.map(item => evaluateItem(item)));

    const results = settled.map((r, i) =>
      r.status === 'fulfilled'
        ? r.value
        : { error: r.reason.message, input: items[i] }
    );

    const successful = results.filter(r => !r.error);
    const ranked     = rankOpportunities(successful);

    res.json({
      total:                items.length,
      successful:           successful.length,
      failed:               items.length - successful.length,
      results,
      ranked_opportunities: ranked
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
