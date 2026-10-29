import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';

const categoryExists = () => AppError.conflict('CATEGORY_EXISTS', 'Tên thể loại đã tồn tại');
const categoryHasBooks = () =>
  AppError.conflict('CATEGORY_HAS_BOOKS', 'Không thể xóa thể loại vẫn còn sách');
const categoryNotFound = () => AppError.notFound('Không tìm thấy thể loại');

// BR-03: bookCount chỉ đếm sách chưa bị xóa mềm
const selectWithBookCount = {
  id: true,
  name: true,
  _count: { select: { books: { where: { deleted_at: null } } } },
};

const toCategoryDto = ({ id, name, _count }) => ({ id, name, bookCount: _count?.books ?? 0 });

// Trùng tên không phân biệt hoa thường (unique index lower(name) là chốt chặn cuối)
const assertNameAvailable = async (name, exceptId) => {
  const duplicate = await prisma.categories.findFirst({
    where: { name: { equals: name, mode: 'insensitive' }, ...(exceptId && { NOT: { id: exceptId } }) },
    select: { id: true },
  });
  if (duplicate) throw categoryExists();
};

export const listCategories = async () => {
  const categories = await prisma.categories.findMany({
    select: selectWithBookCount,
    orderBy: { name: 'asc' },
  });
  return categories.map(toCategoryDto);
};

export const createCategory = async ({ name }) => {
  await assertNameAvailable(name);
  try {
    return toCategoryDto(await prisma.categories.create({ data: { name }, select: selectWithBookCount }));
  } catch (err) {
    // Hai request thêm cùng tên song song → unique constraint
    if (err?.code === 'P2002') throw categoryExists();
    throw err;
  }
};

export const updateCategory = async (id, { name }) => {
  const existing = await prisma.categories.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw categoryNotFound();
  // EC-05: giữ nguyên tên của chính nó (kể cả đổi hoa thường) vẫn hợp lệ
  await assertNameAvailable(name, id);
  try {
    return toCategoryDto(
      await prisma.categories.update({ where: { id }, data: { name }, select: selectWithBookCount }),
    );
  } catch (err) {
    if (err?.code === 'P2002') throw categoryExists();
    if (err?.code === 'P2025') throw categoryNotFound();
    throw err;
  }
};

// Trigger trg_categories_block_delete raise SQLSTATE 23503 'CATEGORY_HAS_BOOKS' (R-03)
const isBlockedByTrigger = (err) =>
  err?.code === 'P2003' || String(err?.message ?? '').includes('CATEGORY_HAS_BOOKS');

export const deleteCategory = async (id) => {
  const existing = await prisma.categories.findUnique({ where: { id }, select: selectWithBookCount });
  if (!existing) throw categoryNotFound();
  // BR-01: còn sách chưa xóa mềm → không cho xóa
  if (existing._count.books > 0) throw categoryHasBooks();
  try {
    await prisma.categories.delete({ where: { id } });
  } catch (err) {
    if (err?.code === 'P2025') throw categoryNotFound();
    if (isBlockedByTrigger(err)) throw categoryHasBooks();
    throw err;
  }
};
