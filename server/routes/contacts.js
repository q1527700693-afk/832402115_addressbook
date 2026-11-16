import express from 'express';
import { requireUser } from '../auth.js';
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

/**
 * Reads are available to everyone: anonymous visitors get the read-only preview
 * rows (user_id IS NULL), signed-in users get their own address book.
 */
function scopeOf(req) {
  return req.user ? req.user.id : null;
}

export function contactsRouter(db) {
  const router = express.Router();

  router.get('/contacts', handle((req, res) => {
    const userId = scopeOf(req);
    const contacts = listContacts(db, userId, {
      search: req.query.q ?? '',
      favorite: req.query.favorite === '1' || req.query.favorite === 'true',
    });
    res.json({
      contacts,
      ...countStats(db, userId),
      preview: userId === null,
      authenticated: Boolean(req.user),
    });
  }));

  router.get('/contacts/:id', handle((req, res) => {
    const contact = getContact(db, scopeOf(req), parseId(req.params.id));
    if (!contact) throw new NotFoundError();
    res.json(contact);
  }));

  router.post('/contacts', requireUser, handle((req, res) => {
    const contact = createContact(db, req.user.id, req.body);
    res.status(201).json(contact);
  }));

  router.put('/contacts/:id', requireUser, handle((req, res) => {
    const contact = updateContact(db, req.user.id, parseId(req.params.id), req.body);
    res.json(contact);
  }));

  router.patch('/contacts/:id/favorite', requireUser, handle((req, res) => {
    const contact = setFavorite(
      db,
      req.user.id,
      parseId(req.params.id),
      req.body?.isFavorite === true || req.body?.isFavorite === 1,
    );
    res.json(contact);
  }));

  router.delete('/contacts/:id', requireUser, handle((req, res) => {
    res.json(deleteContact(db, req.user.id, parseId(req.params.id)));
  }));

  router.get('/stats', handle((req, res) => {
    res.json(countStats(db, scopeOf(req)));
  }));

  return router;
}
