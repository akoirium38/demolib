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

// 2.2.2 BR-02: trạng thái không lưu DB mà suy ra từ available_quantity
export const toBookDto = (book) => ({
  id: book.id,
  title: book.title,
  author: book.author,
  publishYear: book.publish_year,
  isbn: book.isbn,
  category: book.categories ? { id: book.categories.id, name: book.categories.name } : null,
  description: book.description,
  totalQuantity: book.total_quantity,
  availableQuantity: book.available_quantity,
  borrowedQuantity: book.borrowed_quantity,
  damagedQuantity: book.damaged_quantity,
  lostQuantity: book.lost_quantity,
  borrowCount: book.borrow_count,
  status: book.available_quantity > 0 ? 'AVAILABLE' : 'OUT_OF_STOCK',
  createdAt: book.created_at,
});
