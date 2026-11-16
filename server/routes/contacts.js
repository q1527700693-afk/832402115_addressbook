import express from 'express';
import {
  countStats,
  createContact,
  deleteContact,
  getContact,
  listContacts,
  NotFoundError,
  setFavorite,
  updateContact,
} from '../store.js';

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

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new NotFoundError('联系人不存在');
  }
  return id;
}

export function contactsRouter(db) {
  const router = express.Router();

  router.get('/contacts', handle((req, res) => {
    const contacts = listContacts(db, {
      search: req.query.q ?? '',
      favorite: req.query.favorite === '1' || req.query.favorite === 'true',
    });
    res.json({ contacts, ...countStats(db) });
  }));

  router.get('/contacts/:id', handle((req, res) => {
    const contact = getContact(db, parseId(req.params.id));
    if (!contact) throw new NotFoundError();
    res.json(contact);
  }));

  router.post('/contacts', handle((req, res) => {
    const contact = createContact(db, req.body);
    res.status(201).json(contact);
  }));

  router.put('/contacts/:id', handle((req, res) => {
    const contact = updateContact(db, parseId(req.params.id), req.body);
    res.json(contact);
  }));

  router.patch('/contacts/:id/favorite', handle((req, res) => {
    const contact = setFavorite(db, parseId(req.params.id), req.body?.isFavorite === true || req.body?.isFavorite === 1);
    res.json(contact);
  }));

  router.delete('/contacts/:id', handle((req, res) => {
    res.json(deleteContact(db, parseId(req.params.id)));
  }));

  router.get('/stats', handle((req, res) => {
    res.json(countStats(db));
  }));

  return router;
}
