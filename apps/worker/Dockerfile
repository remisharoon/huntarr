FROM mcr.microsoft.com/playwright/python:v1.51.0-jammy

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app/apps/worker/src:/app/packages/core/src

COPY packages/core /app/packages/core
COPY apps/worker/requirements.txt /app/apps/worker/requirements.txt
RUN pip install --no-cache-dir -e /app/packages/core && pip install --no-cache-dir -r /app/apps/worker/requirements.txt

COPY apps/worker/src /app/apps/worker/src

WORKDIR /app/apps/worker
CMD ["python", "-m", "huntarr_worker.main"]
