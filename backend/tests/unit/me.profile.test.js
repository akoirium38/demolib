import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET ??= 'unit-test-secret';

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    users: { findUnique: vi.fn(), update: vi.fn() },
    loans: { count: vi.fn() },
    fines: { groupBy: vi.fn() },
  },
}));

const { prisma } = await import('../../src/lib/prisma.js');
const { env } = await import('../../src/config/env.js');
const { updateProfileSchema, changePasswordSchema } = await import(
  '../../src/validators/me.validator.js'
);
const { getProfile, updateProfile, changePassword } = await import(
  '../../src/services/me.service.js'
);
const { createApp } = await import('../../src/app.js');

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

const VALID_PROFILE = { name: 'Trần Văn Bình', phone: '0912345678', address: '12 Lê Lợi, Huế' };
const VALID_PASSWORDS = { currentPassword: PASSWORD, newPassword: 'matkhaumoi1', confirmPassword: 'matkhaumoi1' };

const fieldsWithError = (schema, body) => {
  const { error } = schema.validate(body, { abortEarly: false, stripUnknown: true });
  return error ? [...new Set(error.details.map((d) => d.path.join('.')))] : [];
};

// Prisma trả Decimal cho numeric — giả lập bằng object có valueOf/toString như Decimal.js
const decimal = (n) => ({ valueOf: () => String(n), toString: () => String(n) });

beforeAll(async () => {
  passwordHash = await bcrypt.hash(PASSWORD, 4);
});

beforeEach(() => {
  vi.clearAllMocks();
  prisma.users.findUnique.mockResolvedValue(makeUser());
  prisma.users.update.mockImplementation(async ({ data }) => makeUser(data));
  prisma.loans.count.mockResolvedValue(0);
  prisma.fines.groupBy.mockResolvedValue([]);
});

describe('2.1.3 Hồ sơ — updateProfileSchema', () => {
  it('U-01 HC-04/05: dữ liệu hợp lệ (cả SĐT +84) được trim và chấp nhận', () => {
    for (const phone of ['0912345678', '+84912345678', '0381234567']) {
      expect(fieldsWithError(updateProfileSchema, { ...VALID_PROFILE, phone })).toEqual([]);
    }
    const { value } = updateProfileSchema.validate({ name: '  An ', phone: ' 0912345678 ', address: ' Huế ' });
    expect(value).toEqual({ name: 'An', phone: '0912345678', address: 'Huế' });
  });

  it.each([
    ['rỗng', ''],
    ['chỉ khoảng trắng', '   '],
    ['51 ký tự', 'a'.repeat(51)],
  ])('U-02 EC-02: tên %s → lỗi name', (_, name) => {
    expect(fieldsWithError(updateProfileSchema, { ...VALID_PROFILE, name })).toEqual(['name']);
  });

  it('U-02: tên đúng 50 ký tự hợp lệ', () => {
    expect(fieldsWithError(updateProfileSchema, { ...VALID_PROFILE, name: 'a'.repeat(50) })).toEqual([]);
  });

  it.each(['123', '0123456789', '09123abc78', '091234567', '', undefined])(
    'U-03 EC-03: SĐT "%s" → lỗi phone',
    (phone) => {
      expect(fieldsWithError(updateProfileSchema, { ...VALID_PROFILE, phone })).toEqual(['phone']);
    },
  );

  it.each([
    ['rỗng', ''],
    ['256 ký tự', 'a'.repeat(256)],
  ])('U-04 EC-04: địa chỉ %s → lỗi address', (_, address) => {
    expect(fieldsWithError(updateProfileSchema, { ...VALID_PROFILE, address })).toEqual(['address']);
  });

  it('U-04: địa chỉ đúng 255 ký tự hợp lệ', () => {
    expect(fieldsWithError(updateProfileSchema, { ...VALID_PROFILE, address: 'a'.repeat(255) })).toEqual([]);
  });

  it('U-05 EC-05: email, role trong body bị bỏ', () => {
    const { value } = updateProfileSchema.validate(
      { ...VALID_PROFILE, email: 'hacker@x.com', role: 'ADMIN' },
      { stripUnknown: true },
    );
    expect(value).toEqual(VALID_PROFILE);
  });
});

