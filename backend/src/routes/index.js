import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { meRouter } from './me.routes.js';
import { categoryRouter } from './category.routes.js';

export const router = Router();

router.get('/health', (req, res) => {
  res.json({ data: { status: 'ok' } });
});

router.use('/auth', authRouter);
router.use('/me', meRouter);
router.use('/categories', categoryRouter);
