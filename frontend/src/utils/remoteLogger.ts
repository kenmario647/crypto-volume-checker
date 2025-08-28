// Remote logging utility to send browser console logs to backend
class RemoteLogger {
  private endpoint: string;
  private enabled: boolean;
  private queue: any[] = [];
  private batchTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.endpoint = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/browser-logs`;
    this.enabled = process.env.NODE_ENV === 'development';
    
    if (this.enabled) {
      this.interceptConsole();
    }
  }

  private interceptConsole() {
    // Store original console methods
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;

    // Override console methods
    console.log = (...args: any[]) => {
      originalLog.apply(console, args);
      this.log('log', args);
    };

    console.error = (...args: any[]) => {
      originalError.apply(console, args);
      this.log('error', args);
    };

    console.warn = (...args: any[]) => {
      originalWarn.apply(console, args);
      this.log('warn', args);
    };

    console.info = (...args: any[]) => {
      originalInfo.apply(console, args);
      this.log('info', args);
    };

    // Capture unhandled errors
    window.addEventListener('error', (event) => {
      this.log('error', [{
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.stack || event.error
      }]);
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.log('error', [{
        type: 'unhandledRejection',
        reason: event.reason,
        promise: event.promise
      }]);
    });
  }

  private log(level: string, args: any[]) {
    if (!this.enabled) return;

    const logEntry = {
      level,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      args: args.map(arg => {
        try {
          if (typeof arg === 'object') {
            return JSON.stringify(arg, null, 2);
          }
          return String(arg);
        } catch (e) {
          return '[Circular or Complex Object]';
        }
      })
    };

    this.queue.push(logEntry);
    this.scheduleBatch();
  }

  private scheduleBatch() {
    if (this.batchTimer) return;

    this.batchTimer = setTimeout(() => {
      this.sendBatch();
      this.batchTimer = null;
    }, 1000); // Send logs every 1 second
  }

  private async sendBatch() {
    if (this.queue.length === 0) return;

    const batch = [...this.queue];
    this.queue = [];

    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logs: batch }),
      });
    } catch (error) {
      // Silently fail to avoid infinite loop
    }
  }

  // Manual log method for specific debugging
  public debug(message: string, data?: any) {
    console.log(`[DEBUG] ${message}`, data);
  }
}

// Create singleton instance
const remoteLogger = new RemoteLogger();

export default remoteLogger;