describe('2.1.3 Hồ sơ — changePasswordSchema', () => {
  it.each([
    ['7 ký tự', 'a'.repeat(7)],
    ['17 ký tự', 'a'.repeat(17)],
  ])('U-06 EC-07: mật khẩu mới %s → lỗi newPassword', (_, pw) => {
    const body = { currentPassword: PASSWORD, newPassword: pw, confirmPassword: pw };
    expect(fieldsWithError(changePasswordSchema, body)).toEqual(['newPassword']);
  });

  it('U-06: mật khẩu mới đúng 8 và 16 ký tự hợp lệ', () => {
    for (const pw of ['b'.repeat(8), 'b'.repeat(16)]) {
      const body = { currentPassword: PASSWORD, newPassword: pw, confirmPassword: pw };
      expect(fieldsWithError(changePasswordSchema, body)).toEqual([]);
    }
  });

  it('U-07 EC-08: xác nhận không khớp → lỗi confirmPassword', () => {
    const body = { ...VALID_PASSWORDS, confirmPassword: 'khac-hoan-toan' };
    expect(fieldsWithError(changePasswordSchema, body)).toEqual(['confirmPassword']);
  });

  it('U-08 EC-09: mật khẩu mới trùng mật khẩu hiện tại → lỗi newPassword', () => {
    const body = { currentPassword: PASSWORD, newPassword: PASSWORD, confirmPassword: PASSWORD };
    expect(fieldsWithError(changePasswordSchema, body)).toEqual(['newPassword']);
  });

  it('U-08: thiếu mật khẩu hiện tại → lỗi currentPassword', () => {
    const { currentPassword: _, ...body } = VALID_PASSWORDS;
    expect(fieldsWithError(changePasswordSchema, body)).toEqual(['currentPassword']);
  });
});

describe('2.1.3 Hồ sơ — me.service.getProfile', () => {
  it('U-09 HC-01: reader mới → phone/address null, thống kê 0', async () => {
    const profile = await getProfile(makeUser());
    expect(profile).toMatchObject({ phone: null, address: null, role: 'READER' });
    expect(profile.stats).toEqual({ borrowCount: 0, totalFine: 0, unpaidFine: 0 });
    expect(profile).not.toHaveProperty('password_hash');
  });

  it('U-09: nhóm phạt có _sum null vẫn ra 0', async () => {
    prisma.fines.groupBy.mockResolvedValue([{ status: 'UNPAID', _sum: { amount: null } }]);
    expect((await getProfile(makeUser())).stats).toMatchObject({ totalFine: 0, unpaidFine: 0 });
  });

  it('U-10 HC-02: số lần mượn chỉ tính BORROWING/OVERDUE/RETURNED của chính user', async () => {
    prisma.loans.count.mockResolvedValue(3);
    const profile = await getProfile(makeUser());
    expect(profile.stats.borrowCount).toBe(3);
    expect(prisma.loans.count).toHaveBeenCalledWith({
      where: { user_id: makeUser().id, status: { in: ['BORROWING', 'OVERDUE', 'RETURNED'] } },
    });
  });

  it('U-11 HC-03: 20.000 PAID + 30.000 UNPAID → tổng 50.000, còn nợ 30.000', async () => {
    prisma.fines.groupBy.mockResolvedValue([
      { status: 'PAID', _sum: { amount: decimal(20000) } },
      { status: 'UNPAID', _sum: { amount: decimal(30000) } },
    ]);
    expect((await getProfile(makeUser())).stats).toMatchObject({ totalFine: 50000, unpaidFine: 30000 });
    expect(prisma.fines.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: makeUser().id } }),
    );
  });

  it('U-11: PENDING và REJECTED cũng tính là còn nợ', async () => {
    prisma.fines.groupBy.mockResolvedValue([
      { status: 'PAID', _sum: { amount: decimal(10000) } },
      { status: 'UNPAID', _sum: { amount: decimal(10000) } },
      { status: 'PENDING', _sum: { amount: decimal(30000) } },
      { status: 'REJECTED', _sum: { amount: decimal(80000) } },
    ]);
    expect((await getProfile(makeUser())).stats).toMatchObject({ totalFine: 130000, unpaidFine: 120000 });
  });
});

