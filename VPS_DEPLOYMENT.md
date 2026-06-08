# AssetFlow VPS Docker Deployment

This guide explains how to deploy AssetFlow on a VPS using Docker Compose.

The current deployment model is:

```text
User Browser
    |
    v
VPS Public IP / Domain
    |
    v
assetflow-frontend container
    |
    |-- serves React frontend
    |
    |-- proxies /api/* requests
            |
            v
        assetflow-backend container
            |
            v
        assetflow-mongodb container
```

The app uses local MongoDB inside Docker by default. MongoDB Atlas is not required for the standard VPS deployment.

## What This Deployment Gives You

| Part | Details |
| --- | --- |
| Frontend | React production build served by nginx |
| Backend | FastAPI served by Uvicorn |
| Database | MongoDB 7 running as a Docker container |
| Public port | Usually `80` on the VPS |
| Internal backend port | `8001`, Docker network only |
| Internal MongoDB port | `27017`, Docker network only |
| Persistent database | Docker volume |
| Persistent uploads | Docker volume |

## Required VPS Specs

Minimum:

| Resource | Minimum |
| --- | --- |
| RAM | 2 GB |
| CPU | 1 vCPU |
| Disk | 20 GB |
| OS | Ubuntu 22.04 LTS or Ubuntu 24.04 LTS |

Recommended:

| Resource | Recommended |
| --- | --- |
| RAM | 4 GB or more |
| CPU | 2 vCPU |
| Disk | 40 GB or more |
| OS | Ubuntu 24.04 LTS |

## Required Domain/DNS

You can deploy in two ways:

| Method | Example |
| --- | --- |
| IP only | `http://123.123.123.123` |
| Domain | `http://assetflow.example.com` or `https://assetflow.example.com` |

For production, use a domain.

Create a DNS `A` record:

```text
Type: A
Name: assetflow
Value: your_vps_public_ip
```

Example:

```text
assetflow.example.com -> 123.123.123.123
```

DNS can take a few minutes to several hours to update.

## Connect To The VPS

From your computer:

```bash
ssh root@your_vps_public_ip
```

Or, if you use a non-root user:

```bash
ssh your_user@your_vps_public_ip
```

## Install System Updates

On the VPS:

```bash
sudo apt update
sudo apt upgrade -y
```

Install basic tools:

```bash
sudo apt install -y ca-certificates curl git ufw
```

## Install Docker

Install Docker using Docker's official repository:

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

Add Docker repository:

```bash
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo ${UBUNTU_CODENAME:-$VERSION_CODENAME}) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

Install Docker:

```bash
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Check Docker:

```bash
docker --version
docker compose version
```

Enable Docker on boot:

```bash
sudo systemctl enable docker
sudo systemctl start docker
```

Optional: allow your current user to run Docker without `sudo`:

```bash
sudo usermod -aG docker $USER
```

Then log out and log back in.

## Configure Firewall

Allow SSH and web traffic:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Check status:

```bash
sudo ufw status
```

## Download AssetFlow

Choose a deployment folder:

```bash
cd /opt
sudo git clone https://github.com/mazinxperia/AssetFlow.git assetflow
sudo chown -R $USER:$USER /opt/assetflow
cd /opt/assetflow
```

If the repo is private, configure GitHub SSH access or clone using a method you normally use for private repositories.

## Create The VPS Environment File

Copy the example:

```bash
cp .env.example .env
```

Edit it:

```bash
nano .env
```

Recommended VPS `.env` for HTTP deployment:

```env
FRONTEND_PORT=80
JWT_SECRET=replace-this-with-a-long-random-production-secret
CORS_ORIGINS=http://your-domain.com,http://your_vps_public_ip
```

Recommended VPS `.env` for HTTPS/domain deployment:

```env
FRONTEND_PORT=80
JWT_SECRET=replace-this-with-a-long-random-production-secret
CORS_ORIGINS=https://your-domain.com,http://your-domain.com
```

Example:

