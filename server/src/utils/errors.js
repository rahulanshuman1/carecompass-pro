export class AppError extends Error {
  constructor(status, message, code = 'ERROR', details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const need = (cond, status, message, code) => {
  if (!cond) throw new AppError(status, message, code);
};

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const label = (s) =>
  String(s).replace(/_/g, ' ').toLowerCase().replace(/(^|\s)\w/g, (c) => c.toUpperCase());
