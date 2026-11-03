CREATE DATABASE IF NOT EXISTS shelfsync_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE shelfsync_db;

CREATE TABLE roles (
  role_id INT NOT NULL AUTO_INCREMENT,
  role_name VARCHAR(30) NOT NULL,
  description VARCHAR(150) NULL,
  PRIMARY KEY (role_id),
  UNIQUE KEY uq_roles_name (role_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  user_id INT NOT NULL AUTO_INCREMENT,
  membership_no VARCHAR(20) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  phone VARCHAR(15) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role_id INT NOT NULL,
  status ENUM('Active','Suspended','Inactive') NOT NULL DEFAULT 'Active',
  two_fa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  reset_token_hash VARCHAR(255) NULL,
  reset_expires DATETIME NULL,
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_membership_no (membership_no),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role_id),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE categories (
  category_id INT NOT NULL AUTO_INCREMENT,
  category_name VARCHAR(60) NOT NULL,
  PRIMARY KEY (category_id),
  UNIQUE KEY uq_categories_name (category_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE authors (
  author_id INT NOT NULL AUTO_INCREMENT,
  author_name VARCHAR(100) NOT NULL,
  PRIMARY KEY (author_id),
  KEY idx_authors_name (author_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE books (
  book_id INT NOT NULL AUTO_INCREMENT,
  isbn VARCHAR(20) NOT NULL,
  title VARCHAR(200) NOT NULL,
  publisher VARCHAR(100) NULL,
  year_published YEAR NULL,
  category_id INT NULL,
  shelf_location VARCHAR(30) NULL,
  description TEXT NULL,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (book_id),
  UNIQUE KEY uq_books_isbn (isbn),
  KEY idx_books_title (title),
  KEY idx_books_category (category_id),
  CONSTRAINT fk_books_category FOREIGN KEY (category_id) REFERENCES categories (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE book_authors (
  book_id INT NOT NULL,
  author_id INT NOT NULL,
  PRIMARY KEY (book_id, author_id),
  KEY idx_book_authors_author (author_id),
  CONSTRAINT fk_book_authors_book FOREIGN KEY (book_id) REFERENCES books (book_id) ON DELETE CASCADE,
  CONSTRAINT fk_book_authors_author FOREIGN KEY (author_id) REFERENCES authors (author_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE book_copies (
  copy_id INT NOT NULL AUTO_INCREMENT,
  book_id INT NOT NULL,
  barcode VARCHAR(30) NOT NULL,
  status ENUM('Available','On Loan','Reserved','Lost','Damaged') NOT NULL DEFAULT 'Available',
  PRIMARY KEY (copy_id),
  UNIQUE KEY uq_book_copies_barcode (barcode),
  KEY idx_book_copies_book_status (book_id, status),
  CONSTRAINT fk_book_copies_book FOREIGN KEY (book_id) REFERENCES books (book_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE loans (
  loan_id INT NOT NULL AUTO_INCREMENT,
  copy_id INT NOT NULL,
  user_id INT NOT NULL,
  issued_by INT NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  return_date DATE NULL,
  status ENUM('Active','Returned') NOT NULL DEFAULT 'Active',
  active_copy_id INT GENERATED ALWAYS AS (CASE WHEN status = 'Active' THEN copy_id ELSE NULL END) STORED,
  PRIMARY KEY (loan_id),
  UNIQUE KEY uq_loans_one_active_per_copy (active_copy_id),
  KEY idx_loans_copy (copy_id),
  KEY idx_loans_user_status (user_id, status),
  KEY idx_loans_status_due (status, due_date),
  KEY idx_loans_issued_by (issued_by),
  CONSTRAINT chk_loans_dates CHECK (due_date >= issue_date),
  CONSTRAINT fk_loans_copy FOREIGN KEY (copy_id) REFERENCES book_copies (copy_id),
  CONSTRAINT fk_loans_user FOREIGN KEY (user_id) REFERENCES users (user_id),
  CONSTRAINT fk_loans_issued_by FOREIGN KEY (issued_by) REFERENCES users (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reservations (
  reservation_id INT NOT NULL AUTO_INCREMENT,
  book_id INT NOT NULL,
  user_id INT NOT NULL,
  reserved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NULL,
  status ENUM('Pending','Ready','Collected','Cancelled','Expired') NOT NULL DEFAULT 'Pending',
  open_pair VARCHAR(30) GENERATED ALWAYS AS (
    CASE WHEN status IN ('Pending','Ready') THEN CONCAT(book_id, '-', user_id) ELSE NULL END
  ) STORED,
  PRIMARY KEY (reservation_id),
  UNIQUE KEY uq_reservations_one_open (open_pair),
  KEY idx_reservations_queue (book_id, status, reserved_at),
  KEY idx_reservations_user_status (user_id, status),
  CONSTRAINT fk_reservations_book FOREIGN KEY (book_id) REFERENCES books (book_id),
  CONSTRAINT fk_reservations_user FOREIGN KEY (user_id) REFERENCES users (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE fines (
  fine_id INT NOT NULL AUTO_INCREMENT,
  loan_id INT NOT NULL,
  amount DECIMAL(8,2) NOT NULL,
  days_overdue INT NOT NULL,
  status ENUM('Unpaid','Paid','Waived') NOT NULL DEFAULT 'Unpaid',
  issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (fine_id),
  UNIQUE KEY uq_fines_loan (loan_id),
  KEY idx_fines_status (status),
  CONSTRAINT chk_fines_amount CHECK (amount >= 0),
  CONSTRAINT fk_fines_loan FOREIGN KEY (loan_id) REFERENCES loans (loan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payments (
  payment_id INT NOT NULL AUTO_INCREMENT,
  fine_id INT NOT NULL,
  amount DECIMAL(8,2) NOT NULL,
  method ENUM('M-Pesa','Cash') NOT NULL,
  status ENUM('Pending','Success','Failed') NOT NULL DEFAULT 'Pending',
  phone VARCHAR(15) NULL,
  checkout_request_id VARCHAR(100) NULL,
  mpesa_receipt VARCHAR(20) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME NULL,
  PRIMARY KEY (payment_id),
  UNIQUE KEY uq_payments_checkout (checkout_request_id),
  UNIQUE KEY uq_payments_receipt (mpesa_receipt),
  KEY idx_payments_fine (fine_id),
  CONSTRAINT chk_payments_amount CHECK (amount > 0),
  CONSTRAINT fk_payments_fine FOREIGN KEY (fine_id) REFERENCES fines (fine_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_logs (
  log_id BIGINT NOT NULL AUTO_INCREMENT,
  user_id INT NULL,
  action VARCHAR(100) NOT NULL,
  table_affected VARCHAR(50) NULL,
  record_id INT NULL,
  ip_address VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (log_id),
  KEY idx_audit_user (user_id),
  KEY idx_audit_created (created_at),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE settings (
  setting_key VARCHAR(50) NOT NULL,
  setting_value VARCHAR(100) NOT NULL,
  description VARCHAR(150) NULL,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sessions (
  session_id VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  expires INT UNSIGNED NOT NULL,
  data MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  PRIMARY KEY (session_id)
) ENGINE=InnoDB;

INSERT INTO roles (role_name, description) VALUES
  ('Member', 'Searches the catalogue, reserves books, pays fines'),
  ('Librarian', 'Manages books, members, loans, returns and reports'),
  ('Admin', 'Librarian access plus users, roles and audit logs');

INSERT INTO settings (setting_key, setting_value, description) VALUES
  ('loan_days', '14', 'Loan period in days'),
  ('fine_per_day', '10', 'Fine per overdue day (KES)'),
  ('max_loans', '3', 'Maximum books a member can borrow at once'),
  ('reservation_hold_hours', '48', 'Hours a reserved book is held'),
  ('library_name', 'ShelfSync Library', 'Name shown on reports');