```env
FRONTEND_PORT=80
JWT_SECRET=8e6dd3e36d9bdf18f4b4ad8bb2d3c6770f13cf42a9314cc5a53f65d44dbbdf20
CORS_ORIGINS=https://assetflow.example.com,http://assetflow.example.com
```

Generate a strong JWT secret:

```bash
openssl rand -hex 32
```

Copy the output into `JWT_SECRET`.

Important:

- Do not use the default `replace-with-a-long-random-secret` in production.
- Do not commit `.env` to GitHub.
- If you change `JWT_SECRET`, existing login tokens become invalid and users must log in again.

## Start The App

Run from `/opt/assetflow`:

```bash
docker compose up --build -d
```

Check containers:

```bash
docker compose ps
```

Expected containers:

```text
assetflow-mongodb
assetflow-backend
assetflow-frontend
```

Expected state:

```text
assetflow-mongodb    Up ... (healthy)
assetflow-backend    Up ... (healthy)
assetflow-frontend   Up ...
```

## Open The App

If using IP:

```text
http://your_vps_public_ip
```

If using domain:

```text
http://your-domain.com
```

Default first login on a fresh database:

```text
Email:    admin@local.internal
Password: Admin123!
```

Change the password immediately after first login.

## Health Checks

From the VPS:

```bash
curl http://localhost/health
curl http://localhost/api/health
```

From your computer:

```bash
curl http://your-domain.com/api/health
```

Expected result:

```json
{"status":"healthy"}
```

The response may also include a timestamp.

## Data Persistence

Docker stores production data in volumes:

| Volume | Stores |
| --- | --- |
| `assetflow_mongodb_data` or `<project>_mongodb_data` | MongoDB database |
| `assetflow_backend_uploads` or `<project>_backend_uploads` | Uploaded files |

Check volumes:

```bash
docker volume ls
```

Do not delete these volumes unless you intentionally want to wipe production data.

Safe stop:

```bash
docker compose down
```

Dangerous reset:

```bash
docker compose down -v
```

`docker compose down -v` deletes database and uploaded files.

## Updating The VPS

When new code is pushed to GitHub:

```bash
cd /opt/assetflow
git pull
docker compose up --build -d
docker compose ps
```

Check logs:

```bash
docker compose logs -f backend frontend mongodb
```

Stop watching logs:

```text
Ctrl+C
```

## Rollback Basic Approach

If a new deployment has a problem:

```bash
cd /opt/assetflow
git log --oneline -5
git checkout <previous_commit_hash>
docker compose up --build -d
```

After fixing the issue later, return to main:

```bash
git checkout main
git pull
docker compose up --build -d
```

## Backups

You should back up both:

1. MongoDB data
2. Uploaded files

### MongoDB Backup

Create a backup folder:

```bash
mkdir -p /opt/assetflow-backups
```

Run `mongodump` inside the MongoDB container:

```bash
docker exec assetflow-mongodb mongodump --db assetflow --archive=/tmp/assetflow.archive
docker cp assetflow-mongodb:/tmp/assetflow.archive /opt/assetflow-backups/assetflow-$(date +%Y-%m-%d-%H%M).archive
```

### MongoDB Restore

Copy backup into the MongoDB container:

```bash
docker cp /opt/assetflow-backups/assetflow-backup.archive assetflow-mongodb:/tmp/assetflow.archive
```

Restore:

```bash
docker exec assetflow-mongodb mongorestore --drop --archive=/tmp/assetflow.archive
```

### Uploaded Files Backup

Find the upload volume:

```bash
docker volume ls
```

Archive the upload volume:

```bash
docker run --rm -v assetflow_backend_uploads:/data -v /opt/assetflow-backups:/backup alpine tar czf /backup/assetflow-uploads-$(date +%Y-%m-%d-%H%M).tar.gz -C /data .
```

If your volume name is different, replace `assetflow_backend_uploads` with the actual volume name from `docker volume ls`.

## HTTPS Setup

There are two common ways to add HTTPS.

### Option A: Use Cloudflare

This is the simplest operational option:

