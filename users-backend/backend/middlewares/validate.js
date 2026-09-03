import { ZodError } from 'zod';
import { errorResponseSchema } from '../schemas/common.js';

export function validate(schema) {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req.body);
      req.validated = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.flatten().fieldErrors;
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details,
        });
      }
      next(error);
    }
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req.query);
      req.validatedQuery = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.flatten().fieldErrors;
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details,
        });
      }
      next(error);
    }
  };
}

export function validateParams(schema) {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req.params);
      req.validatedParams = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.flatten().fieldErrors;
        return res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'Invalid route parameters',
          details,
        });
      }
      next(error);
    }
  };
}