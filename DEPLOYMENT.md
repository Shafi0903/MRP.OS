# Production Deployment Guide — MRP.OS

This guide covers deploying the **MRP.OS Enterprise Material Requirements Planning System** in production using Docker & Docker Compose, as well as on cloud Virtual Private Servers (VPS) and cloud platform providers (PaaS).

---

## 1. System Architecture in Production

```mermaid
flowchart TD
    Client["User Browser / Client"] -- Port 80 / 443 --> Nginx["Frontend Container (Nginx Alpine)"]
    
    subgraph MRP Docker Network ["Docker Network: mrp_network"]
        Nginx -- Static SPA files (React 18) --> Cache["Asset Cache"]
        Nginx -- Reverse Proxy (/api/ & /docs) --> Backend["FastAPI Application (Uvicorn)"]
        Backend -- DB Connection (SQLAlchemy 2.x) --> DB[("PostgreSQL 16 Alpine")]
    end
```

### Key Production Highlights:
1. **Single Entry Point**: The frontend container (Nginx) listens on port `80` (or your configured `$PORT`), serves the compiled React Single Page Application (SPA), and reverse-proxies `/api/`, `/docs`, `/redoc`, and `/openapi.json` directly to the internal FastAPI backend on port `8000`.
2. **Zero CORS Issues**: Browser makes all requests directly to the same origin (`/api/v1/...`), eliminating cross-origin errors in production.
3. **Automated Migrations & Seeding**: The backend container automatically applies Alembic migrations (`alembic upgrade head`) and seeds initial demo data (`scripts/seed_demo.py`) safely on startup.
4. **Health Checks**: PostgreSQL, FastAPI, and Nginx all include container-level healthchecks to ensure high availability and graceful restarts.

---

## 2. Quick Start: 1-Command Deployment

### Prerequisites
- Docker Engine (v24.0+)
- Docker Compose (v2.20+)

### Step 1: Clone & Navigate
```bash
git clone <your-repository-url>
cd "Material Requirements Processing(MRP)"
```

### Step 2: Configure Environment
Copy the example environment file:
```bash
cp .env.example .env
```
*(Optional)* Edit `.env` to update `POSTGRES_PASSWORD` or change `PORT=80` to another port like `PORT=3000` if port 80 is occupied.

### Step 3: Launch Containers

#### Option A: PostgreSQL Production Mode (Recommended)
```bash
./deploy.sh
# OR manually:
docker compose up -d --build
```

#### Option B: Lightweight SQLite Mode (Ideal for 512MB/1GB RAM servers)
```bash
./deploy.sh sqlite
# OR manually:
docker compose -f docker-compose.sqlite.yml up -d --build
```

### Step 4: Verify Deployment
Open your browser and navigate to:
- **Application Dashboard:** `http://<your-server-ip>/` (or `http://localhost/`)
- **Interactive API Docs (Swagger):** `http://<your-server-ip>/docs`
- **Alternative Docs (ReDoc):** `http://<your-server-ip>/redoc`
- **Backend Health Check:** `http://<your-server-ip>/api/health`

---

## 3. Useful Operational Commands

### View Service Logs
```bash
# View real-time logs for all services
./deploy.sh logs
# or
docker compose logs -f

# View only backend service logs
docker compose logs -f backend
```

### Stop Services
```bash
./deploy.sh stop
# or
docker compose down
```

### Restart Services
```bash
docker compose restart
```

### Apply New Database Migrations
Migrations run automatically on container restart. To run migrations manually inside the running backend container:
```bash
docker compose exec backend alembic upgrade head
```

### Re-seed Indian Manufacturing Demo Data
```bash
docker compose exec backend python scripts/seed_demo.py
```

---

## 4. Deploying to a Cloud VPS (Ubuntu / Debian / AWS EC2 / DigitalOcean)

