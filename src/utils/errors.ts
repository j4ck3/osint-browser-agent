export class ScrapingError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ScrapingError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class BrowserError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'BrowserError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}
