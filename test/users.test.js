import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';

const post = (body) => request(app).post('/users').send(body);

test('201 + saved object on valid input', async () => {
  const r = await post({ name: 'Ana', age: 30 });
  assert.equal(r.status, 201);
  assert.equal(r.body.name, 'Ana');
  assert.equal(r.body.age, 30);
  assert.ok(r.body.id);
});

const bad = {
  'missing name': { age: 20 },
  'missing age': { name: 'Ana' },
  'empty body': {},
  'null name': { name: null, age: 20 },
  'name > 32 chars': { name: 'x'.repeat(33), age: 20 },
  'name not string': { name: 123, age: 20 },
  'age as string': { name: 'Ana', age: '34' },
  'age < 16': { name: 'Ana', age: 15 },
  'age boolean': { name: 'Ana', age: true },
};
for (const [label, body] of Object.entries(bad)) {
  test(`400 when ${label}`, async () => assert.equal((await post(body)).status, 400));
}

test('boundaries accepted: name 32 chars, age 16', async () => {
  assert.equal((await post({ name: 'x'.repeat(32), age: 16 })).status, 201);
});

test('400 on no body / malformed JSON', async () => {
  assert.equal((await request(app).post('/users')).status, 400);
  const r = await request(app).post('/users').set('Content-Type', 'application/json').send('{bad');
  assert.equal(r.status, 400);
});
