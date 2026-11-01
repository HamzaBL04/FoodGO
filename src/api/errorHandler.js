'use strict';

const { AppError } = require('../domain/errors');

function notFound(_req, _res, next) {
  next(new AppError('NOT-FOUND'));
}

/**
 * Safe error responses (spec §12): known errors return their code and
 * detail; anything else becomes SYS-001 without a stack trace or SQL.
 */
function errorHandler(logger) {
  // Express recognises error middleware by its four parameters.
  return (err, req, res, _next) => {
    let appError = err;
    if (!(err instanceof AppError)) {
      if (err && err.type === 'entity.parse.failed') appError = new AppError('VAL-001', 'Malformed JSON body');
      else {
        appError = new AppError('SYS-001');
        logger.error(`[error] ${req.method} ${req.originalUrl}`, err);
      }
    }
    res.status(appError.status).json(appError.toJSON());
  };
}

module.exports = { notFound, errorHandler };
