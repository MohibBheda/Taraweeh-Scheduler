const express = require('express');
const router  = express.Router();
const { getDb } = require('../db/database');

router.get('/opportunities', (req, res, next) => {
  try {
    const db    = getDb();
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    const items = db.prepare(`
      SELECT * FROM items
      WHERE deal_score >= 40
        AND status IN ('candidate','bought')
      ORDER BY deal_score DESC
      LIMIT ?
    `).all(limit);

    res.json({
      count: items.length,
      breakdown: {
        buy:      items.filter(i => i.deal_score >= 70).length,
        consider: items.filter(i => i.deal_score >= 40 && i.deal_score < 70).length
      },
      items
    });
  } catch (err) { next(err); }
});

module.exports = router;
