import Fastify from 'fastify';
import cors from '@fastify/cors';
import { browserService } from './src/services/browser';
import { validateSearchRequest, type SearchRequest } from './src/utils/validation';
import { NotFoundError, BrowserError, ValidationError } from './src/utils/errors';
import type { SearchResponse } from './src/types/person';
import type { HealthCheckResponse } from './src/types/api';
import { ZodError } from 'zod';

const PORT = parseInt(process.env.PORT || '3000');

// Create Fastify instance
const app = Fastify({
  logger: false // No logging as requested
});

// Register CORS
await app.register(cors, {
  origin: true
});

// Health check endpoint
app.get('/health', async (): Promise<HealthCheckResponse> => {
  const browserReady = await browserService.isReady();
  return {
    status: browserReady ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
    browser: browserReady ? 'ready' : 'not_ready'
  };
});

// Main search endpoint
app.post<{ Body: unknown }>('/search', async (request, reply): Promise<SearchResponse> => {
  try {
    // Validate request body
    const searchRequest = validateSearchRequest(request.body);

    let person = null;

    if (searchRequest.phone) {
      // Phone-based search
      person = await browserService.searchByPhone(searchRequest.phone);
    } else if (searchRequest.name) {
      // Name-based search with optional filters
      person = await browserService.searchByName(searchRequest.name, {
        city: searchRequest.city,
        ageMin: searchRequest.ageMin,
        ageMax: searchRequest.ageMax
      });
    }

    if (!person) {
      reply.status(404);
      return {
        success: false,
        error: 'No person found matching the search criteria',
        code: 'NOT_FOUND',
        query: sanitizeQuery(searchRequest)
      };
    }

    return {
      success: true,
      result: person,
      query: sanitizeQuery(searchRequest)
    };

  } catch (error) {
    if (error instanceof ZodError) {
      reply.status(400);
      return {
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.issues.map((e: { message: string }) => e.message).join(', ')
      };
    }

    if (error instanceof ValidationError) {
      reply.status(400);
      return {
        success: false,
        error: error.message,
        code: 'VALIDATION_ERROR'
      };
    }

    if (error instanceof NotFoundError) {
      reply.status(404);
      return {
        success: false,
        error: error.message,
        code: 'NOT_FOUND'
      };
    }

    if (error instanceof BrowserError) {
      reply.status(503);
      return {
        success: false,
        error: 'Browser automation failed',
        code: 'SERVICE_UNAVAILABLE',
        details: error.message
      };
    }

    // Unknown error
    reply.status(500);
    return {
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    };
  }
});

// Sanitize query for response (remove sensitive data if any)
function sanitizeQuery(query: SearchRequest): Record<string, unknown> {
  return {
    name: query.name,
    phone: query.phone ? maskPhone(query.phone) : undefined,
    city: query.city,
    ageMin: query.ageMin,
    ageMax: query.ageMax
  };
}

// Mask phone number for privacy in responses
function maskPhone(phone: string): string {
  if (phone.length <= 4) return '****';
  return phone.slice(0, -4) + '****';
}

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down...`);
  await browserService.close();
  await app.close();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
async function start() {
  try {
    console.log('Initializing browser...');
    await browserService.initialize();
    console.log('Browser initialized');

    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`OSINT Browser Agent running on http://localhost:${PORT}`);
    console.log('Endpoints:');
    console.log(`  POST /search - Search for a person`);
    console.log(`  GET  /health - Health check`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
