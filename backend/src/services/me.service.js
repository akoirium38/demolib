import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { toUserDto } from '../utils/serializers.js';

const BCRYPT_COST = 10;

// BR-03: số lần mượn = đơn đã được xác nhận; còn nợ = phiếu chưa thanh toán xong
const CONFIRMED_LOAN_STATUSES = ['BORROWING', 'OVERDUE', 'RETURNED'];
const UNPAID_FINE_STATUSES = ['UNPAID', 'PENDING', 'REJECTED'];

export const getProfile = async (user) => {
  const [borrowCount, fineGroups] = await Promise.all([
    prisma.loans.count({ where: { user_id: user.id, status: { in: CONFIRMED_LOAN_STATUSES } } }),
    prisma.fines.groupBy({ by: ['status'], where: { user_id: user.id }, _sum: { amount: true } }),
  ]);

  // _sum.amount là Decimal (numeric(12,0)) hoặc null
  let totalFine = 0;
  let unpaidFine = 0;
  for (const { status, _sum } of fineGroups) {
    const amount = Number(_sum.amount ?? 0);
    totalFine += amount;
    if (UNPAID_FINE_STATUSES.includes(status)) unpaidFine += amount;
  }

  return { ...toUserDto(user), stats: { borrowCount, totalFine, unpaidFine } };
};

// Input đã qua updateProfileSchema (chỉ còn name, phone, address)
export const updateProfile = async (userId, { name, phone, address }) => {
  const user = await prisma.users.update({ where: { id: userId }, data: { name, phone, address } });
  return toUserDto(user);
};

// BR-04: sai mật khẩu hiện tại → 400 WRONG_PASSWORD; token đang dùng vẫn còn hiệu lực
export const changePassword = async (user, { currentPassword, newPassword }) => {
  if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
    throw new AppError(400, 'WRONG_PASSWORD', 'Mật khẩu hiện tại không đúng');
  }
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
  await prisma.users.update({ where: { id: user.id }, data: { password_hash: passwordHash } });
};
