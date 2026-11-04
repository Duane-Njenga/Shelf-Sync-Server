import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

// GET /api/books (Supports search & category filtering)
router.get('/', async (req, res) => {
  try {
    const { search, category_id } = req.query;

    let query = db('books')
      .leftJoin('categories', 'books.category_id', 'categories.category_id')
      .leftJoin('book_authors', 'books.book_id', 'book_authors.book_id')
      .leftJoin('authors', 'book_authors.author_id', 'authors.author_id')
      .leftJoin('book_copies', 'books.book_id', 'book_copies.book_id')
      .whereNull('books.deleted_at')
      .groupBy('books.book_id')
      .select(
        'books.book_id as id',
        'books.isbn',
        'books.title',
        'books.publisher',
        'books.year_published as yearPublished',
        'books.shelf_location as shelfLocation',
        'books.description',
        'categories.category_name as category',
        db.raw('GROUP_CONCAT(DISTINCT authors.author_name SEPARATOR ", ") as authors'),
        db.raw('COUNT(DISTINCT book_copies.copy_id) as totalCopies'),
        db.raw('COUNT(DISTINCT CASE WHEN book_copies.status = "Available" THEN book_copies.copy_id END) as availableCopies')
      );

    if (search) {
      query = query.andWhere((builder) => {
        builder
          .where('books.title', 'like', `%${search}%`)
          .orWhere('books.isbn', 'like', `%${search}%`)
          .orWhere('authors.author_name', 'like', `%${search}%`);
      });
    }

    if (category_id) {
      query = query.andWhere('books.category_id', category_id);
    }

    const books = await query;
    res.json(books);
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

// GET /api/books/:id
router.get('/:id', async (req, res) => {
  try {
    const book = await db('books')
      .leftJoin('categories', 'books.category_id', 'categories.category_id')
      .leftJoin('book_authors', 'books.book_id', 'book_authors.book_id')
      .leftJoin('authors', 'book_authors.author_id', 'authors.author_id')
      .leftJoin('book_copies', 'books.book_id', 'book_copies.book_id')
      .where('books.book_id', req.params.id)
      .whereNull('books.deleted_at')
      .groupBy('books.book_id')
      .select(
        'books.book_id as id',
        'books.isbn',
        'books.title',
        'books.publisher',
        'books.year_published as yearPublished',
        'books.shelf_location as shelfLocation',
        'books.description',
        'categories.category_name as category',
        db.raw('GROUP_CONCAT(DISTINCT authors.author_name SEPARATOR ", ") as authors'),
        db.raw('COUNT(DISTINCT book_copies.copy_id) as totalCopies'),
        db.raw('COUNT(DISTINCT CASE WHEN book_copies.status = "Available" THEN book_copies.copy_id END) as availableCopies')
      )
      .first();

    if (!book) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Book not found' } });

    const copies = await db('book_copies').where({ book_id: req.params.id });
    res.json({ ...book, copies });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

// PATCH /api/books/:id/copies (Adjust physical copy count)
router.patch('/:id/copies', async (req, res) => {
  const { copyCount } = req.body;
  const bookId = req.params.id;

  if (copyCount === undefined || copyCount < 0) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Valid copy count required' } });
  }

  try {
    const currentCopies = await db('book_copies').where({ book_id: bookId });
    const currentCount = currentCopies.length;

    if (copyCount > currentCount) {
      // Add missing copies
      const newCopies = [];
      for (let i = currentCount + 1; i <= copyCount; i++) {
        newCopies.push({
          book_id: bookId,
          barcode: `BC-${String(bookId).padStart(3, '0')}-${String(i).padStart(2, '0')}`,
          status: 'Available',
        });
      }
      await db('book_copies').insert(newCopies);
    } else if (copyCount < currentCount) {
      // Delete excess available copies
      const removeCount = currentCount - copyCount;
      const availableCopiesToRemove = currentCopies
        .filter((c) => c.status === 'Available')
        .slice(0, removeCount)
        .map((c) => c.copy_id);

      if (availableCopiesToRemove.length > 0) {
        await db('book_copies').whereIn('copy_id', availableCopiesToRemove).del();
      }
    }

    res.json({ success: true, message: 'Copy count updated successfully' });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

export default router;