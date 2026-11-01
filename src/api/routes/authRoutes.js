'use strict';

const express = require('express');
const { validate, setSessionCookie, clearSessionCookie } = require('../middleware');
const { schemas } = require('../schemas');
const { AppError } = require('../../domain/errors');

/** /auth — sign-in, OTP, sign-out, session (SDD §5.2.1). */
function authRoutes({ components, config }) {
  const router = express.Router();
  const { auth } = components;
  const secure = config.env === 'production';

  router.post('/signin', validate(schemas.signIn), (req, res) => {
    const { token, principal } = auth.signInWithPassword(req.valid);
    setSessionCookie(res, token, { secure });
    res.json({ token, session: principal });
  });

  router.post('/otp/request', validate(schemas.otpRequest), (req, res) => {
    res.status(201).json(auth.requestOtp(req.valid));
  });

  router.post('/otp/verify', validate(schemas.otpVerify), (req, res) => {
    const { token, principal } = auth.verifyOtp(req.valid);
    setSessionCookie(res, token, { secure });
    res.json({ token, session: principal });
  });

  router.post('/signout', (req, res) => {
    auth.signOut(req.token);
    clearSessionCookie(res);
    res.status(204).end();
  });

  router.get('/session', (req, res) => {
    if (!req.principal) throw new AppError('AUTH-001', 'Not signed in');
    res.json({ session: auth.describe(req.principal) });
  });

  return router;
}

module.exports = { authRoutes };
