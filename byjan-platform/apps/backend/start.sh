#!/bin/sh
# One free web service runs the API and the background worker.
# Split the worker onto its own service later by overriding the start command.
set -eu

if [ -n "${REDIS_URL:-}" ]; then
  arq app.worker.WorkerSettings &
fi

exec gunicorn app.main:app \
  --bind "0.0.0.0:${PORT:-8000}" \
  --workers "${WEB_CONCURRENCY:-1}" \
  --worker-class uvicorn.workers.UvicornWorker \
  --timeout 120 \
  --graceful-timeout 30
