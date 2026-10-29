import Joi from 'joi';

export const categoryBodySchema = Joi.object({
  name: Joi.string().trim().max(50).required().messages({
    'any.required': 'Vui lòng nhập tên thể loại',
    'string.empty': 'Vui lòng nhập tên thể loại',
    'string.max': 'Tên thể loại tối đa 50 ký tự',
  }),
});

// categories.id là integer identity → chặn giá trị ngoài int4 trước khi tới Prisma
export const categoryIdParamsSchema = Joi.object({
  id: Joi.number().integer().min(1).max(2147483647).required().messages({
    'number.base': 'Mã thể loại không hợp lệ',
    'number.integer': 'Mã thể loại không hợp lệ',
    'number.min': 'Mã thể loại không hợp lệ',
    'number.max': 'Mã thể loại không hợp lệ',
  }),
});
