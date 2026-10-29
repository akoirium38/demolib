import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { toUserDto } from '../utils/serializers.js';
import { signToken, tokenTtlSeconds } from '../utils/jwt.js';

const BCRYPT_COST = 10;
const emailExists = () => AppError.conflict('EMAIL_EXISTS', 'Email đã được sử dụng');

// 2.1.1 — input đã qua registerSchema (email trim + lowercase, name trim, field lạ bị bỏ)
export const register = async ({ email, name, password }) => {
  const existing = await prisma.users.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw emailExists();

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  try {
    const user = await prisma.users.create({
      data: { email, name, password_hash: passwordHash, role: 'READER', is_active: true },
    });
    return toUserDto(user);
  } catch (err) {
    // Hai request đăng ký cùng email song song → unique constraint
    if (err?.code === 'P2002') throw emailExists();
    throw err;
  }
};

const invalidCredentials = () =>
  new AppError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng');

// 2.1.2 — input đã qua loginSchema (email trim + lowercase)
export const login = async ({ email, password }) => {
  const user = await prisma.users.findUnique({ where: { email } });
  // BR-01: email không tồn tại hay sai mật khẩu đều cùng một lỗi
  if (!user || !(await bcrypt.compare(password, user.password_hash))) throw invalidCredentials();
  // BR-02: chỉ báo vô hiệu hóa khi mật khẩu đã đúng
  if (!user.is_active) throw new AppError(403, 'ACCOUNT_DISABLED', 'Tài khoản đã bị vô hiệu hóa');

  const token = signToken(user);
  return { token, expiresIn: tokenTtlSeconds(token), user: toUserDto(user) };
};
