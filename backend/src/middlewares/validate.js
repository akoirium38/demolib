import { AppError } from '../utils/AppError.js';

// validate({ body, query, params }) — mỗi phần là một Joi schema; giá trị đã chuẩn hóa ghi đè lại req.
export const validate = (schemas) => (req, res, next) => {
  const details = [];
  for (const part of ['params', 'query', 'body']) {
    const schema = schemas[part];
    if (!schema) continue;
    const { value, error } = schema.validate(req[part] ?? {}, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    if (error) {
      // Mỗi field chỉ giữ lỗi đầu tiên (vd. confirmPassword rỗng vừa "empty" vừa "không khớp")
      for (const d of error.details) {
        const field = d.path.join('.');
        if (!details.some((x) => x.field === field)) details.push({ field, message: d.message });
      }
    } else if (part === 'query') {
      // Express 5: req.query là getter, không gán trực tiếp được
      Object.defineProperty(req, 'query', { value, writable: true, configurable: true });
    } else {
      req[part] = value;
    }
  }
  if (details.length) return next(AppError.badRequest('Dữ liệu không hợp lệ', details));
  next();
};
