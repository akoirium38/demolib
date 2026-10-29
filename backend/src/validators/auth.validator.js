import Joi from 'joi';

export const registerSchema = Joi.object({
  email: Joi.string().trim().lowercase().max(255).email({ tlds: { allow: false } }).required().messages({
    'any.required': 'Vui lòng nhập email',
    'string.empty': 'Vui lòng nhập email',
    'string.email': 'Email không hợp lệ',
    'string.max': 'Email tối đa 255 ký tự',
  }),
  name: Joi.string().trim().max(50).required().messages({
    'any.required': 'Vui lòng nhập tên',
    'string.empty': 'Vui lòng nhập tên',
    'string.max': 'Tên tối đa 50 ký tự',
  }),
  password: Joi.string().min(8).max(16).required().messages({
    'any.required': 'Vui lòng nhập mật khẩu',
    'string.empty': 'Vui lòng nhập mật khẩu',
    'string.min': 'Mật khẩu tối thiểu 8 ký tự',
    'string.max': 'Mật khẩu tối đa 16 ký tự',
  }),
  confirmPassword: Joi.string().required().valid(Joi.ref('password')).messages({
    'any.required': 'Vui lòng xác nhận mật khẩu',
    'string.empty': 'Vui lòng xác nhận mật khẩu',
    'any.only': 'Mật khẩu xác nhận không khớp',
  }),
});
