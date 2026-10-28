import type { Request, Response, NextFunction } from 'express';
import { ZodError, type ZodSchema } from 'zod';
import { ValidationError } from '../utils/apiError.ts';

/**
 * Validation middleware factory
 * Validates request body, query, or params against a Zod schema
 */
export const validate = (schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const dataToValidate = req[source];
      
      // Validate and parse the data
      schema.parse(dataToValidate);
      
      // For body, we can reassign safely
      // For query and params, they're readonly, so we just validate
      // The controller can access the validated data from req[source] as-is
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.issues.map((err: any) => ({
          path: err.path.join('.'),
          message: err.message,
        }));
        
        next(new ValidationError('Validation failed', details));
      } else {
        next(error);
      }
    }
  };
};
