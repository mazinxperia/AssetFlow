# AssetFlow Local Docker Setup

This guide explains how to run AssetFlow on your own computer using Docker.

You do not need to install Python, Node.js, MongoDB, npm packages, or create virtual environments manually. Docker builds and runs everything for you.

## What This Setup Runs

AssetFlow runs as three Docker services:

| Service | Container name | Purpose |
| --- | --- | --- |
| `frontend` | `assetflow-frontend` | Serves the React app with nginx |
| `backend` | `assetflow-backend` | Runs the FastAPI API server |
| `mongodb` | `assetflow-mongodb` | Stores app data in MongoDB |

The browser talks to one local address:

```text
http://localhost:8080
```

The frontend container also forwards API requests to the backend container:

```text
Browser -> frontend nginx -> backend API -> MongoDB
```

MongoDB is not exposed directly to your computer. It is only available inside the Docker network.

## Requirements

Install these first:

| Requirement | Why it is needed |
| --- | --- |
| Docker Desktop | Runs the app containers |
| Git | Downloads or updates the project |
| 4 GB free RAM minimum | Docker needs memory for MongoDB, backend, and frontend |
| 2 GB free disk space minimum | Images, builds, uploads, and database volume |

Recommended:

| Requirement | Recommended |
| --- | --- |
| RAM | 8 GB or more |
| Disk space | 5 GB or more |
| Docker Desktop | Latest stable version |

## Install Docker Desktop

### Windows

1. Download Docker Desktop from:

```text
https://www.docker.com/products/docker-desktop/
```

2. Install Docker Desktop.
3. Restart your computer if Docker asks.
4. Open Docker Desktop.
5. Wait until Docker says it is running.

Check Docker from PowerShell:

```powershell
docker --version
docker compose version
```

Both commands should print versions.

### macOS

1. Download Docker Desktop from:

```text
https://www.docker.com/products/docker-desktop/
```

2. Install Docker Desktop.
3. Open Docker Desktop.
4. Wait until Docker says it is running.

Check Docker from Terminal:

```bash
docker --version
docker compose version
```

### Linux

Install Docker Engine and the Docker Compose plugin using your Linux distribution's official Docker instructions.

After installing, check:

```bash
docker --version
docker compose version
```

If Linux says permission denied when running Docker, add your user to the Docker group or run commands with `sudo`.

## Get The Project

Clone the project:

```bash
git clone https://github.com/mazinxperia/AssetFlow.git
cd AssetFlow
```

If you already have the project folder, open a terminal inside the project root. The project root is the folder that contains:

```text
docker-compose.yml
backend/
frontend/
README.md
```

## Create Local Environment File

The repository includes `.env.example`. Copy it to `.env`.

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS or Linux:

```bash
cp .env.example .env
```

Default local `.env` values:

```env
FRONTEND_PORT=8080
JWT_SECRET=replace-with-a-long-random-secret
CORS_ORIGINS=http://localhost:8080,http://localhost
```

For local testing, this is enough. For anything public or shared, replace `JWT_SECRET` with a long random value.

Example strong local secret:

```env
JWT_SECRET=assetflow-local-change-this-to-a-long-random-secret-123456789
```

## Start AssetFlow

Run this from the project root:

```bash
docker compose up --build -d
```

What this command does:

| Part | Meaning |
| --- | --- |
| `docker compose` | Uses `docker-compose.yml` |
| `up` | Starts the services |
| `--build` | Builds frontend and backend images from the Dockerfiles |
| `-d` | Runs containers in the background |

The first build can take a few minutes because Docker downloads base images and installs dependencies.

## Check Containers

Run:

```bash
docker compose ps
```

Expected containers:

```text
assetflow-mongodb
assetflow-backend
assetflow-frontend
```

Healthy/running state should look similar to:

```text
assetflow-mongodb    Up ... (healthy)
assetflow-backend    Up ... (healthy)
assetflow-frontend   Up ...
```

The frontend container does not need a health label. If it is `Up`, it is running.

## Open The App

Open:

```text
http://localhost:8080
```

Default first login on a fresh database:

```text
Email:    admin@local.internal
Password: Admin123!
```

Change this password before using the app seriously.

## Health Checks

Frontend/nginx health route:

```text
http://localhost:8080/health
```

Backend API health route through the frontend proxy:

```text
http://localhost:8080/api/health
```

PowerShell:

```powershell
Invoke-RestMethod http://localhost:8080/api/health
```

macOS/Linux:

```bash
curl http://localhost:8080/api/health
```

Expected result:

```json
{"status":"healthy"}
```

The response may also include a timestamp.

## Useful Docker Commands

### View Running Containers

```bash
docker compose ps
```

### View Logs

All logs:

```bash
docker compose logs -f
```

Backend only:

```bash
docker compose logs -f backend
```

Frontend only:

```bash
docker compose logs -f frontend
```

MongoDB only:

```bash
docker compose logs -f mongodb
```

Stop watching logs with:

```text
Ctrl+C
```

### Stop The App

```bash
docker compose down
```

This stops and removes containers, but it keeps your database and uploaded files in Docker volumes.

### Start Again Later

```bash
docker compose up -d
```

Use `--build` again only when code or dependencies changed:

```bash
docker compose up --build -d
```

### Restart One Service

Backend:

```bash
docker compose restart backend
```

Frontend:

```bash
docker compose restart frontend
```

