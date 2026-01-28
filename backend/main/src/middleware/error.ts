import { Request, Response, NextFunction } from 'express';
import { env } from "../config/env";

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export class AppError extends Error {
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const globalErrorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  err.statusCode = err.statusCode || 500;
  err.isOperational = err.isOperational || false;

  const response = {
    status: err.statusCode >= 500 ? 'error' : 'fail',
    message: err.message,
    ...(env.nodeEnv === 'development' && { stack: err.stack })
  };

  res.status(err.statusCode).json(response);
};

export const setupErrorHandlers = (): void => {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    console.error('💥 UNCAUGHT EXCEPTION:', error);
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    console.error('💥 UNHANDLED REJECTION at:', promise, 'reason:', reason);
    // In production, you might want to exit here
    if (env.nodeEnv === 'production') {
      process.exit(1);
    }
  });

  // Handle SIGTERM
  process.on('SIGTERM', () => {
    console.log('👋 SIGTERM received. Shutting down gracefully...');
    process.exit(0);
  });

  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', () => {
    console.log('👋 SIGINT received. Shutting down gracefully...');
    process.exit(0);
  });
};