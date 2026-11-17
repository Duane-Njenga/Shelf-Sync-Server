import { Router } from 'express';
import { db } from '../db.js';
import { logAudit } from '../utils/audit.js';

const router = Router();

// GET /api/books - Aiven MySQL 8 strict-mode safe query
router.get('/', async (req, res) => {
  try {
    const books = await db('books')
      .leftJoin('categories', 'books.category_id', 'categories.category_id')
      .whereNull('books.deleted_at')
      .select(
        'books.book_id as id',
        'books.isbn',
        'books.title',
        'books.publisher',
        'books.year_published as yearPublished',
        'books.shelf_location as shelfLocation',
        'books.description',
        'books.category_id as categoryId',
        'categories.category_name as category',
        db.raw(`(
          SELECT GROUP_CONCAT(a.author_name SEPARATOR ', ')
          FROM book_authors ba
          JOIN authors a ON ba.author_id = a.author_id
          WHERE ba.book_id = books.book_id
        ) as authors`),
        db.raw(`(
          SELECT COUNT(*)
          FROM book_copies bc
          WHERE bc.book_id = books.book_id
        ) as totalCopies`),
        db.raw(`(
          SELECT COUNT(*)
          FROM book_copies bc
          WHERE bc.book_id = books.book_id AND bc.status = 'Available'
        ) as availableCopies`)
      )
      .orderBy('books.book_id', 'desc');

    const formatted = books.map((b) => ({
      ...b,
      authors: b.authors || 'Unknown Author',
      totalCopies: Number(b.totalCopies || 0),
      availableCopies: Number(b.availableCopies || 0),
    }));

    res.json(formatted);
  } catch (err) {
    console.error('GET /api/books error:', err);
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

// POST /api/books - Add new book + author + initial copies
router.post('/', async (req, res) => {
  const { isbn, title, author, publisher, yearPublished, categoryId, shelfLocation, description, copies = 1 } = req.body;

  if (!isbn || !title) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'ISBN and Title are required' } });
  }

  try {
    const [bookId] = await db('books').insert({
      isbn,
      title,
      publisher: publisher || null,
      year_published: yearPublished ? Number(yearPublished) : null,
      category_id: categoryId ? Number(categoryId) : null,
      shelf_location: shelfLocation || null,
      description: description || null,
    });

    if (author) {
      let existingAuthor = await db('authors').where({ author_name: author }).first();
      let authorId = existingAuthor?.author_id;
      if (!authorId) {
        const [newAuthorId] = await db('authors').insert({ author_name: author });
        authorId = newAuthorId;
      }
      await db('book_authors').insert({ book_id: bookId, author_id: authorId });
    }

    const copyCount = Math.max(1, Number(copies) || 1);
    for (let i = 1; i <= copyCount; i++) {
      await db('book_copies').insert({
        book_id: bookId,
        barcode: `BK-${bookId}-${Date.now().toString().slice(-4)}-${i}`,
        status: 'Available',
      });
    }

    await logAudit({
      userId: req.session?.userId || null,
      action: 'BOOK_ADDED',
      tableAffected: 'books',
      recordId: bookId,
      ipAddress: req.ip,
      details: `Added "${title}" with ${copyCount} copies`,
    });

    res.status(201).json({ success: true, id: bookId });
  } catch (err) {
    console.error('POST /api/books error:', err);
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

// PATCH /api/books/:id/copies - Add or remove physical copies
router.patch('/:id/copies', async (req, res) => {
  const bookId = req.params.id;
  const { delta } = req.body; // e.g., +1 or -1

  try {
    const change = Number(delta);
    if (change > 0) {
      for (let i = 0; i < change; i++) {
        await db('book_copies').insert({
          book_id: bookId,
          barcode: `BK-${bookId}-${Date.now().toString().slice(-5)}-${i}`,
          status: 'Available',
        });
      }
    } else if (change < 0) {
      const toRemove = await db('book_copies')
        .where({ book_id: bookId, status: 'Available' })
        .limit(Math.abs(change));

      if (toRemove.length < Math.abs(change)) {
        return res.status(400).json({
          error: { code: 'CANNOT_REMOVE', message: 'Not enough available copies to remove' },
        });
      }

      const ids = toRemove.map((c) => c.copy_id);
      await db('book_copies').whereIn('copy_id', ids).delete();
    }

    await logAudit({
      userId: req.session?.userId || null,
      action: 'BOOK_COPIES_UPDATED',
      tableAffected: 'book_copies',
      recordId: Number(bookId),
      ipAddress: req.ip,
      details: `Adjusted copies for book #${bookId} by ${change}`,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('PATCH /api/books/:id/copies error:', err);
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

// DELETE /api/books/:id - Soft delete book
router.delete('/:id', async (req, res) => {
  const bookId = req.params.id;
  try {
    await db('books').where({ book_id: bookId }).update({ deleted_at: db.fn.now() });

    await logAudit({
      userId: req.session?.userId || null,
      action: 'BOOK_DELETED',
      tableAffected: 'books',
      recordId: Number(bookId),
      ipAddress: req.ip,
      details: `Soft-deleted book #${bookId}`,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/books/:id error:', err);
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

export default router;