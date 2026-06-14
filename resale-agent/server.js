require('dotenv').config();
const express = require('express');
const { initDatabase } = require('./src/db/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

initDatabase();

app.use('/', require('./src/routes/evaluate'));
app.use('/', require('./src/routes/inventory'));
app.use('/', require('./src/routes/listing'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`Resale Agent API listening on port ${PORT}`);
});
