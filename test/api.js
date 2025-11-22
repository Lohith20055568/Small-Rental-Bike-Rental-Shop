// tests/api.test.js
const request = require('supertest');
const fs = require('fs').promises;
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data.json');
const BACKUP_FILE = DATA_FILE + '.bak';

const app = require('../server');

beforeEach(async () => {
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  await fs.writeFile(BACKUP_FILE, raw, 'utf8');
});

afterEach(async () => {
  const raw = await fs.readFile(BACKUP_FILE, 'utf8');
  await fs.writeFile(DATA_FILE, raw, 'utf8');
  await fs.unlink(BACKUP_FILE);
});

describe('API Basic Tests', () => {
  test('GET /api/bikes returns an array', async () => {
    const response = await request(app).get('/api/bikes');
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  test('Create Bike → Create Customer → Create Rental', async () => {
    const bikeRes = await request(app)
      .post('/api/bikes')
      .send({ sku: "TEST001", model: "TestBike", hourly_rate: 5 });

    expect(bikeRes.statusCode).toBe(201);
    const bikeId = bikeRes.body.id;

    const custRes = await request(app)
      .post('/api/customers')
      .send({ name: "Test User" });

    expect(custRes.statusCode).toBe(201);
    const custId = custRes.body.id;

    const rentRes = await request(app)
      .post('/api/rentals')
      .send({
        bike_id: bikeId,
        customer_id: custId,
        start_time: new Date().toISOString(),
        hourly_rate: 5
      });

    expect(rentRes.statusCode).toBe(201);
    expect(rentRes.body.bike_id).toBe(bikeId);
  });
});
