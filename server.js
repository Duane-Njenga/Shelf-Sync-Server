import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import MySQLStore from 'express-mysql-session';
import { db } from './src/db.js';
import { logAudit } from './src/utils/audit.js';

import authRouter from './src/routes/auth_routes.js';
import booksRouter from './src/routes/books_routes.js';
import mpesaRouter from './src/routes/mpesa_routes.js';

dotenv.config();

const app = express();
const isProd = process.env.NODE_ENV === 'production';

if (isProd) {
  app.set('trust proxy', 1);
}

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  })
);

app.use(express.json());

const MySQLStoreSession = MySQLStore(session);
const sessionStore = new MySQLStoreSession({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'shelfsync_db',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
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
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRouter);
app.use('/api/books', booksRouter);
app.use('/api/mpesa', mpesaRouter);

app.get('/api/categories', async (req, res) => {
  try {
    const categories = await db('categories').select('*').orderBy('category_name');
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

// Member My Account Endpoint (Loans, Reservations, & Fines)
app.get('/api/my-account', async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not logged in' } });
  }

  try {
    const loans = await db('loans')
      .leftJoin('book_copies', 'loans.copy_id', 'book_copies.copy_id')
      .leftJoin('books', 'book_copies.book_id', 'books.book_id')
      .leftJoin('fines', 'loans.loan_id', 'fines.loan_id')
      .where('loans.user_id', userId)
      .select(
        'loans.loan_id as id',
        'books.title',
        'books.isbn',
        'book_copies.barcode',
        'loans.issue_date as issueDate',
        'loans.due_date as dueDate',
        'loans.return_date as returnDate',
        'loans.status',
        'fines.amount as fineAmount',
        'fines.status as fineStatus'
      )
      .orderBy('loans.loan_id', 'desc');

    const reservations = await db('reservations')
      .join('books', 'reservations.book_id', 'books.book_id')
      .where('reservations.user_id', userId)
      .select(
        'reservations.reservation_id as id',
        'books.title',
        'books.isbn',
        'reservations.reserved_at as reservedAt',
        'reservations.status'
      )
      .orderBy('reservations.reservation_id', 'desc');

    res.json({ loans, reservations });
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

// Active & Pending Loans List
app.get('/api/loans', async (req, res) => {
  try {
    const loans = await db('loans')
      .leftJoin('book_copies', 'loans.copy_id', 'book_copies.copy_id')
      .leftJoin('books', 'book_copies.book_id', 'books.book_id')
      .join('users', 'loans.user_id', 'users.user_id')
      .select(
        'loans.loan_id as id',
        'books.title',
        'book_copies.barcode',
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

// Return Book Endpoint (automatically creates an Unpaid fine of KES 10/day if overdue)
app.patch('/api/loans/:id/return', async (req, res) => {
  const loanId = req.params.id;
  try {
    const loan = await db('loans').where({ loan_id: loanId }).first();
    if (!loan) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Loan record not found' } });

    await db('loans').where({ loan_id: loanId }).update({
      status: 'Returned',
      return_date: db.fn.now(),
    });

    if (loan.copy_id) {
      await db('book_copies').where({ copy_id: loan.copy_id }).update({ status: 'Available' });
    }

    if (loan.due_date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const due = new Date(loan.due_date);
      due.setHours(0, 0, 0, 0);
      const daysOverdue = Math.floor((today - due) / (1000 * 60 * 60 * 24));

      if (daysOverdue > 0) {
        const existingFine = await db('fines').where({ loan_id: loanId }).first();
        if (!existingFine) {
          await db('fines').insert({
            loan_id: loanId,
            amount: daysOverdue * 10,
            days_overdue: daysOverdue,
            status: 'Unpaid',
          });
        }
      }
    }

    await logAudit({
      userId: req.session.userId,
      action: 'BOOK_RETURNED',
      tableAffected: 'loans',
      recordId: Number(loanId),
      ipAddress: req.ip,
      details: `Loan #${loanId} marked as returned`,
    });

    res.json({ success: true, message: 'Book marked as returned' });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

// Approve or Reject Pending Borrow Requests
app.patch('/api/loans/:id/status', async (req, res) => {
  const loanId = req.params.id;
  const { status } = req.body;

  try {
    const loan = await db('loans').where({ loan_id: loanId }).first();
    if (!loan) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Loan not found' } });

    if (status === 'Active') {
      const issueDate = new Date();
      const dueDate = new Date();
      dueDate.setDate(issueDate.getDate() + 14);

      await db('loans').where({ loan_id: loanId }).update({
        status: 'Active',
        issued_by: req.session.userId || loan.issued_by,
        issue_date: issueDate,
        due_date: dueDate,
      });

      await logAudit({
        userId: req.session.userId,
        action: 'LOAN_APPROVED',
        tableAffected: 'loans',
        recordId: Number(loanId),
        ipAddress: req.ip,
        details: `Approved loan #${loanId}`,
      });
    } else {
      await db('loans').where({ loan_id: loanId }).update({ status: 'Rejected' });
      if (loan.copy_id) {
        await db('book_copies').where({ copy_id: loan.copy_id }).update({ status: 'Available' });
      }

      await logAudit({
        userId: req.session.userId,
        action: 'LOAN_REJECTED',
        tableAffected: 'loans',
        recordId: Number(loanId),
        ipAddress: req.ip,
        details: `Rejected loan #${loanId}`,
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

// Member Borrow/Rent Request Endpoint
app.post('/api/loans/request', async (req, res) => {
  const { bookId } = req.body;
  const userId = req.session.userId;

  if (!userId) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Log in to borrow books' } });

  try {
    const availableCopy = await db('book_copies')
      .where({ book_id: bookId, status: 'Available' })
      .first();

    if (!availableCopy) {
      return res.status(400).json({ error: { code: 'UNAVAILABLE', message: 'No available physical copies to borrow' } });
    }

    await db('book_copies').where({ copy_id: availableCopy.copy_id }).update({ status: 'On Loan' });

    const [loanId] = await db('loans').insert({
      copy_id: availableCopy.copy_id,
      user_id: userId,
      issued_by: userId,
      status: 'Pending',
    });

    await logAudit({
      userId,
      action: 'LOAN_REQUESTED',
      tableAffected: 'loans',
      recordId: loanId,
      ipAddress: req.ip,
      details: `Requested borrow for book #${bookId}`,
    });

    res.json({ success: true, message: 'Borrow request submitted for admin approval' });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

// Member Reservation Endpoint
app.post('/api/reservations/request', async (req, res) => {
  const { bookId } = req.body;
  const userId = req.session.userId;

  if (!userId) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Log in to reserve books' } });

  try {
    const [resId] = await db('reservations').insert({
      book_id: bookId,
      user_id: userId,
      reserved_at: db.fn.now(),
      status: 'Pending',
    });

    await logAudit({
      userId,
      action: 'RESERVATION_REQUESTED',
      tableAffected: 'reservations',
      recordId: resId,
      ipAddress: req.ip,
      details: `Reserved book #${bookId}`,
    });

    res.json({ success: true, message: 'Reservation request submitted' });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

// Reservations List
app.get('/api/reservations', async (req, res) => {
  try {
    const reservations = await db('reservations')
      .join('books', 'reservations.book_id', 'books.book_id')
      .join('users', 'reservations.user_id', 'users.user_id')
      .select(
        'reservations.reservation_id as id',
        'reservations.book_id as bookId',
        'books.title',
        'users.full_name as memberName',
        'users.membership_no as membershipNo',
        'reservations.reserved_at as reservedAt',
        'reservations.status'
      )
      .orderBy('reservations.reservation_id', 'desc');
    res.json(reservations);
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

// Approve, Reject, or Cancel Reservation
app.patch('/api/reservations/:id/status', async (req, res) => {
  const { status } = req.body;
  const resId = req.params.id;

  try {
    const reservation = await db('reservations').where({ reservation_id: resId }).first();
    if (!reservation) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Reservation not found' } });
    }

    if (status === 'Ready') {
      const availableCopy = await db('book_copies')
        .where({ book_id: reservation.book_id, status: 'Available' })
        .first();

      if (!availableCopy) {
        return res.status(400).json({
          error: { code: 'NO_COPY', message: 'No available physical copy to hold for pickup yet' },
        });
      }

      await db('book_copies').where({ copy_id: availableCopy.copy_id }).update({ status: 'Reserved' });
    } else if ((status === 'Cancelled' || status === 'Rejected') && reservation.status === 'Ready') {
      const reservedCopy = await db('book_copies')
        .where({ book_id: reservation.book_id, status: 'Reserved' })
        .first();

      if (reservedCopy) {
        await db('book_copies').where({ copy_id: reservedCopy.copy_id }).update({ status: 'Available' });
      }
    }

    await db('reservations').where({ reservation_id: resId }).update({ status });

    await logAudit({
      userId: req.session.userId,
      action: `RESERVATION_${status.toUpperCase()}`,
      tableAffected: 'reservations',
      recordId: Number(resId),
      ipAddress: req.ip,
      details: `Updated reservation #${resId} to ${status}`,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

// Fulfill Reservation -> Issue Book to Member as Active Loan
app.post('/api/reservations/:id/fulfill', async (req, res) => {
  const resId = req.params.id;
  const staffId = req.session.userId;

  try {
    const reservation = await db('reservations').where({ reservation_id: resId }).first();
    if (!reservation) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Reservation not found' } });
    }

    let copy = await db('book_copies')
      .where({ book_id: reservation.book_id, status: 'Reserved' })
      .first();

    if (!copy) {
      copy = await db('book_copies')
        .where({ book_id: reservation.book_id, status: 'Available' })
        .first();
    }

    if (!copy) {
      return res.status(400).json({
        error: { code: 'UNAVAILABLE', message: 'No physical copy available to issue' },
      });
    }

    const issueDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(issueDate.getDate() + 14);

    await db('book_copies').where({ copy_id: copy.copy_id }).update({ status: 'On Loan' });

    const [loanId] = await db('loans').insert({
      copy_id: copy.copy_id,
      user_id: reservation.user_id,
      issued_by: staffId || reservation.user_id,
      issue_date: issueDate,
      due_date: dueDate,
      status: 'Active',
    });

    await db('reservations').where({ reservation_id: resId }).update({ status: 'Fulfilled' });

    await logAudit({
      userId: staffId,
      action: 'RESERVATION_FULFILLED',
      tableAffected: 'reservations',
      recordId: Number(resId),
      ipAddress: req.ip,
      details: `Fulfilled reservation #${resId} into Loan #${loanId}`,
    });

    res.json({ success: true, message: 'Book issued to member and reservation fulfilled' });
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
      )
      .orderBy('fines.fine_id', 'desc');
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

// ONLY Admins can change user roles
app.patch('/api/users/:id/role', async (req, res) => {
  try {
    const currentUserId = req.session.userId;
    if (!currentUserId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not logged in' } });
    }

    const currentUser = await db('users')
      .join('roles', 'users.role_id', 'roles.role_id')
      .where('users.user_id', currentUserId)
      .select('roles.role_name as roleName')
      .first();

    if (!currentUser || currentUser.roleName !== 'Admin') {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Only Admins are permitted to change user roles.' },
      });
    }

    const { roleId } = req.body;
    await db('users').where({ user_id: req.params.id }).update({ role_id: roleId });

    await logAudit({
      userId: currentUserId,
      action: 'ROLE_UPDATED',
      tableAffected: 'users',
      recordId: Number(req.params.id),
      ipAddress: req.ip,
      details: `Updated user #${req.params.id} role to roleId #${roleId}`,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

// Dynamic column mapping for Aiven MySQL compatibility
app.get('/api/audit-logs', async (req, res) => {
  try {
    const logs = await db('audit_logs')
      .leftJoin('users', 'audit_logs.user_id', 'users.user_id')
      .select('audit_logs.*', 'users.full_name as performer')
      .orderBy('audit_logs.log_id', 'desc');

    const formatted = logs.map((l) => ({
      id: l.log_id ?? l.id,
      performer: l.performer || 'System',
      action: l.action || 'UNKNOWN',
      target: l.table_affected || l.target_table || 'N/A',
      details: l.details || (l.record_id ? `Record ID: ${l.record_id}` : 'N/A'),
      createdAt: l.created_at || l.timestamp || null,
    }));

    res.json(formatted);
  } catch (err) {
    console.error('GET /api/audit-logs error:', err);
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

app.get('/api/reports', async (req, res) => {
  try {
    const popularBooks = await db('loans')
      .join('book_copies', 'loans.copy_id', 'book_copies.copy_id')
      .join('books', 'book_copies.book_id', 'books.book_id')
      .groupBy('books.book_id', 'books.title')
      .select('books.title', db.raw('COUNT(loans.loan_id) as loanCount'))
      .orderBy('loanCount', 'desc')
      .limit(5);

    const loansByStatus = await db('loans')
      .groupBy('status')
      .select('status', db.raw('COUNT(loan_id) as count'));

    res.json({ popularBooks, loansByStatus });
  } catch (err) {
    console.error('GET /api/reports error:', err);
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});