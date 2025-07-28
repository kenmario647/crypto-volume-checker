# Multi-stage build for production
FROM node:18-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --only=production
COPY frontend/ ./
RUN npm run build

# Backend build
FROM node:18-alpine AS backend-build

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --only=production
COPY backend/ ./
RUN npm run build

# Final production image
FROM node:18-alpine

WORKDIR /app

# Install production dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --only=production

# Copy built applications
COPY --from=frontend-build /app/frontend/build ./frontend/build
COPY --from=backend-build /app/backend/dist ./backend/dist
COPY backend/.env ./backend/

# Create logs directory
RUN mkdir -p backend/logs

# Expose ports
EXPOSE 3000 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

# Start the application
CMD ["node", "backend/dist/index.js"]