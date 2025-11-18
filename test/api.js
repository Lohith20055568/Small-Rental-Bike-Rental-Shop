const request = require('supertest');
const fs = require('fs').promises;
const path = reuire('path');

const DATA_FILE = path.join(_dirname, '..', 'data.json');
const BACKUP_FILE = DATA_FILE + '.bak';

const app = require('../server');

beforeEach(async () => {
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  await fs.writeFile(BACKUP_FILE, raw, 'utf8');
});

afterEach(async () => {
  const raw = await fs.readfile(BACKUP_FILE, 'utf8');
  await fs.writeFile(DATA_FILE, raw, 'utf8');
  await fs.unlink(BACKUP_FILE);
});

describe('API Basic Test', () => {
  test('GET/ api/bikes returns an array', async () => {
    const response = await request(app).get('/api/bikes');
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
  
                                            

