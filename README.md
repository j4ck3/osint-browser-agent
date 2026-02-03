# OSINT Browser Agent

A Bun-powered HTTP API that searches hitta.se for person information using browser automation via [agent-browser](https://github.com/vercel-labs/agent-browser).

## Features

- Search by name with optional filters (city, age range)
- Reverse phone lookup
- Enriched data extraction (relatives, previous addresses)
- Swedish character support (å, ä, ö)
- Persistent browser session for fast subsequent searches
- RESTful JSON API

## Prerequisites

- [Bun](https://bun.sh) runtime
- Chromium browser (installed automatically)

## Installation

```bash
# Install dependencies
bun install

# Install Chromium for agent-browser
npx agent-browser install

# (Optional) Copy and configure environment
cp .env.example .env
```

## Usage

```bash
# Start the server
bun run index.ts

# The server will be available at http://localhost:3000
```

## API Endpoints

### POST /search

Search for a person by name or phone number.

**Request Body:**

```json
{
  "name": "Anders Andersson",
  "city": "Stockholm",
  "ageMin": 30,
  "ageMax": 50
}
```

Or search by phone:

```json
{
  "phone": "+46701234567"
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Either name or phone | Person's name to search |
| `phone` | string | Either name or phone | Phone number (Swedish format) |
| `city` | string | No | Filter by city |
| `ageMin` | number | No | Minimum age filter |
| `ageMax` | number | No | Maximum age filter |

**Success Response (200):**

```json
{
  "success": true,
  "result": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Anders Andersson",
    "age": 42,
    "address": {
      "street": "Drottninggatan 1",
      "postalCode": "111 51",
      "city": "Stockholm"
    },
    "phoneNumbers": ["+46701234567"],
    "profileUrl": "https://hitta.se/anders+andersson/...",
    "relatives": ["Anna Andersson", "Erik Andersson"],
    "previousAddresses": [
      {
        "city": "Uppsala",
        "postalCode": "753 10"
      }
    ],
    "metadata": {
      "scrapedAt": "2026-02-03T10:30:00.000Z",
      "source": "hitta.se"
    }
  },
  "query": {
    "name": "Anders Andersson",
    "city": "Stockholm",
    "ageMin": 30,
    "ageMax": 50
  }
}
```

**Not Found Response (404):**

```json
{
  "success": false,
  "error": "No person found matching the search criteria",
  "code": "NOT_FOUND"
}
```

**Validation Error (400):**

```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": "Either name or phone must be provided"
}
```

### GET /health

Health check endpoint.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2026-02-03T10:30:00.000Z",
  "browser": "ready"
}
```

## Examples

### Search by name

```bash
curl -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"name": "Anders Andersson", "city": "Stockholm"}'
```

### Search by phone

```bash
curl -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"phone": "+46701234567"}'
```

### Search with age range

```bash
curl -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"name": "Åsa Björk", "city": "Göteborg", "ageMin": 25, "ageMax": 35}'
```

### Health check

```bash
curl http://localhost:3000/health
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | HTTP server port |
| `BROWSER_HEADLESS` | true | Run browser in headless mode |
| `REQUEST_TIMEOUT_MS` | 30000 | Request timeout in milliseconds |

## Performance

- **First request:** ~3-5 seconds (browser startup)
- **Subsequent requests:** ~1-2 seconds (persistent session)
- **Memory usage:** ~150-200 MB (Chromium)

## Architecture

```
HTTP Request → Fastify Server → BrowserService → agent-browser → hitta.se
                                      ↓
                              ScraperService (parse HTML)
                                      ↓
                            EnrichmentService (profile details)
                                      ↓
                              Person JSON Response
```

## License

MIT
