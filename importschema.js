import fs from 'fs';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function importSchema() {
  const sql = fs.readFileSync('./database/schema.sql', 'utf8');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
    multipleStatements: true,
  });

  console.log('Connected to Aiven MySQL. Importing schema...');
  await connection.query(sql);
  console.log('✅ All tables created successfully!');
  await connection.end();
}

importSchema().catch((err) => {
  console.error('❌ Schema import failed:', err.message);
  process.exit(1);
});