const express = require('express');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

let rows = [
  {
    id: 1,
    name: 'Urban left-turn ODD gap',
    domain: 'Dense urban',
    weather: 'Rain',
    lighting: 'Night',
    roadType: 'Signalized intersection',
    scenarioCount: 18,
    passRate: 82,
    riskLevel: 'High',
    status: 'needs_expansion',
    description: 'Left-turn interactions with pedestrians and occluded cyclists need additional runs.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 2,
    name: 'Highway merge coverage',
    domain: 'Highway',
    weather: 'Clear',
    lighting: 'Day',
    roadType: 'Multi-lane highway',
    scenarioCount: 44,
    passRate: 96,
    riskLevel: 'Low',
    status: 'covered',
    description: 'Nominal and aggressive merge cases are covered for SAE L3 release gates.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const nextId = () => rows.reduce((max, row) => Math.max(max, row.id), 0) + 1;

router.use(authMiddleware);

router.get('/', (req, res) => {
  const q = String(req.query.search || '').toLowerCase();
  const data = q
    ? rows.filter((row) => Object.values(row).some((value) => String(value).toLowerCase().includes(q)))
    : rows;
  res.json({ data, total: data.length });
});

router.post('/', (req, res) => {
  const now = new Date().toISOString();
  const row = { id: nextId(), ...req.body, createdAt: now, updatedAt: now };
  rows.unshift(row);
  res.status(201).json(row);
});

router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const idx = rows.findIndex((row) => row.id === id);
  if (idx === -1) return res.status(404).json({ error: 'ODD coverage row not found' });
  rows[idx] = { ...rows[idx], ...req.body, id, updatedAt: new Date().toISOString() };
  res.json(rows[idx]);
});

router.delete('/:id', (req, res) => {
  const before = rows.length;
  rows = rows.filter((row) => row.id !== Number(req.params.id));
  if (rows.length === before) return res.status(404).json({ error: 'ODD coverage row not found' });
  res.json({ message: 'deleted' });
});

router.post('/bulk-delete', (req, res) => {
  const ids = new Set((req.body.ids || []).map(Number));
  rows = rows.filter((row) => !ids.has(row.id));
  res.json({ message: 'deleted', count: ids.size });
});

router.post('/:id/duplicate', (req, res) => {
  const source = rows.find((row) => row.id === Number(req.params.id));
  if (!source) return res.status(404).json({ error: 'ODD coverage row not found' });
  const now = new Date().toISOString();
  const copy = { ...source, id: nextId(), name: `${source.name} Copy`, createdAt: now, updatedAt: now };
  rows.unshift(copy);
  res.status(201).json(copy);
});

router.get('/export', (req, res) => {
  res.json(rows);
});

module.exports = router;
