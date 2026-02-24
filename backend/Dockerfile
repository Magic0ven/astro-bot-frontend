FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

ENV PYTHONUNBUFFERED=1 \
    PORT=8000

# Use shell form so $PORT is expanded at runtime from Railway's injected env var
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
