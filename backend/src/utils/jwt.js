import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const ALGORITHM = 'HS256';

// BR-03: payload { sub, role }, hết hạn sau env.jwtExpiresIn (mặc định 24h)
export const signToken = (user) =>
  jwt.sign({ role: user.role }, env.jwtSecret, {
    algorithm: ALGORITHM,
    subject: user.id,
    expiresIn: env.jwtExpiresIn,
  });

// Ném TokenExpiredError / JsonWebTokenError nếu token không hợp lệ
export const verifyToken = (token) => jwt.verify(token, env.jwtSecret, { algorithms: [ALGORITHM] });

// Số giây token còn hiệu lực ngay sau khi ký (trả về cho client ở field expiresIn)
export const tokenTtlSeconds = (token) => {
  const { exp, iat } = jwt.decode(token);
  return exp - iat;
};