MongoDB:

```bash
docker compose restart mongodb
```

### Rebuild After Code Changes

```bash
docker compose up --build -d
```

If Docker cache seems stale:

```bash
docker compose build --no-cache
docker compose up -d
```

## Where Data Is Stored

AssetFlow local Docker data is stored in Docker volumes:

| Volume | Stores |
| --- | --- |
| `assetflow_mongodb_data` or `<folder>_mongodb_data` | MongoDB database data |
| `assetflow_backend_uploads` or `<folder>_backend_uploads` | Uploaded files |

Docker volume names can include the project folder name. For example, if the folder is named `Official Repo`, Docker may create names based on the normalized Compose project name.

List volumes:

```bash
docker volume ls
```

Inspect a volume:

```bash
docker volume inspect officialrepo_mongodb_data
```

## Important: Do Not Delete Volumes Accidentally

This command is safe for normal stopping:

```bash
docker compose down
```

This command deletes local app data:

```bash
docker compose down -v
```

Only use `docker compose down -v` if you intentionally want to reset the database and uploaded files.

## Reset Local Data Completely

If you want a clean fresh database:

```bash
docker compose down -v
docker compose up --build -d
```

After reset, the app will recreate the default admin account:

```text
Email:    admin@local.internal
Password: Admin123!
```

## Change The Local Port

By default the app uses:

```text
http://localhost:8080
```

To use another port, edit `.env`:

```env
FRONTEND_PORT=8081
```

Then restart:

```bash
docker compose up -d
```

Open:

```text
http://localhost:8081
```

Also update `CORS_ORIGINS` if needed:

```env
CORS_ORIGINS=http://localhost:8081,http://localhost
```

Then rebuild/restart:

```bash
docker compose up --build -d
```

## How The Services Connect

The Docker Compose file creates a private network:

```text
assetflow-network
```

Inside that network:

| From | To | Address |
| --- | --- | --- |
| Backend | MongoDB | `mongodb://mongodb:27017` |
| Frontend nginx | Backend | `http://backend:8001` |
| Browser | Frontend | `http://localhost:8080` |

That is why you do not need a MongoDB Atlas URI for local Docker.

## Environment Variables Used By Docker

From `.env`:

| Variable | Used by | Meaning |
| --- | --- | --- |
| `FRONTEND_PORT` | Docker Compose frontend port mapping | Host port for the web app |
| `JWT_SECRET` | Backend | Secret used to sign login tokens |
| `CORS_ORIGINS` | Backend | Allowed browser origins |

Set directly in `docker-compose.yml`:

| Variable | Value |
| --- | --- |
| `MONGODB_URI` | `mongodb://mongodb:27017` |
| `DB_NAME` | `assetflow` |

## Updating The Local App

If you cloned from GitHub:

```bash
git pull
docker compose up --build -d
```

If package dependencies or Dockerfiles changed, the same command is enough.

If you want to see logs after updating:

```bash
docker compose logs -f backend frontend mongodb
```

## Common Problems

### Docker Is Not Running

Error examples:

```text
Cannot connect to the Docker daemon
```

Fix:

1. Open Docker Desktop.
2. Wait until Docker says it is running.
3. Run the command again.

### Port 8080 Is Already Used

Error example:

```text
Bind for 0.0.0.0:8080 failed: port is already allocated
```

Fix:

Edit `.env`:

```env
FRONTEND_PORT=8081
CORS_ORIGINS=http://localhost:8081,http://localhost
```

Then run:

```bash
docker compose up -d
```

Open:

```text
http://localhost:8081
```

### Backend Is Not Healthy

Check backend logs:

```bash
docker compose logs backend
```

Common causes:

| Cause | Fix |
| --- | --- |
| MongoDB is still starting | Wait 20-40 seconds, then run `docker compose ps` again |
| Bad `.env` formatting | Check `.env` has no quotes unless needed |
| Docker build failed | Run `docker compose up --build -d` again and check output |

### Login Page Shows But Login Fails

Check API health:

```bash
curl http://localhost:8080/api/health
```

If API health fails:

```bash
docker compose logs backend
docker compose logs frontend
```

If API health works but login fails, make sure you are using the default account only on a fresh database:

```text
Email:    admin@local.internal
Password: Admin123!
```

If you changed the password earlier, the old default password will no longer work.

### Blank Page Or Old Frontend

Rebuild frontend:

```bash
docker compose up --build -d frontend
```

If still stale, rebuild all:

```bash
docker compose build --no-cache
docker compose up -d
```

### MongoDB Data Looks Old

Docker keeps MongoDB in a volume. Stopping containers does not delete the database.

To reset completely:

```bash
docker compose down -v
docker compose up --build -d
```

## Local Development Notes

This Docker setup is designed to run the production-style app locally:

- React is built into static files.
- nginx serves the frontend.
- nginx proxies `/api/*` to the backend.
- Backend runs with Uvicorn.
- MongoDB runs in its own container.

This is different from old manual development where frontend ran on `localhost:3000` and backend ran on `localhost:8001` directly on your computer.

For normal use, screenshots, testing, and VPS rehearsal, use Docker.

## Quick Command Summary

```bash
cp .env.example .env
docker compose up --build -d
docker compose ps
```

Open:

```text
http://localhost:8080
```

Stop:

```bash
docker compose down
```

Reset all local data:

```bash
docker compose down -v
docker compose up --build -d
```
