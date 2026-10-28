require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();

// 1. MIDDLEWARE
// Allows your Vercel frontend to talk to this backend
app.use(cors({
    origin: '*', // For development. Replace with your actual Vercel URL later for security
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json()); // Parses incoming JSON request bodies

// 2. DATABASE CONNECTION POOL
// Connects automatically using the string from Aiven
const pool = mysql.createPool({
    uri: process.env.DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test database connection on startup
(async () => {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Connected to Aiven MySQL database successfully.');
        connection.release();
    } catch (err) {
        console.error('❌ Database connection failed:', err.message);
    }
})();

// 3. API ROUTES (Library Management System)

// Health Check Route
app.get('/', (req, res) => {
    res.json({ status: "Library API is online and working!" });
});

// GET all books
app.get('/api/books', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM books ORDER BY id DESC');
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to retrieve books' });
    }
});

// GET a single book by ID
app.get('/api/books/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query('SELECT * FROM books WHERE id = ?', [id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Book not found' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to retrieve book' });
    }
});

// POST a new book
app.post('/api/books', async (req, res) => {
    try {
        const { title, author, isbn, available_copies } = req.body;
        
        // Basic validation
        if (!title || !author) {
            return res.status(404).json({ error: 'Title and Author are required fields' });
        }

        const query = 'INSERT INTO books (title, author, isbn, available_copies) VALUES (?, ?, ?, ?)';
        const [result] = await pool.query(query, [title, author, isbn || null, available_copies || 1]);
        
        res.status(201).json({ 
            message: 'Book added successfully', 
            bookId: result.insertId 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create book record' });
    }
});

// PUT (Update) a book
app.put('/api/books/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, author, isbn, available_copies } = req.body;
        
        const query = 'UPDATE books SET title = ?, author = ?, isbn = ?, available_copies = ? WHERE id = ?';
        const [result] = await pool.query(query, [title, author, isbn, available_copies, id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Book not found to update' });
        }
        res.json({ message: 'Book updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update book' });
    }
});

// DELETE a book
app.delete('/api/books/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query('DELETE FROM books WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Book not found to delete' });
        }
        res.json({ message: 'Book deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete book' });
    }
});

// 4. START SERVER
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
