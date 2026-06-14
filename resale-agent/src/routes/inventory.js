const express = require('express');
const router  = express.Router();
const { getDb } = require('../db/database');

const VALID_STATUSES = ['candidate', 'bought', 'listed', 'sold', 'rejected'];
const SORT_MAP = {
  roi_desc:     'roi_percentage DESC',
  roi_asc:      'roi_percentage ASC',
  risk_asc:     'risk_score ASC',
  profit_desc:  'net_profit DESC',
  created_desc: 'created_at DESC',
  created_asc:  'created_at ASC'
};

// GET /inventory
router.get('/inventory', (req, res, next) => {
  try {
    const db = getDb();
    const { status, min_roi, sort = 'roi_desc' } = req.query;

    let sql    = 'SELECT * FROM items WHERE 1=1';
    const bind = {};

    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
      }
      sql += ' AND status = @status';
      bind.status = status;
    }

    if (min_roi !== undefined) {
      const roi = parseFloat(min_roi);
      if (!Number.isFinite(roi)) return res.status(400).json({ error: 'min_roi must be a number' });
      sql += ' AND roi_percentage >= @min_roi';
      bind.min_roi = roi;
    }

    sql += ` ORDER BY ${SORT_MAP[sort] || SORT_MAP.roi_desc}`;

    const items = db.prepare(sql).all(bind);

    const stats = db.prepare(`
      SELECT
        COUNT(*)                                                     AS total,
        SUM(CASE WHEN status = 'candidate' THEN 1 ELSE 0 END)       AS candidates,
        SUM(CASE WHEN status = 'bought'    THEN 1 ELSE 0 END)       AS bought,
        SUM(CASE WHEN status = 'listed'    THEN 1 ELSE 0 END)       AS listed,
        SUM(CASE WHEN status = 'sold'      THEN 1 ELSE 0 END)       AS sold,
        SUM(CASE WHEN status = 'rejected'  THEN 1 ELSE 0 END)       AS rejected,
        SUM(CASE WHEN status = 'sold'      THEN net_profit  ELSE 0 END) AS total_realized_profit,
        AVG(CASE WHEN status = 'sold'      THEN roi_percentage END)  AS avg_roi_on_sold
      FROM items
    `).get();

    res.json({ count: items.length, stats, items });
  } catch (err) {
    next(err);
  }
});

// POST /mark-sold
router.post('/mark-sold', (req, res, next) => {
  try {
    const db = getDb();
    const { id, actual_sale_price } = req.body;

    if (!id) return res.status(400).json({ error: 'id is required' });

    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
    if (!item) return res.status(404).json({ error: `Item ${id} not found` });

    const params = { id };
    let setClauses = "status = 'sold', updated_at = datetime('now')";

    if (actual_sale_price !== undefined) {
      const sale = parseFloat(actual_sale_price);
      if (!Number.isFinite(sale) || sale <= 0) {
        return res.status(400).json({ error: 'actual_sale_price must be a positive number' });
      }
      const fees   = parseFloat((sale * 0.1325 + 0.35).toFixed(2));
      const profit = parseFloat((sale - item.purchase_price - fees - (item.shipping_estimate || 0)).toFixed(2));
      const roi    = parseFloat(((profit / item.purchase_price) * 100).toFixed(1));

      setClauses += ', estimated_resale_price = @sale, fees_estimate = @fees, net_profit = @profit, roi_percentage = @roi';
      Object.assign(params, { sale, fees, profit, roi });
    }

    db.prepare(`UPDATE items SET ${setClauses} WHERE id = @id`).run(params);

    res.json({ success: true, item: db.prepare('SELECT * FROM items WHERE id = ?').get(id) });
  } catch (err) {
    next(err);
  }
});

// POST /update-status  (lifecycle transitions: candidate → bought → listed → sold)
router.post('/update-status', (req, res, next) => {
  try {
    const db = getDb();
    const { id, status } = req.body;

    if (!id || !status) return res.status(400).json({ error: 'id and status are required' });
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const item = db.prepare('SELECT id FROM items WHERE id = ?').get(id);
    if (!item) return res.status(404).json({ error: `Item ${id} not found` });

    db.prepare("UPDATE items SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);

    res.json({ success: true, item: db.prepare('SELECT * FROM items WHERE id = ?').get(id) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
