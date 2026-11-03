import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

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

    if (category_id) query = query.andWhere('books.category_id', category_id);

    const books = await query;
    res.json(books);
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  }
});

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

export default router;