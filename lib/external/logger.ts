// Integration logger utility
// In production, these would go to proper logging service

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  error: (message: string, error?: any) => {
    if (isDevelopment) {
      console.error(`[Integration Error] ${message}`, error);
    }
    // In production, send to logging service like Sentry
  },

  warn: (message: string, data?: any) => {
    if (isDevelopment) {
      console.warn(`[Integration Warning] ${message}`, data);
    }
  },

  info: (message: string, data?: any) => {
    if (isDevelopment) {
      console.info(`[Integration Info] ${message}`, data);
    }
  },

  debug: (message: string, data?: any) => {
    if (isDevelopment && process.env.DEBUG) {
      console.debug(`[Integration Debug] ${message}`, data);
    }
  },
};
