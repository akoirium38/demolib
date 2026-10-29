import { describe, expect, it } from 'vitest';
import request from 'supertest';
import Joi from 'joi';
import express from 'express';
import { createApp } from '../../src/app.js';
import { validate } from '../../src/middlewares/validate.js';
import { errorHandler } from '../../src/middlewares/errorHandler.js';

describe('app skeleton', () => {
  const app = createApp();

  it('GET /api/health → 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: 'ok' } });
  });

  it('route không tồn tại → 404 NOT_FOUND', async () => {
    const res = await request(app).get('/api/khong-co');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('JSON sai cú pháp → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{bad');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('validate middleware', () => {
  const app = express();
  app.use(express.json());
  app.get(
    '/q',
    validate({ query: Joi.object({ page: Joi.number().integer().min(1).default(1) }) }),
    (req, res) => res.json({ data: req.query }),
  );
  app.post(
    '/b',
    validate({ body: Joi.object({ name: Joi.string().trim().required() }) }),
    (req, res) => res.json({ data: req.body }),
  );
  app.use(errorHandler);

  it('chuẩn hóa query và áp default', async () => {
    const res = await request(app).get('/q');
    expect(res.body.data).toEqual({ page: 1 });
  });

  it('trim body và bỏ field lạ', async () => {
    const res = await request(app).post('/b').send({ name: '  An ', x: 1 });
    expect(res.body.data).toEqual({ name: 'An' });
  });

  it('lỗi validate → 400 kèm details theo field', async () => {
    const res = await request(app).post('/b').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('name');
  });
});
