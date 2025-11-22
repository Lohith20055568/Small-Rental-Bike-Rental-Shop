// server.js - JSON-backed Bike Rental API
const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

// ----------------------------------------------------
// 1) Serve the client folder (static UI)
// ----------------------------------------------------
app.use('/client', express.static(path.join(__dirname, 'client')));

// ----------------------------------------------------
// 2) Make "/" load the frontend automatically
//    This fixes: "Cannot GET /"
// ----------------------------------------------------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

/**
 * Simple write queue to avoid concurrent writes corrupting file
 */
let writeLock = Promise.resolve();

async function readData() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') {
      const init = { bikes: [], customers: [], rentals: [], nextIds: { bikes: 1, customers: 1, rentals: 1 } };
      await writeData(init);
      return init;
    }
    throw e;
  }
}

function writeData(data) {
  writeLock = writeLock.then(async () => {
    const tmp = DATA_FILE + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(tmp, DATA_FILE);
  }).catch(err => console.error('writeData error', err));
  return writeLock;
}

/* ---------- generic helpers ---------- */

async function createEntity(kind, payload, required = []) {
  if (required.some(f => payload[f] === undefined || payload[f] === '')) {
    const missing = required.filter(f => payload[f] === undefined || payload[f] === '');
    const e = new Error('Missing fields: ' + missing.join(', '));
    e.status = 400;
    throw e;
  }
  const data = await readData();
  const id = data.nextIds[kind]++;
  const entity = { id, ...payload };
  data[kind].push(entity);
  await writeData(data);
  return entity;
}

async function getAll(kind) {
  const data = await readData();
  return data[kind];
}

async function getById(kind, id) {
  const data = await readData();
  return data[kind].find(x => x.id === Number(id));
}

async function updateById(kind, id, patch) {
  const data = await readData();
  const idx = data[kind].findIndex(x => x.id === Number(id));
  if (idx === -1) {
    const e = new Error('Not found');
    e.status = 404;
    throw e;
  }
  data[kind][idx] = { ...data[kind][idx], ...patch };
  await writeData(data);
  return data[kind][idx];
}

async function deleteById(kind, id) {
  const data = await readData();
  const idx = data[kind].findIndex(x => x.id === Number(id));
  if (idx === -1) {
    const e = new Error('Not found');
    e.status = 404;
    throw e;
  }
  const removed = data[kind].splice(idx, 1)[0];
  await writeData(data);
  return removed;
}

/* ---------- Bikes API ---------- */
app.get('/api/bikes', async (req, res) => {
  const q = req.query.q;
  const available = req.query.available;
  const sort = req.query.sort;
  let bikes = await getAll('bikes');

  if (q) bikes = bikes.filter(b =>
    (b.model || '').toLowerCase().includes(q.toLowerCase()) ||
    (b.sku || '').toLowerCase().includes(q.toLowerCase())
  );

  if (available === 'true') bikes = bikes.filter(b => b.status === 'available');
  if (sort === 'hourly_rate') bikes = bikes.sort((a, b) => a.hourly_rate - b.hourly_rate);

  res.json(bikes);
});

app.get('/api/bikes/:id', async (req, res) => {
  const bike = await getById('bikes', req.params.id);
  if (!bike) return res.status(404).json({ error: 'Not found' });
  res.json(bike);
});

app.post('/api/bikes', async (req, res, next) => {
  try {
    const { sku, model, type, hourly_rate, notes } = req.body;
    const data = await readData();

    if (sku && data.bikes.some(b => b.sku === sku))
      return res.status(400).json({ error: 'SKU already exists' });

    const bike = await createEntity(
      'bikes',
      { sku, model, type, hourly_rate, status: 'available', notes },
      ['sku', 'model', 'hourly_rate']
    );

    res.status(201).json(bike);
  } catch (e) { next(e); }
});

app.put('/api/bikes/:id', async (req, res, next) => {
  try {
    const updated = await updateById('bikes', req.params.id, req.body);
    res.json(updated);
  } catch (e) { next(e); }
});

app.delete('/api/bikes/:id', async (req, res, next) => {
  try {
    const deleted = await deleteById('bikes', req.params.id);
    res.json({ deleted });
  } catch (e) { next(e); }
});

/* ---------- Customers API ---------- */
app.get('/api/customers', async (req, res) => {
  const customers = await getAll('customers');
  res.json(customers);
});

app.post('/api/customers', async (req, res, next) => {
  try {
    const { name, email, phone } = req.body;
    const data = await readData();

    if (email && data.customers.some(c => c.email === email))
      return res.status(400).json({ error: 'Email already exists' });

    const customer = await createEntity(
      'customers',
      { name, email, phone },
      ['name']
    );

    res.status(201).json(customer);
  } catch (e) { next(e); }
});

/* ---------- Rentals API ---------- */
app.get('/api/rentals', async (req, res) => {
  const data = await readData();
  res.json(data.rentals);
});

app.post('/api/rentals', async (req, res, next) => {
  try {
    const { bike_id, customer_id, start_time, hourly_rate } = req.body;

    if (!bike_id || !customer_id || !start_time || !hourly_rate)
      return res.status(400).json({ error: 'Missing fields' });

    const data = await readData();
    const bike = data.bikes.find(b => b.id === Number(bike_id));
    if (!bike) return res.status(404).json({ error: 'Bike not found' });
    if (bike.status !== 'available')
      return res.status(400).json({ error: 'Bike not available' });

    const customer = data.customers.find(c => c.id === Number(customer_id));
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const id = data.nextIds.rentals++;
    const rental = {
      id,
      bike_id: Number(bike_id),
      customer_id: Number(customer_id),
      start_time,
      end_time: null,
      hourly_rate: Number(hourly_rate),
      total_charged: null,
      status: 'active'
    };

    data.rentals.push(rental);
    bike.status = 'rented';

    await writeData(data);
    res.status(201).json(rental);
  } catch (e) { next(e); }
});

app.put('/api/rentals/:id/return', async (req, res, next) => {
  try {
    const { end_time } = req.body;
    if (!end_time) return res.status(400).json({ error: 'end_time required' });

    const data = await readData();
    const rIdx = data.rentals.findIndex(r => r.id === Number(req.params.id));
    if (rIdx === -1) return res.status(404).json({ error: 'Rental not found' });

    const rental = data.rentals[rIdx];
    if (rental.status !== 'active')
      return res.status(400).json({ error: 'Rental not active' });

    const start = new Date(rental.start_time);
    const end = new Date(end_time);
    if (end < start)
      return res.status(400).json({ error: 'end_time before start_time' });

    const hours = Math.ceil((end - start) / (1000 * 60 * 60));
    rental.total_charged = hours * rental.hourly_rate;
    rental.end_time = end_time;
    rental.status = 'returned';

    const bike = data.bikes.find(b => b.id === rental.bike_id);
    if (bike) bike.status = 'available';

    await writeData(data);
    res.json(rental);
  } catch (e) { next(e); }
});

app.delete('/api/rentals/:id', async (req, res, next) => {
  try {
    const data = await readData();
    const idx = data.rentals.findIndex(r => r.id === Number(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'Not found' });

    const rental = data.rentals.splice(idx, 1)[0];

    if (rental.status === 'active') {
      const bike = data.bikes.find(b => b.id === rental.bike_id);
      if (bike) bike.status = 'available';
    }

    await writeData(data);
    res.json({ deleted: rental });
  } catch (e) { next(e); }
});

/* ---------- error handler ---------- */
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

/* ---------- start / export for tests ---------- */
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
} else {
  module.exports = app;
}
