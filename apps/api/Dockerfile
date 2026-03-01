FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app/apps/api/src:/app/packages/core/src

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY apps/api/requirements.txt /app/apps/api/requirements.txt
RUN pip install --no-cache-dir -r /app/apps/api/requirements.txt

COPY packages/core /app/packages/core
RUN pip install --no-cache-dir -e /app/packages/core

COPY apps/api/src /app/apps/api/src

WORKDIR /app/apps/api
EXPOSE 8000

CMD ["uvicorn", "huntarr_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
