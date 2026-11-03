import dotenv from 'dotenv';
import express from 'express';
import session from 'express-session';
import MySQLStore from 'express-mysql-session';
import { db } from './src/db.js';

import booksRouter from './src/routes/book_routes.js';

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
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 },
  })
);

// Health Check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/books', booksRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server listening on http://localhost:${PORT}`));