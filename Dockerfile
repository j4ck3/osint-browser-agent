FROM oven/bun:1 AS base

# Install system dependencies required by Playwright/Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Chromium runtime deps
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatspi2.0-0 \
    libwayland-client0 \
    # Fonts
    fonts-liberation \
    fonts-noto-color-emoji \
    # Utilities
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# --- Install stage ---
FROM base AS install

WORKDIR /tmp/install
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# --- Final stage ---
FROM base

WORKDIR /app

COPY --from=install /tmp/install/node_modules ./node_modules
COPY . .

# Fix binary permissions and install Chromium for Playwright
RUN chmod +x node_modules/agent-browser/bin/* \
    && bunx playwright install chromium

# Default env
ENV NODE_ENV=production
ENV BROWSER_HEADLESS=true
ENV PORT=3000

EXPOSE 3000

ENTRYPOINT ["bun", "run", "index.ts"]
