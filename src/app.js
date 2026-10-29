import express from 'express';
import helmet from 'helmet';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { loadUser } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { originCheck } from './middleware/originCheck.js';
import routes from './routes.js';
import { createSessionStore, SESSION_MAX_AGE_MS } from './sessionStore.js';

export function createApp() {
  const app = express();
  const { store, close } = createSessionStore();

  app.set('trust proxy', config.trustProxy);
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));

  app.use(
    session({
      name: 'shelfsync.sid',
      secret: config.sessionSecret,
      store,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true, 
        sameSite: 'lax',
        secure: config.isProd, 
        maxAge: SESSION_MAX_AGE_MS,
      },
    }),
  );

  app.use(
    '/api',
    rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: 'draft-7', legacyHeaders: false }),
    originCheck,
    loadUser,
    routes,
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, closeSessionStore: close };
}
