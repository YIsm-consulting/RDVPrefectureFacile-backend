FROM node:20-bookworm-slim

# Install minimal deps needed for Playwright's --with-deps installer
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for layer caching
COPY package*.json ./

# Install npm deps without triggering postinstall (playwright runs separately)
RUN npm install --omit=dev --ignore-scripts

# Install Playwright Chromium + all Linux system deps via apt-get
RUN npx playwright install chromium --with-deps

# Copy application source
COPY . .

CMD ["node", "server.js"]
