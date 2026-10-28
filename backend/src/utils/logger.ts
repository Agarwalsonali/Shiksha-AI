import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Pino logger instance
 * - Pretty printing in development
 * - JSON output in production
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined, // JSON in production
});

/**
 * Log AI request initialization
 */
export const logAIRequest = (
  model: string,
  promptLength: number,
  userId?: string,
  context?: Record<string, any>
) => {
  logger.info(
    {
      type: 'ai_request',
      model,
      promptLength,
      userId,
      ...context,
    },
    'AI request initiated'
  );
};

/**
 * Log AI response completion
 */
export const logAIResponse = (
  model: string,
  tokensUsed: number,
  duration: number,
  userId?: string,
  context?: Record<string, any>
) => {
  logger.info(
    {
      type: 'ai_response',
      model,
      tokensUsed,
      duration,
      userId,
      ...context,
    },
    'AI response completed'
  );
};

/**
 * Log RAG query execution
 */
export const logRAGQuery = (
  query: string,
  resultsCount: number,
  filters?: Record<string, any>,
  context?: Record<string, any>
) => {
  logger.info(
    {
      type: 'rag_query',
      query: query.substring(0, 100), // Truncate long queries
      resultsCount,
      filters,
      ...context,
    },
    'RAG query executed'
  );
};

/**
 * Log RAG search failure
 */
export const logRAGError = (
  query: string,
  error: Error,
  context?: Record<string, any>
) => {
  logger.warn(
    {
      type: 'rag_error',
      query: query.substring(0, 100),
      error: error.message,
      ...context,
    },
    'RAG search failed, falling back'
  );
};

/**
 * Log general errors with context
 */
export const logError = (
  error: Error,
  context?: Record<string, any>
) => {
  logger.error(
    {
      type: 'error',
      err: error,
      stack: error.stack,
      ...context,
    },
    error.message
  );
};

/**
 * Log streaming started
 */
export const logStreamStart = (
  model: string,
  userId?: string,
  context?: Record<string, any>
) => {
  logger.info(
    {
      type: 'stream_start',
      model,
      userId,
      ...context,
    },
    'Streaming response started'
  );
};

/**
 * Log streaming completed
 */
export const logStreamEnd = (
  model: string,
  duration: number,
  totalTokens?: number,
  userId?: string,
  context?: Record<string, any>
) => {
  logger.info(
    {
      type: 'stream_end',
      model,
      duration,
      totalTokens,
      userId,
      ...context,
    },
    'Streaming response completed'
  );
};

/**
 * Log database operations
 */
export const logDatabase = (
  operation: string,
  table: string,
  duration?: number,
  context?: Record<string, any>
) => {
  logger.debug(
    {
      type: 'database',
      operation,
      table,
      duration,
      ...context,
    },
    `Database ${operation} on ${table}`
  );
};

/**
 * Log warning messages
 */
export const logWarning = (
  message: string,
  context?: Record<string, any>
) => {
  logger.warn(
    {
      type: 'warning',
      ...context,
    },
    message
  );
};
