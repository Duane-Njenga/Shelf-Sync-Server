import dotenv from 'dotenv';
import express from 'express';
import session from 'express-session';
import MySQLStore from 'express-mysql-session';
import bcrypt from 'bcryptjs';
import { db } from './src/db.js';

dotenv.config();

const app = express();
app.use(express.json());

const MySQLStoreSession = MySQLStore(session);
const sessionStore = new MySQLStoreSession({}, db.client.pool);

app.use(
  session({
    key: 'shelfsync_sid',
    secret: process.env.SESSION_SECRET || 'local_development_secret_key_123456789',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
  })
);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/auth/me', async (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = await db('users')
    .join('roles', 'users.role_id', 'roles.role_id')
    .where('users.user_id', req.session.userId)
    .select('users.user_id as id', 'membership_no as membershipNo', 'full_name as fullName', 'email', 'phone', 'role_name as role')
    .first();
  res.json({ user: user || null });
});

app.post('/api/auth/login', async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Missing credentials' } });
  }

  const user = await db('users')
    .join('roles', 'users.role_id', 'roles.role_id')
    .where('users.email', identifier)
    .orWhere('users.membership_no', identifier)
    .select('users.*', 'roles.role_name as role')
    .first();

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } });
  }

  req.session.userId = user.user_id;
  res.json({
    user: {
      id: user.user_id,
      membershipNo: user.membership_no,
      fullName: user.full_name,
      email: user.email,
      phone: user.phone,
      role: user.role
    }
  });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.status(204).end();
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
