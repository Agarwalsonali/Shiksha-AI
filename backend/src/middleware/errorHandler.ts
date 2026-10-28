import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError.ts';
import { errorResponse } from '../utils/apiResponse.ts';
import { ZodError } from 'zod';

/**
 * Global error handling middleware
 * Converts all errors to standardized API error responses
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Default error values
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let details: any = undefined;

  // Log error for debugging
  console.error('Error occurred:', {
    name: err.name,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  // Handle ApiError instances
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = (err as any).details;
  }
  // Handle Zod validation errors
  else if (err instanceof ZodError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = err.issues.map((e: any) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
  }
  // Handle Supabase/PostgreSQL errors
  else if (err.name === 'PostgrestError' || (err as any).code) {
    statusCode = 500;
    code = 'DATABASE_ERROR';
    message = 'Database operation failed';
    details = process.env.NODE_ENV === 'development' ? {
      originalError: err.message,
      code: (err as any).code,
    } : undefined;
  }
  // Generic errors
  else {
    message = process.env.NODE_ENV === 'development' 
      ? err.message 
      : 'An unexpected error occurred';
  }

  // Send error response
  res.status(statusCode).json(errorResponse(message, code, details));
};

/**
 * 404 Not Found handler for undefined routes
 */
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json(
    errorResponse(
      `Route ${req.method} ${req.path} not found`,
      'ROUTE_NOT_FOUND'
    )
  );
};
