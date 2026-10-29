import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { authenticate, requireRole } from '../middlewares/auth.js';
import { createBookSchema } from '../validators/book.validator.js';
import * as bookService from '../services/book.service.js';

export const bookRouter = Router();

const staffOnly = [authenticate, requireRole('LIBRARIAN', 'ADMIN')];

// 2.2.2 Thêm sách mới
bookRouter.post('/', staffOnly, validate({ body: createBookSchema }), async (req, res) => {
  res.status(201).json({ data: await bookService.createBook(req.body) });
});
