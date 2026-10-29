import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { authenticate, requireRole } from '../middlewares/auth.js';
import { categoryBodySchema, categoryIdParamsSchema } from '../validators/category.validator.js';
import * as categoryService from '../services/category.service.js';

// 2.2.1 Quản lý thể loại sách — xem public (BR-05), thêm/sửa/xóa chỉ Staff
export const categoryRouter = Router();

const staffOnly = [authenticate, requireRole('LIBRARIAN', 'ADMIN')];

categoryRouter.get('/', async (req, res) => {
  res.json({ data: await categoryService.listCategories() });
});

categoryRouter.post('/', staffOnly, validate({ body: categoryBodySchema }), async (req, res) => {
  res.status(201).json({ data: await categoryService.createCategory(req.body) });
});

categoryRouter.put(
  '/:id',
  staffOnly,
  validate({ params: categoryIdParamsSchema, body: categoryBodySchema }),
  async (req, res) => {
    res.json({ data: await categoryService.updateCategory(req.params.id, req.body) });
  },
);

categoryRouter.delete('/:id', staffOnly, validate({ params: categoryIdParamsSchema }), async (req, res) => {
  await categoryService.deleteCategory(req.params.id);
  res.status(204).end();
});
