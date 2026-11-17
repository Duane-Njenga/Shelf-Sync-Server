import dotenv from 'dotenv';
import knex from 'knex';

dotenv.config();

export const db = knex({
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'shelfsync_db',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  },
  pool: { min: 2, max: 10 },
});