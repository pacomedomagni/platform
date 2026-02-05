import * as Sentry from '@sentry/nestjs';

/**
 * Initialize Sentry for error tracking and performance monitoring
 * This must be called before any other imports in main.ts
 */
export function initSentry() {
  const dsn = process.env['SENTRY_DSN'];
  
  if (!dsn) {
    console.log('Sentry DSN not configured, error tracking disabled');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] || 'development',
    release: process.env['APP_VERSION'] || '1.0.0',
    
    // Performance Monitoring
    tracesSampleRate: process.env['NODE_ENV'] === 'production' ? 0.1 : 1.0,
    
    // Profiling (optional, for performance analysis)
    profilesSampleRate: process.env['NODE_ENV'] === 'production' ? 0.1 : 1.0,
    
    integrations: [
      // Node.js specific integrations
      Sentry.httpIntegration(),
      Sentry.nativeNodeFetchIntegration(),
      Sentry.prismaIntegration(),
    ],
    
    // Filter out sensitive data
    beforeSend(event) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['x-api-key'];
      }
      
      // Remove sensitive data from request body
      if (event.request?.data) {
        const data = typeof event.request.data === 'string' 
          ? JSON.parse(event.request.data) 
          : event.request.data;
        
        if (data.password) data.password = '[REDACTED]';
        if (data.token) data.token = '[REDACTED]';
        if (data.apiKey) data.apiKey = '[REDACTED]';
        
        event.request.data = JSON.stringify(data);
      }
      
      return event;
    },
    
    // Ignore certain errors
    ignoreErrors: [
      // Network errors that are usually client-side issues
      'ECONNRESET',
      'ETIMEDOUT',
      'ECONNREFUSED',
      // Common non-critical errors
      'ResizeObserver loop limit exceeded',
      'Request aborted',
    ],
    
    // Only send errors in production by default
    enabled: process.env['NODE_ENV'] === 'production' || process.env['SENTRY_ENABLED'] === 'true',
  });

  console.log('Sentry initialized for error tracking');
}

/**
 * Capture an exception manually
 */
export function captureException(error: Error, context?: Record<string, unknown>) {
  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture a message (non-error event)
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  Sentry.captureMessage(message, level);
}

/**
 * Set user context for error tracking
 */
export function setUser(user: { id: string; email?: string; tenantId?: string }) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    // Custom context
    tenantId: user.tenantId,
  } as Sentry.User & { tenantId?: string });
}

/**
 * Clear user context (on logout)
 */
export function clearUser() {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(breadcrumb: Sentry.Breadcrumb) {
  Sentry.addBreadcrumb(breadcrumb);
}

/**
 * Set custom tag
 */
export function setTag(key: string, value: string) {
  Sentry.setTag(key, value);
}

/**
 * Set custom context
 */
export function setContext(name: string, context: Record<string, unknown>) {
  Sentry.setContext(name, context);
}

export { Sentry };
