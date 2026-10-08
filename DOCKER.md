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

## Security headers and `CSP_CONNECT_SRC_EXTRA`

`next.config.ts` computes the Content-Security-Policy and the other security
headers during `next build`, so they are baked into the image the same way
`NEXT_PUBLIC_API_BASE_URL` is. The browser uploads book PDFs and replacement
videos straight to the backend's `MINIO_PUBLIC_ENDPOINT`, an origin this build
cannot discover, so you tell it:

```bash
# admin/.env — same origin as MINIO_PUBLIC_ENDPOINT in backend/.env
CSP_CONNECT_SRC_EXTRA=http://localhost:8443
```

With it set, scripts on the admin page can only talk to the admin, the API and
MinIO. **Without it, `connect-src` stays open to any http/https host** (uploads
keep working, but a script injected into the admin could send a staff token
elsewhere) and `next build` prints a `SECURITY:` warning. Change it together
with `MINIO_PUBLIC_ENDPOINT` and rebuild.

## Moving to the real VPS

Set `NEXT_PUBLIC_API_BASE_URL` in `.env` to the real, publicly-reachable API
URL (not a Docker-internal hostname — the end user's browser has to be able
to reach it directly), then deploy `admin/` to the Flokinet VPS and run the
same `docker compose up -d --build`.
