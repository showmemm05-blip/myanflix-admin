# Running admin in Docker

## Run it

```bash
cd admin
cp .env.example .env
# edit .env if the backend isn't at the default URL
docker compose up -d --build
```

Serves on `http://localhost:3002`.

## Why a build arg, not a runtime env var

`NEXT_PUBLIC_API_BASE_URL` gets compiled directly into the client-side JS
bundle when `next build` runs — the browser reads it from the bundle, it
never asks the container for it at request time. That means it has to be
correct **at build time**, and changing it means rebuilding the image, not
just restarting the container with a different env var.

## Moving to the real VPS

Set `NEXT_PUBLIC_API_BASE_URL` in `.env` to the real, publicly-reachable API
URL (not a Docker-internal hostname — the end user's browser has to be able
to reach it directly), then deploy `admin/` to the Flokinet VPS and run the
same `docker compose up -d --build`.
