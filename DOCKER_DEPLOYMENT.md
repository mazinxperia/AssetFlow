# AssetFlow Docker Deployment

## Local rehearsal

```bash
cp .env.example .env
docker compose up --build -d
docker compose ps
```

Open:

```text
http://localhost:8080
```

Default first-login account on a fresh database:

```text
Email:    admin@local.internal
Password: Admin123!
```

Useful local commands:

```bash
docker compose logs -f backend frontend mongodb
docker compose down
```

`docker compose down` stops the containers but keeps MongoDB data in Docker volumes.

## VPS deployment shape

The public browser should talk to one URL:

```text
https://assetflow.outmazed.com
```

nginx inside the frontend container serves the React app and forwards `/api/*` to the backend container. MongoDB is only reachable inside Docker.

## Bluehost VPS steps

On the VPS:

```bash
git clone <your-repo-url> AssetFlow
cd AssetFlow
cp .env.example .env
```

Edit `.env`:

```text
FRONTEND_PORT=80
JWT_SECRET=<long-random-secret>
CORS_ORIGINS=https://assetflow.outmazed.com,http://assetflow.outmazed.com
```

Then run:

```bash
docker compose up --build -d
docker compose ps
```

Point the DNS `A` record for `assetflow.outmazed.com` to the VPS public IP.

## Updating the VPS later

```bash
cd AssetFlow
git pull
docker compose up --build -d
```

## Data persistence

Docker volumes store:

- MongoDB data: `assetflow_mongodb_data`
- Uploaded files: `assetflow_backend_uploads`

Do not remove these volumes unless you intentionally want to reset production data.
