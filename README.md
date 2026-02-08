# OSINT Browser Agent

A person lookup service for [hitta.se](https://www.hitta.se) that searches by name or phone number and returns structured JSON. Uses browser automation via [agent-browser](https://github.com/vercel-labs/agent-browser) with deterministic parsing for fast, low-token-cost results.

Built to run as a sidecar alongside [OpenClaw](https://github.com/openclaw/openclaw) in Docker Compose.

## Features

- Search by name with optional filters (city, age range)
- Reverse phone lookup
- Enriched data extraction (relatives, previous addresses, email)
- Swedish character support (å, ä, ö)
- Persistent browser session for fast subsequent searches
- RESTful JSON API
- OpenClaw skill for seamless AI agent integration

## Quick Start (Docker)

```bash
# Build and run locally
docker compose -f compose.dev.yml up --build

# Test
curl -s http://localhost:3000/health
curl -s http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"name": "Anders Andersson", "city": "Stockholm"}'
```

## Quick Start (bare metal)

```bash
bun install
bun run index.ts
```

## OpenClaw Integration

This service is designed to be called by an [OpenClaw](https://github.com/openclaw/openclaw) agent via the `exec` tool + `curl`. The included skill teaches the agent when and how to use it.

### 1. Add the service to your OpenClaw compose

Merge the contents of `openclaw-compose.example.yml` into your existing `docker-compose.yml`:

```yaml
services:
  # ... your existing OpenClaw services ...

  hitta-search:
    image: ghcr.io/j4ck3/osint-browser-agent:master
    environment:
      - BROWSER_HEADLESS=true
      - PORT=3000
    restart: unless-stopped
```

The service name `hitta-search` becomes the hostname on the compose network. No ports need to be exposed externally.

### 2. Install the skill

Copy the skill into your OpenClaw skills directory:

```bash
# Shared across all agents
cp -r skills/hitta-se ~/.openclaw/skills/

# Or per-agent (workspace)
cp -r skills/hitta-se ~/path/to/workspace/skills/
```

### 3. Restart OpenClaw

The agent picks up the skill on the next session. Ask it something like:

> "Look up Johan Eriksson in Stockholm"

The agent will call:

```bash
curl -s http://hitta-search:3000/search \
  -H 'Content-Type: application/json' \
  -d '{"name": "Johan Eriksson", "city": "Stockholm"}'
```

And receive structured JSON back (~200-500 tokens) with name, age, address, phone, relatives, and more.

## API Reference

### POST /search

Search for a person by name or phone number.

| Field    | Type   | Required             | Description                   |
| -------- | ------ | -------------------- | ----------------------------- |
| `name`   | string | Either name or phone | Person's name                 |
| `phone`  | string | Either name or phone | Phone number (Swedish format) |
| `city`   | string | No                   | Filter by city                |
| `ageMin` | number | No                   | Minimum age                   |
| `ageMax` | number | No                   | Maximum age                   |

**Success (200):**

```json
{
  "success": true,
  "result": {
    "name": "Anders Andersson",
    "age": 42,
    "address": {
      "street": "Drottninggatan 1",
      "postalCode": "111 51",
      "city": "Stockholm"
    },
    "phoneNumbers": ["+46701234567"],
    "relatives": ["Anna Andersson"],
    "previousAddresses": [{ "postalCode": "753 10", "city": "Uppsala" }],
    "email": "anders@example.com",
    "profileUrl": "https://www.hitta.se/anders+andersson/stockholm/person/abc123"
  }
}
```

**Not found (404):**

```json
{
  "success": false,
  "error": "No person found matching the search criteria",
  "code": "NOT_FOUND"
}
```

### GET /health

```json
{
  "status": "ok",
  "timestamp": "2026-02-08T10:30:00.000Z",
  "browser": "ready"
}
```

## Configuration

| Variable             | Default | Description                     |
| -------------------- | ------- | ------------------------------- |
| `PORT`               | 3000    | HTTP server port                |
| `BROWSER_HEADLESS`   | true    | Run browser in headless mode    |
| `REQUEST_TIMEOUT_MS` | 30000   | Request timeout in milliseconds |

## Architecture

```
OpenClaw agent
    │ exec: curl http://hitta-search:3000/search ...
    ▼
Fastify Server → BrowserService → agent-browser → hitta.se
                       │
               ScraperService (deterministic regex parsing)
                       │
             EnrichmentService (profile page extraction)
                       │
               Structured JSON response (~200-500 tokens)
```

## Performance

- **First request:** ~3-5 seconds (browser cold start)
- **Subsequent requests:** ~1-2 seconds (persistent session)
- **Memory:** ~150-200 MB (Chromium)

## License

MIT
