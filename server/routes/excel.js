import express from 'express';
import multer from 'multer';
import { buildContactsWorkbook, buildTemplateWorkbook, parseContactsWorkbook } from '../excel.js';
import { requireUser } from '../auth.js';
import { importContacts, listContacts, ValidationError } from '../store.js';

const MAX_FILE_SIZE = 8 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter(req, file, callback) {
    if (!/\.(xlsx|xlsm)$/i.test(file.originalname)) {
      callback(new ValidationError('仅支持 .xlsx 文件，请先用 Excel 另存为 .xlsx 格式'));
      return;
    }
    callback(null, true);
  },
});

function contentDisposition(filename) {
  return `attachment; filename="contacts.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function handle(fn) {
  return (req, res, next) => {
    try {
      const result = fn(req, res);
      if (result && typeof result.catch === 'function') result.catch(next);
    } catch (error) {
      next(error);
    }
  };
}

export function excelRouter(db) {
  const router = express.Router();

  router.get('/export', requireUser, handle(async (req, res) => {
    const contacts = listContacts(db, req.user.id);
    const buffer = await buildContactsWorkbook(contacts);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', contentDisposition(`通讯录-${today()}.xlsx`));
    res.setHeader('Cache-Control', 'no-store');
    res.send(Buffer.from(buffer));
  }));

  router.get('/import/template', handle(async (req, res) => {
    const buffer = await buildTemplateWorkbook();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', contentDisposition('通讯录-导入模板.xlsx'));
    res.send(Buffer.from(buffer));
  }));

  router.post('/import', requireUser, upload.single('file'), handle(async (req, res) => {
    if (!req.file) throw new ValidationError('请选择要导入的 Excel 文件');
    const mode = req.body?.mode === 'skip' ? 'skip' : 'merge';
    const rows = await parseContactsWorkbook(req.file.buffer);
    const summary = importContacts(db, req.user.id, rows, mode);
    res.json({ ...summary, mode });
  }));

  return router;
}