1. Point your domain to Cloudflare.
2. Set DNS `A` record to the VPS IP.
3. Enable Cloudflare proxy.
4. Use Cloudflare SSL/TLS.
5. Keep AssetFlow listening on port `80` on the VPS.

Your `.env` should include the HTTPS domain:

```env
CORS_ORIGINS=https://assetflow.example.com,http://assetflow.example.com
```

### Option B: Use Host nginx + Certbot

If you want HTTPS directly on the VPS:

1. Run AssetFlow on a private host port like `8080`.
2. Install nginx on the VPS host.
3. Use Certbot to issue a Let's Encrypt certificate.
4. Reverse proxy from host nginx to `http://localhost:8080`.

Set `.env`:

```env
FRONTEND_PORT=8080
CORS_ORIGINS=https://assetflow.example.com,http://assetflow.example.com
```

Install nginx and certbot:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Create nginx site:

```bash
sudo nano /etc/nginx/sites-available/assetflow
```

Example nginx config:

```nginx
server {
    listen 80;
    server_name assetflow.example.com;

    client_max_body_size 55m;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/assetflow /etc/nginx/sites-enabled/assetflow
sudo nginx -t
sudo systemctl reload nginx
```

Issue certificate:

```bash
sudo certbot --nginx -d assetflow.example.com
```

After HTTPS works, open:

```text
https://assetflow.example.com
```

## Security Checklist

Before treating the VPS as production:

- Change the default admin password.
- Use a strong `JWT_SECRET`.
- Keep `.env` out of Git.
- Keep MongoDB inside Docker only; do not expose port `27017` publicly.
- Keep only ports `22`, `80`, and `443` open unless you need more.
- Use HTTPS for public access.
- Back up MongoDB and uploaded files.
- Update the VPS regularly.
- Restrict SSH access where possible.

## Troubleshooting

### Docker Is Not Installed

Check:

```bash
docker --version
docker compose version
```

If missing, reinstall Docker using the steps above.

### Port 80 Is Already In Use

Check:

```bash
sudo lsof -i :80
```

If host nginx or Apache is already using port `80`, either stop it or use:

```env
FRONTEND_PORT=8080
```

Then put host nginx in front of Docker.

### Backend Is Unhealthy

Check:

```bash
docker compose logs backend
docker compose logs mongodb
```

Common causes:

| Problem | Fix |
| --- | --- |
| MongoDB still starting | Wait, then run `docker compose ps` again |
| Bad `.env` | Fix `.env`, then run `docker compose up -d` |
| Build failed | Run `docker compose up --build -d` and read the error |

### Frontend Opens But Login Fails

Check:

```bash
curl http://localhost/api/health
docker compose logs backend
docker compose logs frontend
```

Make sure `CORS_ORIGINS` includes the exact browser URL.

Examples:

```env
CORS_ORIGINS=http://123.123.123.123
```

or:

```env
CORS_ORIGINS=https://assetflow.example.com,http://assetflow.example.com
```

### DNS Does Not Work

Check the domain:

```bash
dig assetflow.example.com
```

or:

```bash
nslookup assetflow.example.com
```

The result should show your VPS public IP.

### Need To See Live Logs

```bash
docker compose logs -f backend frontend mongodb
```

### Need To Restart Everything

```bash
docker compose restart
```

### Need To Rebuild Everything

```bash
docker compose up --build -d
```

### Need Full Clean Rebuild Without Deleting Data

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

This keeps volumes.

### Need Full Reset Including Data

Only do this if you want to erase the app:

```bash
docker compose down -v
docker compose up --build -d
```

## Final Deployment Command Summary

```bash
cd /opt
sudo git clone https://github.com/mazinxperia/AssetFlow.git assetflow
sudo chown -R $USER:$USER /opt/assetflow
cd /opt/assetflow
cp .env.example .env
nano .env
docker compose up --build -d
docker compose ps
```

Open:

```text
http://your-domain.com
```

or:

```text
http://your_vps_public_ip
```
