import { config } from './config.js';
import { db } from './db.js';
import { createApp } from './app.js';

const { app, closeSessionStore } = createApp();

const server = app.listen(config.port, () => {
  console.log(`ShelfSync API listening on port ${config.port} (${config.env})`);
});

async function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await Promise.allSettled([db.destroy(), closeSessionStore()]);
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => console.error('Unhandled rejection', reason));