describe('2.1.3 Hồ sơ — updateProfile / changePassword', () => {
  it('U-12 HC-04/EC-05: chỉ cập nhật name/phone/address của chính user', async () => {
    const result = await updateProfile(makeUser().id, { ...VALID_PROFILE, email: 'x@x.com', role: 'ADMIN' });
    expect(prisma.users.update).toHaveBeenCalledWith({
      where: { id: makeUser().id },
      data: VALID_PROFILE,
    });
    expect(result).toMatchObject({ ...VALID_PROFILE, email: 'reader1@demolib.local', role: 'READER' });
    expect(result).not.toHaveProperty('password_hash');
  });

  it('U-13 EC-06: sai mật khẩu hiện tại → 400 WRONG_PASSWORD, không lưu', async () => {
    await expect(
      changePassword(makeUser(), { currentPassword: 'sai-mat-khau', newPassword: 'matkhaumoi1' }),
    ).rejects.toMatchObject({ status: 400, code: 'WRONG_PASSWORD' });
    expect(prisma.users.update).not.toHaveBeenCalled();
  });

  it('U-14 HC-06: đúng mật khẩu → lưu hash mới khớp mật khẩu mới', async () => {
    await changePassword(makeUser(), { currentPassword: PASSWORD, newPassword: 'matkhaumoi1' });
    const { where, data } = prisma.users.update.mock.calls[0][0];
    expect(where).toEqual({ id: makeUser().id });
    expect(await bcrypt.compare('matkhaumoi1', data.password_hash)).toBe(true);
    expect(await bcrypt.compare(PASSWORD, data.password_hash)).toBe(false);
  });
});

describe('2.1.3 Hồ sơ — routes /api/me/*', () => {
  const app = createApp();
  const token = () => jwt.sign({ role: 'READER' }, env.jwtSecret, { subject: makeUser().id, expiresIn: '24h' });
  const auth = (req) => req.set('Authorization', `Bearer ${token()}`);

  it.each([
    ['get', '/api/me/profile'],
    ['put', '/api/me/profile'],
    ['put', '/api/me/password'],
  ])('U-15 EC-01: %s %s không có token → 401', async (method, path) => {
    const res = await request(app)[method](path).send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('U-09 (route): GET /profile → 200 kèm stats', async () => {
    const res = await auth(request(app).get('/api/me/profile'));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ email: 'reader1@demolib.local', stats: { borrowCount: 0 } });
    expect(res.body.data).not.toHaveProperty('password_hash');
  });

  it('U-12 (route): PUT /profile hợp lệ → 200, không có stats', async () => {
    const res = await auth(request(app).put('/api/me/profile')).send({ ...VALID_PROFILE, role: 'ADMIN' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ ...VALID_PROFILE, role: 'READER' });
    expect(res.body.data).not.toHaveProperty('stats');
  });

  it('U-02/03/04 (route): PUT /profile body rỗng → 400 kèm 3 field', async () => {
    const res = await auth(request(app).put('/api/me/profile')).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field).sort()).toEqual(['address', 'name', 'phone']);
  });

  it('U-13 (route): PUT /password sai mật khẩu hiện tại → 400 WRONG_PASSWORD', async () => {
    const res = await auth(request(app).put('/api/me/password')).send({
      ...VALID_PASSWORDS,
      currentPassword: 'sai-mat-khau',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({ code: 'WRONG_PASSWORD', message: 'Mật khẩu hiện tại không đúng' });
  });

  it('U-14 (route): PUT /password hợp lệ → 200 thông báo thành công', async () => {
    const res = await auth(request(app).put('/api/me/password')).send(VALID_PASSWORDS);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ message: 'Đổi mật khẩu thành công' });
  });
});
