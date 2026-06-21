# Stage 1: Build React frontend
FROM node:24-alpine AS builder
WORKDIR /fe
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python runtime with API and static files
FROM python:3.12-slim
WORKDIR /app
COPY backend/ ./
RUN pip install --no-cache-dir -e .
COPY --from=builder /fe/dist ./frontend_dist
COPY skills /app/skills

EXPOSE 8765 8766

# Default: run web server
CMD ["python", "serve.py"]
