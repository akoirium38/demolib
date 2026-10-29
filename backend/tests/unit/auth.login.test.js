import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET ??= 'unit-test-secret';

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: { users: { findUnique: vi.fn(), create: vi.fn() } },
}));

const { prisma } = await import('../../src/lib/prisma.js');
const { env } = await import('../../src/config/env.js');
const { loginSchema } = await import('../../src/validators/auth.validator.js');
const { login } = await import('../../src/services/auth.service.js');
const { authenticate, requireRole } = await import('../../src/middlewares/auth.js');
const { errorHandler } = await import('../../src/middlewares/errorHandler.js');
const { createApp } = await import('../../src/app.js');
const express = (await import('express')).default;

const PASSWORD = '12345678';
let passwordHash;

const makeUser = (overrides = {}) => ({
  id: '00000000-0000-0000-0000-000000000001',
  email: 'reader1@demolib.local',
  name: 'Nguyễn Văn An',
  phone: null,
  address: null,
  role: 'READER',
  is_active: true,
  password_hash: passwordHash,
  created_at: new Date('2026-10-29T00:00:00Z'),
  updated_at: new Date('2026-10-29T00:00:00Z'),
  ...overrides,
});

const fieldsWithError = (body) => {
  const { error } = loginSchema.validate(body, { abortEarly: false, stripUnknown: true });
  return error ? [...new Set(error.details.map((d) => d.path.join('.')))] : [];
};

const sign = (payload, options = {}, secret = env.jwtSecret) =>
  jwt.sign(payload, secret, { subject: makeUser().id, expiresIn: '24h', ...options });

beforeAll(async () => {
  passwordHash = await bcrypt.hash(PASSWORD, 4);
});

beforeEach(() => {
  vi.clearAllMocks();
  prisma.users.findUnique.mockResolvedValue(makeUser());
});

describe('2.1.2 Đăng nhập — loginSchema', () => {
  it('U-02 HC-04: email được trim + lowercase', () => {
    const { value } = loginSchema.validate({ email: '  Reader1@DemoLib.Local ', password: PASSWORD });
    expect(value.email).toBe('reader1@demolib.local');
  });

  it.each(['abc', 'a@', '@b.com', ''])('U-03 EC-01: email sai định dạng "%s"', (email) => {
    expect(fieldsWithError({ email, password: PASSWORD })).toEqual(['email']);
  });

  it.each([
    ['7 ký tự', 'a'.repeat(7)],
    ['17 ký tự', 'a'.repeat(17)],
    ['rỗng', ''],
  ])('U-04 EC-02: mật khẩu %s → lỗi', (_, password) => {
    expect(fieldsWithError({ email: 'a@b.com', password })).toEqual(['password']);
  });

  it('U-04 EC-02: mật khẩu đúng 8 và 16 ký tự hợp lệ', () => {
    for (const password of ['a'.repeat(8), 'a'.repeat(16)]) {
      expect(fieldsWithError({ email: 'a@b.com', password })).toEqual([]);
    }
  });
});

describe('2.1.2 Đăng nhập — auth.service.login', () => {
  it.each(['READER', 'LIBRARIAN', 'ADMIN'])('U-01 HC-01/02/03: %s đăng nhập đúng', async (role) => {
    prisma.users.findUnique.mockResolvedValue(makeUser({ role }));
    const result = await login({ email: 'reader1@demolib.local', password: PASSWORD });

    expect(result.user).toMatchObject({ email: 'reader1@demolib.local', role, isActive: true });
    expect(result.user).not.toHaveProperty('password_hash');
    expect(result.expiresIn).toBe(86400);

    const payload = jwt.verify(result.token, env.jwtSecret);
    expect(payload).toMatchObject({ sub: makeUser().id, role });
    expect(payload.exp - payload.iat).toBe(24 * 60 * 60);
  });

  it('U-05 EC-03/04: email không tồn tại và sai mật khẩu trả cùng lỗi 401', async () => {
    prisma.users.findUnique.mockResolvedValueOnce(null);
    const notFound = await login({ email: 'x@demolib.local', password: PASSWORD }).catch((e) => e);
    const wrongPw = await login({ email: 'reader1@demolib.local', password: 'sai-mat-khau' }).catch(
      (e) => e,
    );

    for (const err of [notFound, wrongPw]) {
      expect(err).toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
    }
    expect(notFound.message).toBe(wrongPw.message);
  });

  it('U-06 EC-05/BR-02: tài khoản vô hiệu hóa — đúng mật khẩu → 403, sai mật khẩu → 401', async () => {
    prisma.users.findUnique.mockResolvedValue(makeUser({ is_active: false }));
    await expect(login({ email: 'reader1@demolib.local', password: PASSWORD })).rejects.toMatchObject({
      status: 403,
      code: 'ACCOUNT_DISABLED',
    });
    await expect(
      login({ email: 'reader1@demolib.local', password: 'sai-mat-khau' }),
    ).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
  });
});

