/**
 * @param { import("knex").Knex } knex
 */
export async function seed(knex) {
  await knex('payments').del();
  await knex('fines').del();
  await knex('loans').del();
  await knex('reservations').del();
  await knex('audit_logs').del();
  await knex('users').whereNot({ email: 'admin@shelfsync.com' }).del();

  const passHash = '$2a$10$7R40Z0v0Yg7r0wL/y1cK/O2fR1iLhN7G8D9.1b1B1b1B1b1B1b1B1'; // password123

  const memberRole = await knex('roles').where({ role_name: 'Member' }).first();
  const librarianRole = await knex('roles').where({ role_name: 'Librarian' }).first();

  await knex('users').insert([
    { user_id: 2, membership_no: 'MEM002', full_name: 'Jane Librarian', email: 'librarian@shelfsync.com', phone: '0722111222', password_hash: passHash, role_id: librarianRole.role_id, status: 'Active' },
    { user_id: 3, membership_no: 'MEM003', full_name: 'John Doe', email: 'john@example.com', phone: '0712345678', password_hash: passHash, role_id: memberRole.role_id, status: 'Active' },
    { user_id: 4, membership_no: 'MEM004', full_name: 'Alice Smith', email: 'alice@example.com', phone: '0798765432', password_hash: passHash, role_id: memberRole.role_id, status: 'Active' },
    { user_id: 5, membership_no: 'MEM005', full_name: 'Bob Johnson', email: 'bob@example.com', phone: '0755443322', password_hash: passHash, role_id: memberRole.role_id, status: 'Active' },
  ]);

  console.log('✅ Users and roles seeded.');
}