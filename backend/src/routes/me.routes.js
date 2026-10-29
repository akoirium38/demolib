import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/auth.js';
import { changePasswordSchema, updateProfileSchema } from '../validators/me.validator.js';
import * as meService from '../services/me.service.js';

// 2.1.3 Hồ sơ cá nhân — mọi vai trò đã đăng nhập
export const meRouter = Router();

meRouter.use(authenticate);

meRouter.get('/profile', async (req, res) => {
  res.json({ data: await meService.getProfile(req.user) });
});

meRouter.put('/profile', validate({ body: updateProfileSchema }), async (req, res) => {
  res.json({ data: await meService.updateProfile(req.user.id, req.body) });
});

meRouter.put('/password', validate({ body: changePasswordSchema }), async (req, res) => {
  await meService.changePassword(req.user, req.body);
  res.json({ data: { message: 'Đổi mật khẩu thành công' } });
});
