import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: { users: { findUnique: vi.fn(), create: vi.fn() } },
}));

const { prisma } = await import('../../src/lib/prisma.js');
const { registerSchema } = await import('../../src/validators/auth.validator.js');
const { register } = await import('../../src/services/auth.service.js');
const { createApp } = await import('../../src/app.js');

const valid = {
  email: 'an@example.com',
  name: 'Nguyễn Văn An',
  password: '12345678',
  confirmPassword: '12345678',
};

const fieldsWithError = (body) => {
  const { error } = registerSchema.validate(body, { abortEarly: false, stripUnknown: true });
  return error ? [...new Set(error.details.map((d) => d.path.join('.')))] : [];
};

const clean = (body) => registerSchema.validate(body, { abortEarly: false, stripUnknown: true }).value;

// Giả lập Prisma: create trả lại bản ghi như DB
const fakeCreate = () =>
  prisma.users.create.mockImplementation(async ({ data }) => ({
    id: '00000000-0000-0000-0000-000000000001',
    phone: null,
    address: null,
    created_at: new Date('2026-10-29T00:00:00Z'),
    updated_at: new Date('2026-10-29T00:00:00Z'),
    ...data,
  }));

beforeEach(() => {
  vi.clearAllMocks();
  prisma.users.findUnique.mockResolvedValue(null);
  fakeCreate();
});

describe('2.1.1 Đăng ký — registerSchema', () => {
  it('U-02 HC-02: email được trim + lowercase', () => {
    expect(clean({ ...valid, email: '  A@Example.com ' }).email).toBe('a@example.com');
  });

  it('U-03 HC-03: mật khẩu đúng 8 và đúng 16 ký tự hợp lệ', () => {
    for (const pw of ['a'.repeat(8), 'a'.repeat(16)]) {
      expect(fieldsWithError({ ...valid, password: pw, confirmPassword: pw })).toEqual([]);
    }
  });

  it('U-04 HC-04: tên đúng 50 ký tự hợp lệ và được trim', () => {
    const name = 'a'.repeat(50);
    expect(fieldsWithError({ ...valid, name: `  ${name}  ` })).toEqual([]);
    expect(clean({ ...valid, name: `  ${name}  ` }).name).toBe(name);
  });

  it.each(['abc', 'a@', '@b.com'])('U-06 EC-01: email sai định dạng "%s"', (email) => {
    expect(fieldsWithError({ ...valid, email })).toEqual(['email']);
  });

  it.each(['', '   '])('U-09 EC-03: tên rỗng / chỉ khoảng trắng "%s"', (name) => {
    expect(fieldsWithError({ ...valid, name })).toEqual(['name']);
  });

  it('U-10 EC-04: tên 51 ký tự', () => {
    expect(fieldsWithError({ ...valid, name: 'a'.repeat(51) })).toEqual(['name']);
  });

  it.each([
    ['7 ký tự (EC-05)', 'a'.repeat(7)],
    ['17 ký tự (EC-06)', 'a'.repeat(17)],
    ['rỗng (EC-07)', ''],
  ])('U-11: mật khẩu %s', (_, pw) => {
    expect(fieldsWithError({ ...valid, password: pw, confirmPassword: pw })).toContain('password');
  });

  it.each([
    ['không khớp (EC-08)', '87654321'],
    ['rỗng (EC-09)', ''],
  ])('U-12: xác nhận mật khẩu %s', (_, confirmPassword) => {
    expect(fieldsWithError({ ...valid, confirmPassword })).toEqual(['confirmPassword']);
  });

  it('U-13 EC-10: role / is_active gửi lên bị bỏ qua', () => {
    const value = clean({ ...valid, role: 'ADMIN', is_active: false, isActive: false });
    expect(value).not.toHaveProperty('role');
    expect(value).not.toHaveProperty('is_active');
    expect(value).not.toHaveProperty('isActive');
  });

  it('U-14 EC-11: body rỗng → lỗi đủ 4 trường', () => {
    expect(fieldsWithError({}).sort()).toEqual(['confirmPassword', 'email', 'name', 'password']);
  });
});

describe('2.1.1 Đăng ký — auth.service.register', () => {
  it('U-01 HC-01: tạo user READER, is_active = true, không trả mật khẩu', async () => {
    const user = await register(clean(valid));
    const { data } = prisma.users.create.mock.calls[0][0];
    expect(data).toMatchObject({ email: 'an@example.com', role: 'READER', is_active: true });
    expect(user).toMatchObject({ email: 'an@example.com', role: 'READER', isActive: true });
    expect(user).not.toHaveProperty('password_hash');
    expect(user).not.toHaveProperty('password');
  });

  it('U-05 BR-02: lưu hash bcrypt, khớp với mật khẩu gốc', async () => {
    await register(clean(valid));
    const { password_hash: hash } = prisma.users.create.mock.calls[0][0].data;
    expect(hash).not.toBe(valid.password);
    expect(await bcrypt.compare(valid.password, hash)).toBe(true);
  });

  it('U-07 EC-02: email đã tồn tại → 409 EMAIL_EXISTS', async () => {
    prisma.users.findUnique.mockResolvedValue({ id: 'x' });
    await expect(register(clean(valid))).rejects.toMatchObject({
      status: 409,
      code: 'EMAIL_EXISTS',
    });
    expect(prisma.users.create).not.toHaveBeenCalled();
  });

  it('U-08 EC-02: race condition — create ném P2002 → 409 EMAIL_EXISTS', async () => {
    prisma.users.create.mockRejectedValue(Object.assign(new Error('Unique'), { code: 'P2002' }));
    await expect(register(clean(valid))).rejects.toMatchObject({
      status: 409,
      code: 'EMAIL_EXISTS',
    });
  });
});

describe('2.1.1 Đăng ký — POST /api/auth/register', () => {
  const app = createApp();

  it('U-15: hợp lệ → 201 { data } dạng camelCase', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...valid, email: 'A@Example.com', role: 'ADMIN' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      email: 'a@example.com',
      name: valid.name,
      role: 'READER',
      isActive: true,
    });
    expect(res.body.data.createdAt).toBeDefined();
    expect(res.body.data).not.toHaveProperty('password_hash');
  });

  it('U-14 (route): body rỗng → 400 VALIDATION_ERROR kèm 4 field', async () => {
    const res = await request(app).post('/api/auth/register').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field).sort()).toEqual([
      'confirmPassword',
      'email',
      'name',
      'password',
    ]);
  });

  it('U-07 (route): email trùng → 409 EMAIL_EXISTS', async () => {
    prisma.users.findUnique.mockResolvedValue({ id: 'x' });
    const res = await request(app).post('/api/auth/register').send(valid);
    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({ code: 'EMAIL_EXISTS', message: 'Email đã được sử dụng' });
  });
});
