import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/auth.js';
import { loginSchema, registerSchema } from '../validators/auth.validator.js';
import * as authService from '../services/auth.service.js';
import { toUserDto } from '../utils/serializers.js';

export const authRouter = Router();

authRouter.post('/register', validate({ body: registerSchema }), async (req, res) => {
  const user = await authService.register(req.body);
  res.status(201).json({ data: user });
});

authRouter.post('/login', validate({ body: loginSchema }), async (req, res) => {
  res.json({ data: await authService.login(req.body) });
});

authRouter.get('/me', authenticate, (req, res) => {
  res.json({ data: toUserDto(req.user) });
});
