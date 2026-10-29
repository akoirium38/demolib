import { AppError } from '../utils/AppError.js';

export const notFoundHandler = (req, res, next) => {
  next(AppError.notFound(`Không tìm thấy ${req.method} ${req.originalUrl}`));
};

// Express nhận diện error middleware qua 4 tham số — giữ nguyên `next`.
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    const error = { code: err.code, message: err.message };
    if (err.details) error.details = err.details;
    return res.status(err.status).json({ error });
  }

  // Body JSON sai cú pháp (express.json)
  if (err.type === 'entity.parse.failed') {
    return res
      .status(400)
      .json({ error: { code: 'VALIDATION_ERROR', message: 'JSON không hợp lệ' } });
  }

  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Lỗi hệ thống' } });
};
