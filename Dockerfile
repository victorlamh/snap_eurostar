FROM mcr.microsoft.com/playwright:v1.50.0-noble

WORKDIR /app

# Copy package files
COPY package*.json tsconfig.json ./

# Install dependencies
RUN npm ci
RUN npx playwright install chromium

# Copy application source code
COPY . .

# Build TypeScript to dist
RUN npm run build

# Create data and debug volume mount points
RUN mkdir -p /app/data /app/debug

ENV NODE_ENV=production
ENV HEADLESS=true
EXPOSE 3000

# Default command starts the web dashboard and auto-scanner server
CMD ["node", "dist/server.js"]
