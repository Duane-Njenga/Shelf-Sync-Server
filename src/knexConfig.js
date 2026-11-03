import dotenv from 'dotenv';
dotenv.config();

export const knexConfig = {
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'shelfsync_db',
    charset: 'utf8mb4'
  },
  pool: { min: 2, max: 10 }
};
