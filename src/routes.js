import { Router } from 'express';
import { db } from './db.js';
import authRoutes from './features/auth/auth.routes.js';

const router = Router();

router.get('/health', async (req, res) => {
  try {
    await db.raw('SELECT 1');
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Health check failed', err);
    res.status(503).json({ status: 'unavailable' });
  }
});

router.use('/auth', authRoutes);

export default router;
