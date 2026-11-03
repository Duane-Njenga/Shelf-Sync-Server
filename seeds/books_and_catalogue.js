/**
 * @param { import("knex").Knex } knex
 */
export async function seed(knex) {
  await knex('fines').del();
  await knex('loans').del();
  await knex('reservations').del();
  await knex('book_copies').del();
  await knex('book_authors').del();
  await knex('books').del();
  await knex('authors').del();
  await knex('categories').del();

  await knex('categories').insert([
    { category_id: 1, category_name: 'Computer Science & Software' },
    { category_id: 2, category_name: 'Fiction & Literature' },
    { category_id: 3, category_name: 'Mathematics & Statistics' },
    { category_id: 4, category_name: 'Science & Physics' },
    { category_id: 5, category_name: 'History & Biography' },
    { category_id: 6, category_name: 'Business & Economics' },
  ]);

  await knex('authors').insert([
    { author_id: 1, author_name: 'Robert C. Martin' },
    { author_id: 2, author_name: 'George Orwell' },
    { author_id: 3, author_name: 'Gilbert Strang' },
    { author_id: 4, author_name: 'Andrew S. Tanenbaum' },
    { author_id: 5, author_name: 'Martin Fowler' },
    { author_id: 6, author_name: 'Harper Lee' },
    { author_id: 7, author_name: 'J.R.R. Tolkien' },
    { author_id: 8, author_name: 'Stephen Hawking' },
    { author_id: 9, author_name: 'Walter Isaacson' },
    { author_id: 10, author_name: 'Donald Knuth' },
    { author_id: 11, author_name: 'Thomas H. Cormen' },
    { author_id: 12, author_name: 'Charles Leiserson' },
    { author_id: 13, author_name: 'Ronald Rivest' },
    { author_id: 14, author_name: 'Clifford Stein' },
    { author_id: 15, author_name: 'Frank Herbert' },
  ]);

  await knex('books').insert([
    { book_id: 1, isbn: '9780132350884', title: 'Clean Code', publisher: 'Prentice Hall', year_published: 2008, category_id: 1, shelf_location: 'CS-01', description: 'A handbook of agile software craftsmanship.' },
    { book_id: 2, isbn: '9780451524935', title: '1984', publisher: 'Secker & Warburg', year_published: 1949, category_id: 2, shelf_location: 'FIC-01', description: 'A dystopian political fiction novel.' },
    { book_id: 3, isbn: '9780961408824', title: 'Introduction to Linear Algebra', publisher: 'Wellesley-Cambridge Press', year_published: 2016, category_id: 3, shelf_location: 'MATH-01', description: 'Comprehensive textbook on linear algebra.' },
    { book_id: 4, isbn: '9780133591620', title: 'Modern Operating Systems', publisher: 'Pearson', year_published: 2014, category_id: 1, shelf_location: 'CS-02', description: 'In-depth operating systems analysis.' },
    { book_id: 5, isbn: '9780201633610', title: 'Design Patterns', publisher: 'Addison-Wesley', year_published: 1994, category_id: 1, shelf_location: 'CS-03', description: 'Elements of reusable object-oriented software.' },
    { book_id: 6, isbn: '9780061120084', title: 'To Kill a Mockingbird', publisher: 'J.B. Lippincott', year_published: 1960, category_id: 2, shelf_location: 'FIC-02', description: 'Classic story of innocence and injustice.' },
    { book_id: 7, isbn: '9780547928227', title: 'The Hobbit', publisher: 'George Allen & Unwin', year_published: 1937, category_id: 2, shelf_location: 'FIC-03', description: 'Fantasy story of Bilbo Baggins.' },
    { book_id: 8, isbn: '9780553380163', title: 'A Brief History of Time', publisher: 'Bantam Books', year_published: 1988, category_id: 4, shelf_location: 'SCI-01', description: 'Exploration of cosmology and modern physics.' },
    { book_id: 9, isbn: '9781451648539', title: 'Steve Jobs', publisher: 'Simon & Schuster', year_published: 2011, category_id: 5, shelf_location: 'BIO-01', description: 'Exclusive biography of Steve Jobs.' },
    { book_id: 10, isbn: '9780201896831', title: 'The Art of Computer Programming, Vol 1', publisher: 'Addison-Wesley', year_published: 1997, category_id: 1, shelf_location: 'CS-04', description: 'Fundamental algorithms and computing theory.' },
    { book_id: 11, isbn: '9780262033848', title: 'Introduction to Algorithms (CLRS)', publisher: 'MIT Press', year_published: 2009, category_id: 1, shelf_location: 'CS-05', description: 'The comprehensive guide to algorithms.' },
    { book_id: 12, isbn: '9780441172719', title: 'Dune', publisher: 'Chilton Books', year_published: 1965, category_id: 2, shelf_location: 'FIC-04', description: 'Science fiction epic set on Arrakis.' },
    { book_id: 13, isbn: '9780134494166', title: 'Clean Architecture', publisher: 'Prentice Hall', year_published: 2017, category_id: 1, shelf_location: 'CS-06', description: 'A craftsman guide to software structure.' },
    { book_id: 14, isbn: '9780321127426', title: 'Patterns of Enterprise Application Architecture', publisher: 'Addison-Wesley', year_published: 2002, category_id: 1, shelf_location: 'CS-07', description: 'Enterprise software development patterns.' },
    { book_id: 15, isbn: '9780345391803', title: 'The Hitchhiker Guide to the Galaxy', publisher: 'Pan Books', year_published: 1979, category_id: 2, shelf_location: 'FIC-05', description: 'Humorous science fiction comedy.' },
    { book_id: 16, isbn: '9781501142971', title: 'Leonardo da Vinci', publisher: 'Simon & Schuster', year_published: 2017, category_id: 5, shelf_location: 'BIO-02', description: 'Biography of Leonardo da Vinci.' },
  ]);

  await knex('book_authors').insert([
    { book_id: 1, author_id: 1 },
    { book_id: 2, author_id: 2 },
    { book_id: 3, author_id: 3 },
    { book_id: 4, author_id: 4 },
    { book_id: 5, author_id: 1 },
    { book_id: 6, author_id: 6 },
    { book_id: 7, author_id: 7 },
    { book_id: 8, author_id: 8 },
    { book_id: 9, author_id: 9 },
    { book_id: 10, author_id: 10 },
    { book_id: 11, author_id: 11 },
    { book_id: 11, author_id: 12 },
    { book_id: 11, author_id: 13 },
    { book_id: 11, author_id: 14 },
    { book_id: 12, author_id: 15 },
    { book_id: 13, author_id: 1 },
    { book_id: 14, author_id: 5 },
    { book_id: 16, author_id: 9 },
  ]);

  await knex('book_copies').insert([
    { copy_id: 1, book_id: 1, barcode: 'BC-001-A', status: 'Available' },
    { copy_id: 2, book_id: 1, barcode: 'BC-001-B', status: 'On Loan' },
    { copy_id: 3, book_id: 2, barcode: 'BC-002-A', status: 'Available' },
    { copy_id: 4, book_id: 3, barcode: 'BC-003-A', status: 'Available' },
    { copy_id: 5, book_id: 3, barcode: 'BC-003-B', status: 'Reserved' },
    { copy_id: 6, book_id: 4, barcode: 'BC-004-A', status: 'Available' },
    { copy_id: 7, book_id: 5, barcode: 'BC-005-A', status: 'On Loan' },
    { copy_id: 8, book_id: 6, barcode: 'BC-006-A', status: 'Available' },
    { copy_id: 9, book_id: 7, barcode: 'BC-007-A', status: 'Available' },
    { copy_id: 10, book_id: 8, barcode: 'BC-008-A', status: 'Available' },
    { copy_id: 11, book_id: 9, barcode: 'BC-009-A', status: 'On Loan' },
    { copy_id: 12, book_id: 10, barcode: 'BC-010-A', status: 'Available' },
    { copy_id: 13, book_id: 11, barcode: 'BC-011-A', status: 'Available' },
    { copy_id: 14, book_id: 12, barcode: 'BC-012-A', status: 'Available' },
    { copy_id: 15, book_id: 13, barcode: 'BC-013-A', status: 'Available' },
    { copy_id: 16, book_id: 14, barcode: 'BC-014-A', status: 'Available' },
    { copy_id: 17, book_id: 15, barcode: 'BC-015-A', status: 'Available' },
    { copy_id: 18, book_id: 16, barcode: 'BC-016-A', status: 'Available' },
  ]);

  await knex('loans').insert([
    { loan_id: 1, copy_id: 2, user_id: 3, issued_by: 2, issue_date: '2026-10-01', due_date: '2026-10-15', return_date: null, status: 'Active' },
    { loan_id: 2, copy_id: 7, user_id: 4, issued_by: 2, issue_date: '2026-09-10', due_date: '2026-09-24', return_date: null, status: 'Active' },
    { loan_id: 3, copy_id: 11, user_id: 5, issued_by: 2, issue_date: '2026-10-20', due_date: '2026-11-03', return_date: null, status: 'Active' },
  ]);

  await knex('reservations').insert([
    { reservation_id: 1, book_id: 3, user_id: 3, reserved_at: '2026-10-25 10:00:00', status: 'Ready' },
    { reservation_id: 2, book_id: 11, user_id: 4, reserved_at: '2026-10-28 14:30:00', status: 'Pending' },
  ]);

  await knex('fines').insert([
    { fine_id: 1, loan_id: 2, amount: 200.00, days_overdue: 20, status: 'Unpaid', issued_at: '2026-09-25 08:00:00' },
  ]);

  console.log('✅ Books, categories, copies, loans, reservations, and fines seeded.');
}