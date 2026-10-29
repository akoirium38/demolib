import Joi from 'joi';

// 2.1.3 — SĐT Việt Nam: 0 hoặc +84, đầu số di động 3/5/7/8/9, thêm 8 chữ số
export const PHONE_PATTERN = /^(0|\+84)(3|5|7|8|9)\d{8}$/;

const passwordRule = (label) =>
  Joi.string().min(8).max(16).required().messages({
    'any.required': `Vui lòng nhập ${label}`,
    'string.empty': `Vui lòng nhập ${label}`,
    'string.min': 'Mật khẩu tối thiểu 8 ký tự',
    'string.max': 'Mật khẩu tối đa 16 ký tự',
  });

// email, role… không có trong schema → stripUnknown bỏ đi (EC-05, BR-01)
export const updateProfileSchema = Joi.object({
  name: Joi.string().trim().max(50).required().messages({
    'any.required': 'Vui lòng nhập tên',
    'string.empty': 'Vui lòng nhập tên',
    'string.max': 'Tên tối đa 50 ký tự',
  }),
  phone: Joi.string().trim().pattern(PHONE_PATTERN).required().messages({
    'any.required': 'Vui lòng nhập số điện thoại',
    'string.empty': 'Vui lòng nhập số điện thoại',
    'string.pattern.base': 'Số điện thoại không hợp lệ',
  }),
  address: Joi.string().trim().max(255).required().messages({
    'any.required': 'Vui lòng nhập địa chỉ',
    'string.empty': 'Vui lòng nhập địa chỉ',
    'string.max': 'Địa chỉ tối đa 255 ký tự',
  }),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'any.required': 'Vui lòng nhập mật khẩu hiện tại',
    'string.empty': 'Vui lòng nhập mật khẩu hiện tại',
  }),
  newPassword: passwordRule('mật khẩu mới')
    .invalid(Joi.ref('currentPassword'))
    .messages({ 'any.invalid': 'Mật khẩu mới phải khác mật khẩu hiện tại' }),
  confirmPassword: Joi.string().required().valid(Joi.ref('newPassword')).messages({
    'any.required': 'Vui lòng xác nhận mật khẩu mới',
    'string.empty': 'Vui lòng xác nhận mật khẩu mới',
    'any.only': 'Mật khẩu xác nhận không khớp',
  }),
});
