import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { createDatabase, PROJECT_ROOT } from './db.js';
import { contactsRouter } from './routes/contacts.js';
import { excelRouter } from './routes/excel.js';

export function createApp({ dbPath, db = createDatabase(dbPath) } = {}) {
  const app = express();
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, service: 'shiguang-address-book', time: new Date().toISOString() });
  });

  app.use('/api', contactsRouter(db));
  app.use('/api', excelRouter(db));

  app.use('/api', (req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: '接口不存在' } });
  });

  app.use(express.static(path.join(PROJECT_ROOT, 'public'), {
    extensions: ['html'],
    maxAge: '1h',
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    },
  }));

  app.use((req, res) => {
    if (req.accepts('html')) {
      res.sendFile(path.join(PROJECT_ROOT, 'public', 'index.html'));
    } else {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: '资源不存在' } });
    }
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    let status = 500;
    let code = 'INTERNAL_ERROR';
    let message = '服务器内部错误';
    let details = undefined;

    if (error instanceof multer.MulterError) {
      status = 400;
      code = 'UPLOAD_ERROR';
      message = error.code === 'LIMIT_FILE_SIZE' ? '文件不能超过 8MB' : '文件上传失败';
    } else if (error.status && error.status < 500) {
      status = error.status;
      code = error.code || 'BAD_REQUEST';
      message = error.message;
      details = error.details;
    } else {
      console.error('[addressbook] unhandled error:', error);
    }

    res.status(status).json({ error: { code, message, details } });
  });

  return { app, db };
}
