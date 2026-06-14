const express = require('express');
const router  = express.Router();
const { generateListing } = require('../services/listing');
const { getDb }           = require('../db/database');

// POST /generate-listing
// Body: { title, condition, category, ... }  OR  { item_id: <int> }
router.post('/generate-listing', (req, res, next) => {
  try {
    let item = req.body;

    if (item.item_id) {
      const db  = getDb();
      const row = db.prepare('SELECT * FROM items WHERE id = ?').get(item.item_id);
      if (!row) return res.status(404).json({ error: `Item ${item.item_id} not found` });
      item = {
        ...row,
        // market_data fields not stored on item row; pass nulls for range
        sold_range_low:  null,
        sold_range_high: null
      };
    }

    const listing = generateListing(item);
    res.json(listing);
  } catch (err) {
    const status = err.message.includes('required') ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

module.exports = router;
