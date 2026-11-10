import express from 'express';
import { save } from './db.js';
import { aiRouter } from './ai.js';

const app = express();
app.use(express.json());

// Task 3: POST /users
app.post('/users', (req, res) => {
  const { name, age } = req.body ?? {};

  // Missing (undefined or null) -> 400
  if (name == null || age == null) return res.sendStatus(400);

  // name must be a string of at most 32 characters
  if (typeof name !== 'string' || name.length > 32) return res.sendStatus(400);

  // age must be a real number ("34" is rejected), and at least 16
  if (typeof age !== 'number' || !Number.isFinite(age) || age < 16) return res.sendStatus(400);

  const result = save({ name, age });
  return res.status(201).json(result);
});

app.use('/ai', aiRouter);

export default app;