describe('2.1.2 Đăng nhập — POST /api/auth/login', () => {
  const app = createApp();

  it('U-01 (route): hợp lệ → 200 { data: { token, expiresIn, user } }', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ' Reader1@DemoLib.Local', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ expiresIn: 86400, user: { role: 'READER' } });
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(prisma.users.findUnique).toHaveBeenCalledWith({ where: { email: 'reader1@demolib.local' } });
  });

  it('U-03/04 (route): body rỗng → 400 VALIDATION_ERROR kèm 2 field', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field).sort()).toEqual(['email', 'password']);
  });

  it('U-05 (route): sai mật khẩu → 401 INVALID_CREDENTIALS', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'reader1@demolib.local', password: 'sai-mat-khau' });
    expect(res.status).toBe(401);
    expect(res.body.error).toEqual({
      code: 'INVALID_CREDENTIALS',
      message: 'Email hoặc mật khẩu không đúng',
    });
  });
});

describe('2.1.2 Đăng nhập — GET /api/auth/me + authenticate', () => {
  const app = createApp();
  const me = (authorization) => {
    const req = request(app).get('/api/auth/me');
    return authorization === undefined ? req : req.set('Authorization', authorization);
  };

  it('U-07 HC-05: token hợp lệ → 200, trả đúng user', async () => {
    const res = await me(`Bearer ${sign({ role: 'READER' })}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: makeUser().id, email: 'reader1@demolib.local', isActive: true });
    expect(res.body.data).not.toHaveProperty('password_hash');
    expect(prisma.users.findUnique).toHaveBeenCalledWith({ where: { id: makeUser().id } });
  });

  it('U-08 EC-06: token hết hạn → 401 UNAUTHORIZED', async () => {
    const expired = sign({ role: 'READER', iat: Math.floor(Date.now() / 1000) - 90000 });
    const res = await me(`Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('U-09 EC-07: chữ ký bị sửa / ký bằng secret khác → 401', async () => {
    const token = sign({ role: 'READER' });
    const tampered = token.slice(0, -2) + (token.endsWith('AA') ? 'BB' : 'AA');
    for (const t of [tampered, sign({ role: 'ADMIN' }, {}, 'secret-khac')]) {
      const res = await me(`Bearer ${t}`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    }
  });

  it.each([
    ['không có header', undefined],
    ['header rỗng', ''],
    ['thiếu "Bearer"', 'Token abc'],
    ['chỉ có "Bearer"', 'Bearer'],
  ])('U-10 EC-08: %s → 401', async (_, header) => {
    const res = await me(header);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(prisma.users.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ['bị vô hiệu hóa', () => makeUser({ is_active: false })],
    ['đã bị xóa', () => null],
  ])('U-11 EC-09: token hợp lệ nhưng user %s → 401', async (_, user) => {
    prisma.users.findUnique.mockResolvedValue(user());
    const res = await me(`Bearer ${sign({ role: 'READER' })}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('2.1.2 Đăng nhập — requireRole', () => {
  // Route giả lập endpoint Staff (endpoint thật xuất hiện từ 3.4)
  const app = express();
  app.get('/staff', authenticate, requireRole('LIBRARIAN', 'ADMIN'), (req, res) => res.json({ ok: true }));
  app.use(errorHandler);

  it('U-12 EC-10: Reader gọi endpoint Staff → 403 FORBIDDEN', async () => {
    const res = await request(app)
      .get('/staff')
      .set('Authorization', `Bearer ${sign({ role: 'READER' })}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it.each(['LIBRARIAN', 'ADMIN'])('U-12: %s gọi endpoint Staff → 200', async (role) => {
    prisma.users.findUnique.mockResolvedValue(makeUser({ role }));
    const res = await request(app)
      .get('/staff')
      .set('Authorization', `Bearer ${sign({ role })}`);
    expect(res.status).toBe(200);
  });
});
