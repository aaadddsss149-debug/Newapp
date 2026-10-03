# syntax=docker/dockerfile:1

# ---- Build stage: compile frontend (vite) + backend (tsc) ----
FROM node:22-bookworm AS builder
WORKDIR /app

# better-sqlite3 builds a native addon, so the toolchain is required here.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Install workspace deps first for better layer caching.
COPY package.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm install --no-audit --no-fund

# Copy the rest and build both workspaces (frontend dist + backend dist).
COPY . .
RUN npm run build

# Strip dev dependencies from the hoisted node_modules for a lean runtime image.
RUN npm prune --omit=dev

# ---- Runtime stage: minimal image that serves the single origin ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app/backend

# Hoisted deps (incl. the compiled better-sqlite3) live in /app/node_modules.
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/backend/package.json /app/backend/package.json
COPY --from=builder /app/backend/dist /app/backend/dist
COPY --from=builder /app/frontend/dist /app/frontend/dist

# SQLite database directory (persist via a named volume).
RUN mkdir -p /app/backend/data

EXPOSE 8080
CMD ["node", "dist/index.js"]
