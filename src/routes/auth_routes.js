import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';

const router = Router();

// GET /api/auth/me
router.get('/me', async (req, res) => {
  if (!req.session.userId) return res.json({ user: null });

  try {
    const user = await db('users')
      .join('roles', 'users.role_id', 'roles.role_id')
      .where('users.user_id', req.session.userId)
      .select(
        'users.user_id as id',
        'membership_no as membershipNo',
        'full_name as fullName',
        'email',
        'phone',
        'role_name as role'
      )
      .first();

    res.json({ user: user || null });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Missing credentials' },
    });
  }

  try {
    const user = await db('users')
      .join('roles', 'users.role_id', 'roles.role_id')
      .where('users.email', identifier)
      .orWhere('users.membership_no', identifier)
      .select('users.*', 'roles.role_name as role')
      .first();

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email/membership number or password' },
      });
    }

    req.session.userId = user.user_id;

    res.json({
      user: {
        id: user.user_id,
        membershipNo: user.membership_no,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { fullName, email, phone, password } = req.body;

  // Basic validation
  const fields = {};
  if (!fullName) fields.fullName = 'Full name is required';
  if (!email) fields.email = 'Email is required';
  if (!phone) fields.phone = 'Phone number is required';
  if (!password || password.length < 8) fields.password = 'Password must be at least 8 characters';

  if (Object.keys(fields).length > 0) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Please fix the errors below', fields },
    });
  }

  try {
    // Check if email already exists
    const existing = await db('users').where({ email }).first();
    if (existing) {
      return res.status(400).json({
        error: {
          code: 'DUPLICATE',
          message: 'An account with this email already exists',
          fields: { email: 'Email already registered' },
        },
      });
    }

    // Get the 'Member' role ID
    const memberRole = await db('roles').where({ role_name: 'Member' }).first();
    if (!memberRole) {
      return res.status(500).json({ error: { code: 'INTERNAL', message: 'Member role not configured in database' } });
    }

    // Generate next membership number safely
    const lastUser = await db('users').where('membership_no', 'like', 'MEM%').orderBy('user_id', 'desc').first();
    let nextNum = 1;
    if (lastUser && lastUser.membership_no) {
      const parsed = parseInt(lastUser.membership_no.replace('MEM', ''), 10);
      if (!isNaN(parsed)) nextNum = parsed + 1;
    }
    const membershipNo = `MEM${String(nextNum).padStart(3, '0')}`;

    // Hash password and insert user
    const passwordHash = await bcrypt.hash(password, 10);
    const [userId] = await db('users').insert({
      membership_no: membershipNo,
      full_name: fullName,
      email,
      phone,
      password_hash: passwordHash,
      role_id: memberRole.role_id,
      status: 'Active',
    });

    // Automatically set session (auto-login after successful registration)
    req.session.userId = userId;

    res.status(201).json({
      user: {
        id: userId,
        membershipNo,
        fullName,
        email,
        phone,
        role: 'Member',
      },
    });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.status(204).end();
  });
});

export default router;