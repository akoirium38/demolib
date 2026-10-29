// Chuyển bản ghi DB (snake_case) → DTO trả về client (camelCase). Không bao giờ lộ password_hash.
export const toUserDto = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  phone: user.phone,
  address: user.address,
  role: user.role,
  isActive: user.is_active,
  createdAt: user.created_at,
});
