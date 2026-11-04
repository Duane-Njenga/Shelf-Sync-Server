import dotenv from 'dotenv';
import express from 'express';
import session from 'express-session';
import MySQLStore from 'express-mysql-session';
import { db } from './src/db.js';

import authRouter from './src/routes/auth_routes.js';
import booksRouter from './src/routes/book_routes.js';

dotenv.config();

const app = express();
app.use(express.json());

const MySQLStoreSession = MySQLStore(session);
const sessionStore = new MySQLStoreSession({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'shelfsync_db',
  createDatabaseTable: true,
});

app.use(
  session({
    key: 'shelfsync_sid',
    secret: process.env.SESSION_SECRET || 'local_development_secret_key_123456789',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRouter);
app.use('/api/books', booksRouter);

app.get('/api/categories', async (req, res) => {
  try {
    const categories = await db('categories').select('*').orderBy('category_name');
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

app.get('/api/members', async (req, res) => {
  try {
    const members = await db('users')
      .join('roles', 'users.role_id', 'roles.role_id')
      .select(
        'user_id as id',
        'membership_no as membershipNo',
        'full_name as fullName',
        'email',
        'phone',
        'status',
        'role_name as role',
        'created_at as createdAt'
      );
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

// Active Loans List
app.get('/api/loans', async (req, res) => {
  try {
    const loans = await db('loans')
      .join('book_copies', 'loans.copy_id', 'book_copies.copy_id')
      .join('books', 'book_copies.book_id', 'books.book_id')
      .join('users', 'loans.user_id', 'users.user_id')
      .select(
        'loans.loan_id as id',
        'books.title',
        'book_copies.barcode',
        'book_copies.copy_id as copyId',
        'users.full_name as memberName',
        'users.membership_no as membershipNo',
        'loans.issue_date as issueDate',
        'loans.due_date as dueDate',
        'loans.return_date as returnDate',
        'loans.status'
      )
      .orderBy('loans.loan_id', 'desc');
    res.json(loans);
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

// Return Book Endpoint
app.patch('/api/loans/:id/return', async (req, res) => {
  const loanId = req.params.id;
  try {
    const loan = await db('loans').where({ loan_id: loanId }).first();
    if (!loan) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Loan record not found' } });

    // Update loan status and mark copy as Available
    await db('loans').where({ loan_id: loanId }).update({
      status: 'Returned',
      return_date: db.fn.now(),
    });

    await db('book_copies').where({ copy_id: loan.copy_id }).update({
      status: 'Available',
    });

    res.json({ success: true, message: 'Book marked as returned' });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

app.get('/api/reservations', async (req, res) => {
  try {
    const reservations = await db('reservations')
      .join('books', 'reservations.book_id', 'books.book_id')
      .join('users', 'reservations.user_id', 'users.user_id')
      .select(
        'reservations.reservation_id as id',
        'books.title',
        'users.full_name as memberName',
        'reservations.reserved_at as reservedAt',
        'reservations.status'
      );
    res.json(reservations);
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

app.get('/api/fines', async (req, res) => {
  try {
    const fines = await db('fines')
      .join('loans', 'fines.loan_id', 'loans.loan_id')
      .join('users', 'loans.user_id', 'users.user_id')
      .select(
        'fines.fine_id as id',
        'users.full_name as memberName',
        'users.phone as memberPhone',
        'fines.amount',
        'fines.days_overdue as daysOverdue',
        'fines.status',
        'fines.issued_at as issuedAt'
      );
    res.json(fines);
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const [totalBooks] = await db('books').whereNull('deleted_at').count('book_id as count');
    const [activeLoans] = await db('loans').where({ status: 'Active' }).count('loan_id as count');
    const [totalMembers] = await db('users').count('user_id as count');
    const [unpaidFines] = await db('fines').where({ status: 'Unpaid' }).sum('amount as total');

    res.json({
      totalBooks: Number(totalBooks.count),
      activeLoans: Number(activeLoans.count),
      totalMembers: Number(totalMembers.count),
      unpaidFines: Number(unpaidFines.total || 0),
    });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await db('users')
      .join('roles', 'users.role_id', 'roles.role_id')
      .select(
        'users.user_id as id',
        'users.membership_no as membershipNo',
        'users.full_name as fullName',
        'users.email',
        'users.phone',
        'users.status',
        'roles.role_id as roleId',
        'roles.role_name as role'
      );
    const roles = await db('roles').select('role_id as id', 'role_name as name');
    res.json({ users, roles });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

app.patch('/api/users/:id/role', async (req, res) => {
  try {
    const { roleId } = req.body;
    await db('users').where({ user_id: req.params.id }).update({ role_id: roleId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

app.get('/api/audit-logs', async (req, res) => {
  try {
    const logs = await db('audit_logs')
      .leftJoin('users', 'audit_logs.user_id', 'users.user_id')
      .select(
        'audit_logs.log_id as id',
        'users.full_name as performer',
        'audit_logs.action',
        'audit_logs.target_table as target',
        'audit_logs.details',
        'audit_logs.created_at as createdAt'
      )
      .orderBy('audit_logs.log_id', 'desc');
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

app.get('/api/reports', async (req, res) => {
  try {
    const popularBooks = await db('loans')
      .join('book_copies', 'loans.copy_id', 'book_copies.copy_id')
      .join('books', 'book_copies.book_id', 'books.book_id')
      .groupBy('books.book_id')
      .select('books.title', db.raw('COUNT(loans.loan_id) as loanCount'))
      .orderBy('loanCount', 'desc')
      .limit(5);

    const loansByStatus = await db('loans')
      .groupBy('status')
      .select('status', db.raw('COUNT(loan_id) as count'));

    res.json({ popularBooks, loansByStatus });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});