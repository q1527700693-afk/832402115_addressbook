import { createApp } from './app.js';

const port = Number(process.env.PORT || 3000);
const { app, db } = createApp();

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`[addressbook] listening on http://127.0.0.1:${port}`);
});

function shutdown(signal) {
  console.log(`[addressbook] ${signal} received, shutting down`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
