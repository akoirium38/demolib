import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { verifyToken } from '../utils/jwt.js';

// Xác thực JWT ở header Authorization: Bearer <token>; gắn req.user (bản ghi DB mới nhất).
// Tra lại DB mỗi request để user bị vô hiệu hóa/xóa sau khi đăng nhập không dùng được token cũ (2.1.2 EC-09).
export const authenticate = async (req, res, next) => {
  const [scheme, token] = (req.get('authorization') ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) return next(AppError.unauthorized());

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return next(AppError.unauthorized('Phiên đăng nhập không hợp lệ hoặc đã hết hạn'));
  }

  const user = await prisma.users.findUnique({ where: { id: payload.sub } });
  if (!user || !user.is_active) {
    return next(AppError.unauthorized('Phiên đăng nhập không hợp lệ hoặc đã hết hạn'));
  }

  req.user = user;
  next();
};

// Dùng sau authenticate: requireRole('LIBRARIAN', 'ADMIN')
export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user?.role)) return next(AppError.forbidden());
    next();
  };
