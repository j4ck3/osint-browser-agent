---
name: hitta-se
description: Look up Swedish persons by name or phone number via hitta.se. Returns structured data including name, age, address, phone, relatives, and previous addresses.
metadata: { "openclaw": { "emoji": "🔍", "requires": { "anyBins": ["curl"] } } }
---

# Hitta.se Person Lookup

Search for Swedish persons using the hitta-search sidecar service. One request returns structured JSON with personal details extracted from hitta.se.

## When to use

- User asks to look up a Swedish person by name
- User asks to find who owns a Swedish phone number
- User asks for someone's address, age, or relatives in Sweden
- User mentions hitta.se or Swedish person lookup

## API endpoint

The service runs at `http://hitta-search:3000` inside the Docker Compose network.

## Search by name

```bash
curl -s http://hitta-search:3000/search \
  -H 'Content-Type: application/json' \
  -d '{"name": "Johan Eriksson", "city": "Stockholm"}'
```

Parameters:

- `name` (required): full or partial name
- `city` (optional): filter by city
- `ageMin` (optional): minimum age filter
- `ageMax` (optional): maximum age filter

## Search by phone

```bash
curl -s http://hitta-search:3000/search \
  -H 'Content-Type: application/json' \
  -d '{"phone": "0701234567"}'
```

Parameters:

- `phone` (required): Swedish phone number (with or without country code)

## Response format

Success:

```json
{
  "success": true,
  "result": {
    "name": "Johan Eriksson",
    "age": 42,
    "address": {
      "street": "Sturegatan 47",
      "postalCode": "702 14",
      "city": "Örebro"
    },
    "phoneNumbers": ["+46701234567"],
    "relatives": ["Anna Eriksson", "Erik Eriksson"],
    "previousAddresses": [{ "postalCode": "411 05", "city": "Göteborg" }],
    "email": "johan@example.com",
    "profileUrl": "https://www.hitta.se/johan+eriksson/örebro/person/abc123"
  }
}
```

No match found:

```json
{
  "success": false,
  "error": "No person found matching the search criteria",
  "code": "NOT_FOUND"
}
```

## Presenting results

When showing results to the user, format them readably:

- Lead with name and age
- Show current address
- List phone numbers (note: some digits may be masked by hitta.se)
- Mention relatives if present
- Mention previous addresses if present
- Include email if available
- Do not expose the raw JSON unless the user asks for it

## Health check

Verify the service is running:

```bash
curl -s http://hitta-search:3000/health
```

Returns `{"status":"ok","browser":"ready"}` when operational.

## Notes

- Either `name` or `phone` must be provided (not both, not neither).
- Phone numbers returned are in international format (+46...).
- Some phone digits may be masked (hitta.se hides the last digits for non-logged-in users).
- The service uses a headless browser internally; first request after startup may be slower (~5s) while the browser initializes.
- Subsequent requests are faster (~2-3s) as the browser session stays warm.
