import express from 'express';
import {
  authenticateUser,
  createSession,
  destroySession,
  registerUser,
  sessionCookie,
  clearedCookie,
} from '../auth.js';

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

export function authRouter(db) {
  const router = express.Router();

  router.post('/auth/register', handle((req, res) => {
    const user = registerUser(db, req.body?.username, req.body?.password);
    const token = createSession(db, user.id);
    res.setHeader('Set-Cookie', sessionCookie(token));
    res.status(201).json({ user });
  }));

  router.post('/auth/login', handle((req, res) => {
    const user = authenticateUser(db, req.body?.username, req.body?.password);
    const token = createSession(db, user.id);
    res.setHeader('Set-Cookie', sessionCookie(token));
    res.json({ user });
  }));

  router.post('/auth/logout', handle((req, res) => {
    destroySession(db, req.sessionToken);
    res.setHeader('Set-Cookie', clearedCookie());
    res.json({ ok: true });
  }));

  router.get('/auth/me', handle((req, res) => {
    res.json({ user: req.user ? { id: req.user.id, username: req.user.username } : null });
  }));

  return router;
}
