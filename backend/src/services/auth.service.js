import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { toUserDto } from '../utils/serializers.js';

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
