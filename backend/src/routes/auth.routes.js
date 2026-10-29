import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { registerSchema } from '../validators/auth.validator.js';
import * as authService from '../services/auth.service.js';

export const authRouter = Router();

authRouter.post('/register', validate({ body: registerSchema }), async (req, res) => {
  const user = await authService.register(req.body);
  res.status(201).json({ data: user });
});