### Step 1: Install Docker & Docker Compose
```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

### Step 2: Clone & Deploy
```bash
git clone <repo-url> mrp
cd mrp
cp .env.example .env
docker compose up -d --build
```

### Step 3: Setting Up Free HTTPS with Let's Encrypt / Certbot
If you have a domain name (e.g. `mrp.yourdomain.com`):
1. Point your domain DNS A-record to your VPS IP address.
2. In `docker-compose.yml`, change host port to `8080:80`.
3. Install host Nginx and Certbot:
```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
```
4. Create an Nginx site configuration at `/etc/nginx/sites-available/mrp`:
```nginx
server {
    server_name mrp.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
5. Enable site and request SSL certificate:
```bash
sudo ln -s /etc/nginx/sites-available/mrp /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d mrp.yourdomain.com
```

---

## 5. Global Edge & Multi-Region Deployment

For global accessibility with sub-100ms response times worldwide, deploy the Presentation Tier on a **Global Edge CDN** and the Application/Data Tier on an autoscaling cloud runtime:

```mermaid
flowchart LR
    subgraph Global Edge Network ["Global CDN & Edge (Anycast DNS / SSL)"]
        Users["Global Users"] --> CF["Cloudflare / Vercel Edge"]
        CF -- Static Assets (React SPA) --> EdgeCache["300+ Edge POPs"]
    end

    subgraph Cloud Region ["Application Tier (FastAPI & DB)"]
        CF -- Dynamic API Calls (/api/v1) --> Backend["FastAPI on Render / Fly.io / AWS"]
        Backend --> DB[("PostgreSQL (Neon / Supabase / AWS Aurora)")]
    end
```

### Strategy 1: Vercel (Frontend CDN) + Render (Backend & Postgres) [Recommended & Free-Tier Friendly]

#### 1. Deploy Frontend on Vercel:
1. Push your repository to GitHub.
2. Import the repository in [Vercel](https://vercel.com).
3. Set **Root Directory** to `frontend`.
4. Add Environment Variable:
   - `VITE_API_BASE_URL` = `https://mrp-backend.onrender.com/api/v1`
5. Click **Deploy**. Vercel distributes the React SPA across 300+ edge locations with automated HTTPS.

#### 2. Deploy Backend & Database via Render Blueprint:
1. In [Render Dashboard](https://dashboard.render.com), go to **Blueprints**.
2. Connect your repository. Render detects [`render.yaml`](render.yaml) automatically and provisions:
   - A managed PostgreSQL database instance.
   - A FastAPI Web Service with automated migrations and demo seeding.
3. Click **Apply**.

---

### Strategy 2: Fly.io (Global MicroVMs) + Neon / Supabase Serverless Postgres

#### 1. Database:
Create a serverless Postgres instance on [Neon](https://neon.tech) or [Supabase](https://supabase.com). Copy the PostgreSQL connection string.

#### 2. Backend on Fly.io:
```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Authenticate & Launch
fly auth login
fly launch --config fly.toml --no-deploy

# Set production database secret
fly secrets set DATABASE_URL="postgresql+psycopg2://user:password@ep-cool-db.neon.tech/mrp?sslmode=require" SECRET_KEY="generate_a_random_key"

# Deploy across edge regions (e.g., Singapore, Frankfurt, Virginia)
fly deploy
fly scale count 2 --region sin,fra
```

---

### Strategy 3: Cloudflare CDN + Custom Domain for Any Cloud VPS

1. Add your domain to [Cloudflare](https://www.cloudflare.com) (free plan).
2. Point your DNS A record (`mrp.yourdomain.com`) to your server's IP address with **Cloudflare Proxy Enabled (Orange Cloud)**.
3. Under **SSL/TLS**, set encryption mode to **Full (Strict)**.
4. Benefits:
   - **Global Anycast Edge CDN** caches assets in 300+ cities.
   - **Automated Free TLS/SSL** without managing local renewal crons.
   - **DDoS Mitigation & Web Application Firewall (WAF)**.
   - **HTTP/3 & Brotli Compression** enabled out of the box.

---

## 6. Database Backup & Restore
   - Environment variables:
     - `DATABASE_URL`: Your Render PostgreSQL External/Internal URL
     - `CORS_ORIGINS`: `["https://your-frontend.vercel.app"]`
3. **Frontend on Vercel / Netlify:**
   - Root directory: `frontend`
   - Build command: `npm run build`
   - Output directory: `dist`
   - Environment variable:
     - `VITE_API_BASE_URL`: `https://your-backend.onrender.com/api/v1`

---

## 6. Database Backup & Restore

### PostgreSQL Automated Backup
```bash
docker compose exec -t db pg_dump -U mrp_user mrp > mrp_backup_$(date +%Y%m%d_%H%M%S).sql
```

### PostgreSQL Restore
```bash
cat mrp_backup.sql | docker compose exec -T db psql -U mrp_user -d mrp
```

### SQLite Backup
If using `docker-compose.sqlite.yml`, copy `mrp.db` from the named volume:
```bash
docker compose -f docker-compose.sqlite.yml cp backend:/app/data/mrp.db ./mrp_backup_$(date +%Y%m%d).db
```

---

## 7. Verification Checklist

- [ ] Frontend loads dashboard at `http://<host>:<port>` with INR currency and KPIs.
- [ ] Backend health endpoint `http://<host>:<port>/api/health` returns `{"status": "healthy"}`.
- [ ] Swagger API documentation accessible at `/docs`.
- [ ] BOM explosion and cycle detection verify without errors.
- [ ] Inventory ledger transactions and Purchase Order transitions persist across restarts.
