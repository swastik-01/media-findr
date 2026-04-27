# Stage 1: Build Frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend

# Add Build Arguments for Vite (required at build time for React)
ARG VITE_COGNITO_USER_POOL_ID
ARG VITE_COGNITO_CLIENT_ID
ARG VITE_COGNITO_DOMAIN
ARG VITE_AWS_REGION

COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./

# Run build with the environment variables
RUN VITE_COGNITO_USER_POOL_ID=$VITE_COGNITO_USER_POOL_ID \
    VITE_COGNITO_CLIENT_ID=$VITE_COGNITO_CLIENT_ID \
    VITE_COGNITO_DOMAIN=$VITE_COGNITO_DOMAIN \
    VITE_AWS_REGION=$VITE_AWS_REGION \
    npm run build

# Stage 2: Build Backend and Final Image
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy frontend build from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy backend source code
COPY backend/ ./backend/

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=8000
ENV PYTHONPATH=/app/backend

# Expose the port
EXPOSE 8000

# Start the application
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
