CREATE TABLE roles (
  role_id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB;

INSERT INTO roles (role_id, role_name) VALUES
  (1, 'Member'),
  (2, 'Librarian'),
  (3, 'Admin');

CREATE TABLE users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  membership_no VARCHAR(20) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role_id INT NOT NULL DEFAULT 1,
  status ENUM('Active', 'Suspended', 'Inactive') NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_users_membership_no UNIQUE (membership_no),
  CONSTRAINT uq_users_email UNIQUE (email),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE RESTRICT
) ENGINE=InnoDB;


CREATE TABLE categories (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  category_name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE authors (
  author_id INT AUTO_INCREMENT PRIMARY KEY,
  author_name VARCHAR(120) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE books (
  book_id INT AUTO_INCREMENT PRIMARY KEY,
  isbn VARCHAR(20) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  publisher VARCHAR(120),
  year_published INT,
  category_id INT,
  shelf_location VARCHAR(50),
  description TEXT,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_books_category FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE book_authors (
  book_id INT NOT NULL,
  author_id INT NOT NULL,
  PRIMARY KEY (book_id, author_id),
  CONSTRAINT fk_ba_book FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE,
  CONSTRAINT fk_ba_author FOREIGN KEY (author_id) REFERENCES authors(author_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE book_copies (
  copy_id INT AUTO_INCREMENT PRIMARY KEY,
  book_id INT NOT NULL,
  barcode VARCHAR(50) NOT NULL UNIQUE,
  status ENUM('Available', 'On Loan', 'Reserved', 'Damaged', 'Lost') NOT NULL DEFAULT 'Available',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_copies_book FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE loans (
  loan_id INT AUTO_INCREMENT PRIMARY KEY,
  copy_id INT NOT NULL,
  user_id INT NOT NULL,
  issued_by INT NOT NULL,
  issue_date DATE NULL,
  due_date DATE NULL,
  return_date DATETIME NULL,
  status ENUM('Pending', 'Active', 'Returned', 'Overdue', 'Rejected') NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_loans_copy FOREIGN KEY (copy_id) REFERENCES book_copies(copy_id) ON DELETE RESTRICT,
  CONSTRAINT fk_loans_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
  CONSTRAINT fk_loans_issuer FOREIGN KEY (issued_by) REFERENCES users(user_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE reservations (
  reservation_id INT AUTO_INCREMENT PRIMARY KEY,
  book_id INT NOT NULL,
  user_id INT NOT NULL,
  reserved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('Pending', 'Ready', 'Fulfilled', 'Cancelled', 'Rejected') NOT NULL DEFAULT 'Pending',
  CONSTRAINT fk_res_book FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE,
  CONSTRAINT fk_res_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;


CREATE TABLE fines (
  fine_id INT AUTO_INCREMENT PRIMARY KEY,
  loan_id INT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  days_overdue INT NOT NULL DEFAULT 0,
  status ENUM('Unpaid', 'Paid', 'Waived') NOT NULL DEFAULT 'Unpaid',
  issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fines_loan FOREIGN KEY (loan_id) REFERENCES loans(loan_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE payments (
  payment_id INT AUTO_INCREMENT PRIMARY KEY,
  fine_id INT NOT NULL,
  amount_paid DECIMAL(10, 2) NOT NULL,
  payment_method ENUM('M-Pesa', 'Cash', 'Card') NOT NULL DEFAULT 'M-Pesa',
  phone_number VARCHAR(20) NULL,
  mpesa_receipt_no VARCHAR(50) NULL UNIQUE,
  checkout_request_id VARCHAR(100) NULL,
  status ENUM('Pending', 'Completed', 'Failed') NOT NULL DEFAULT 'Pending',
  paid_at DATETIME NULL,
  CONSTRAINT fk_payments_fine FOREIGN KEY (fine_id) REFERENCES fines(fine_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(100) NOT NULL,
  table_affected VARCHAR(50) NULL,
  target_table VARCHAR(50) NULL,
  record_id INT NULL,
  ip_address VARCHAR(45) NULL,
  details TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE sessions (
  session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL PRIMARY KEY,
  expires INT(11) UNSIGNED NOT NULL,
  data MEDIUMTEXT COLLATE utf8mb4_bin
) ENGINE=InnoDB;