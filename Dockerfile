# Multi-stage: build frontend, then run backend + serve static
FROM node:20-alpine AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim
WORKDIR /app
COPY backend/ .
RUN pip install --no-cache-dir -r requirements.txt
COPY --from=frontend /build/dist /app/static

ENV EXPENSE_TRACKER_STATIC_DIR=/app/static
EXPOSE 8000

# Data dir for DB, ML models, uploads (mount a volume at /app/data)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
