import 'dotenv/config';
import { z } from 'zod';

const parsed = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    SESSION_SECRET: z.string().min(32, 'must be at least 32 characters'),
    ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
    TRUST_PROXY: z.coerce.number().int().min(0).optional(),
    APP_TIMEZONE: z.string().default('Africa/Nairobi'),
    BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12),

    DATABASE_URL: z.string().optional(),
    DB_HOST: z.string().default('127.0.0.1'),
    DB_PORT: z.coerce.number().int().positive().default(3306),
    DB_USER: z.string().default('shelfsync'),
    DB_PASSWORD: z.string().default(''),
    DB_NAME: z.string().default('shelfsync_db'),
    DB_SSL: z.enum(['true', 'false']).default('false'),
    DB_SSL_CA: z.string().optional(),
  })
  .safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
  console.error(`Invalid environment configuration:\n${problems.join('\n')}`);
  process.exit(1);
}

const env = parsed.data;
const isProd = env.NODE_ENV === 'production';

function databaseSettings() {
  const base = env.DATABASE_URL
    ? (() => {
        const url = new URL(env.DATABASE_URL);
        return {
          host: url.hostname,
          port: Number(url.port) || 3306,
          user: decodeURIComponent(url.username),
          password: decodeURIComponent(url.password),
          database: url.pathname.slice(1),
        };
      })()
    : {
        host: env.DB_HOST,
        port: env.DB_PORT,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        database: env.DB_NAME,
      };

  let ssl;
  if (env.DB_SSL_CA) {
    ssl = { ca: env.DB_SSL_CA.replace(/\\n/g, '\n'), minVersion: 'TLSv1.2' };
  } else if (env.DB_SSL === 'true') {
    ssl = { minVersion: 'TLSv1.2' };
  }

  return {
    ...base,
    ssl,
    charset: 'utf8mb4',
    dateStrings: true,
  };
}

export const config = {
  env: env.NODE_ENV,
  isProd,
  port: env.PORT,
  sessionSecret: env.SESSION_SECRET,
  allowedOrigins: env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
  trustProxy: env.TRUST_PROXY ?? (isProd ? 1 : 0),
  timezone: env.APP_TIMEZONE,
  bcryptCost: env.BCRYPT_COST,
  db: databaseSettings(),
};
