import Joi from 'joi';
import { isValidIsbn, normalizeIsbn } from '../utils/isbn.js';

export const MIN_PUBLISH_YEAR = 1900;
export const MAX_QUANTITY = 9999;

// "Năm hiện tại" theo giờ Việt Nam, tính lúc validate (không cố định lúc khởi động server)
export const currentYear = () =>
  Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric' }).format(new Date()));

const requiredText = (label, max) =>
  Joi.string()
    .trim()
    .max(max)
    .required()
    .messages({
      'any.required': `Vui lòng nhập ${label}`,
      'string.empty': `Vui lòng nhập ${label}`,
      'string.base': `${label[0].toUpperCase()}${label.slice(1)} không hợp lệ`,
      'string.max': `${label[0].toUpperCase()}${label.slice(1)} tối đa ${max} ký tự`,
    });

// Không bắt buộc: "" / null / chỉ khoảng trắng → không có ISBN
const isbnRule = Joi.string()
  .empty('')
  .allow(null)
  .custom((value, helpers) => {
    if (value.trim() === '') return null;
    const isbn = normalizeIsbn(value);
    return isValidIsbn(isbn) ? isbn : helpers.error('isbn.invalid');
  })
  .messages({
    'string.base': 'ISBN không hợp lệ',
    'isbn.invalid': 'ISBN không hợp lệ (cần ISBN-10 hoặc ISBN-13 đúng chữ số kiểm tra)',
  });

const publishYearRule = Joi.number()
  .integer()
  .min(MIN_PUBLISH_YEAR)
  .required()
  .custom((value, helpers) => (value > currentYear() ? helpers.error('year.future') : value))
  .messages({
    'any.required': 'Vui lòng nhập năm xuất bản',
    'number.base': 'Năm xuất bản phải là số',
    'number.integer': 'Năm xuất bản phải là số nguyên',
    'number.min': `Năm xuất bản phải từ ${MIN_PUBLISH_YEAR}`,
    'year.future': 'Năm xuất bản không được lớn hơn năm hiện tại',
  });

// 2.2.2 Thêm sách mới
export const createBookSchema = Joi.object({
  title: requiredText('tên sách', 100),
  author: requiredText('tác giả', 100),
  publishYear: publishYearRule,
  isbn: isbnRule,
  categoryId: Joi.number().integer().min(1).max(2147483647).required().messages({
    'any.required': 'Vui lòng chọn thể loại',
    'number.base': 'Vui lòng chọn thể loại',
    'number.integer': 'Thể loại không hợp lệ',
    'number.min': 'Thể loại không hợp lệ',
    'number.max': 'Thể loại không hợp lệ',
  }),
  description: requiredText('mô tả', 255),
  quantity: Joi.number().integer().min(1).max(MAX_QUANTITY).required().messages({
    'any.required': 'Vui lòng nhập số lượng',
    'number.base': 'Số lượng phải là số',
    'number.integer': 'Số lượng phải là số nguyên',
    'number.min': 'Số lượng phải lớn hơn 0',
    'number.max': `Số lượng tối đa ${MAX_QUANTITY}`,
  }),
});
