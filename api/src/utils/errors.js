/**
 * CampusFlow API - Custom Application Errors
 * Provides typed, structured error classes for operational HTTP errors.
 */

export class AppError extends Error {
  constructor(
    statusCode,
    code,
    message,
    details,
    isOperational = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad Request', details) {
    super(400, 'BAD_REQUEST', message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details) {
    super(401, 'UNAUTHORIZED', message, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details) {
    super(403, 'FORBIDDEN', message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details) {
    super(404, 'NOT_FOUND', message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict with current resource state', details) {
    super(409, 'CONFLICT', message, details);
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal server error', details) {
    super(500, 'INTERNAL_SERVER_ERROR', message, details, false);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message = 'Unprocessable Entity', details) {
    super(422, 'UNPROCESSABLE_ENTITY', message, details);
  }
}
