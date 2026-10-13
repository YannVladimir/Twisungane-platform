# Twisungane — Production Deployment Guide

> **Stack:** Spring Boot 3.4.3 / Java 21 · React 19 / Vite · PostgreSQL · Nginx · AlmaLinux 9  
> **Server:** `162.0.231.119` · **Domain:** `twisungane.online`  
> **SSH:** `root@162.0.231.119` port `22`

---

## PART A — FIRST-TIME SERVER SETUP

> Run this once on a fresh AlmaLinux 9 VPS. Skip to Part B for subsequent deployments.

---

### A1. Change Root Password (Do This Immediately)

Your Namecheap-issued temporary password must be changed on first login.

```bash
ssh root@162.0.231.119
# Enter temporary password when prompted
passwd
# Type new strong password twice
```

Also change the VPS panel password at https://vpspanel.web-hosting.com

---

### A2. Update the System

```bash
dnf update -y
dnf install -y epel-release
```

---

### A3. Install Java 21

```bash
dnf install -y java-21-openjdk-headless
java -version
# Should output: openjdk version "21.x.x"
```

---

### A4. Install PostgreSQL

```bash
dnf install -y postgresql-server postgresql-contrib
postgresql-setup --initdb
systemctl enable postgresql
systemctl start postgresql
systemctl status postgresql   # confirm it's running
```

---

### A5. Install Nginx

```bash
dnf install -y nginx
systemctl enable nginx
systemctl start nginx
```

---

### A6. Configure Firewall

AlmaLinux 9 uses `firewalld`. Open only the ports you need:

```bash
firewall-cmd --permanent --add-service=ssh
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload
firewall-cmd --list-all   # verify
```

---

### A7. Allow Nginx to Proxy to Localhost (SELinux)

AlmaLinux 9 has SELinux enabled. Without this, Nginx cannot forward requests to Spring Boot:

```bash
setsebool -P httpd_can_network_connect 1
```

---

### A8. Create the Database

```bash
# Become the postgres unix user
sudo -u postgres psql

-- Inside psql:
CREATE USER twisungane WITH PASSWORD 'REPLACE_WITH_STRONG_DB_PASSWORD';
CREATE DATABASE twisungane OWNER twisungane;
GRANT ALL PRIVILEGES ON DATABASE twisungane TO twisungane;
\q
```

> **Important:** Replace `REPLACE_WITH_STRONG_DB_PASSWORD` with a real password and note it — you'll need it in A10.

PostgreSQL on AlmaLinux uses `ident` authentication by default. Change it to `md5` (or `scram-sha-256`) so password login works:

```bash
# Find the pg_hba.conf file
sudo -u postgres psql -c "SHOW hba_file;"
# Typically: /var/lib/pgsql/data/pg_hba.conf

nano /var/lib/pgsql/data/pg_hba.conf
```

Find these lines and change `ident` to `md5`:
```
# Before:
local   all             all                                     peer
host    all             all             127.0.0.1/32            ident

# After:
local   all             all                                     md5
host    all             all             127.0.0.1/32            md5
```

```bash
systemctl restart postgresql
# Test the connection:
psql -U twisungane -d twisungane -h 127.0.0.1 -W
# Enter the password you set; type \q to exit
```

---

### A9. application.yml — Already Configured

The following is already in the codebase. No manual edits needed:

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/twisungane
    username: ${DB_USER:postgres}       # set DB_USER=twisungane in .env
    password: ${DB_PASSWORD:postgres}   # set DB_PASSWORD in .env

twisungane:
  encryption:
    key: ${TWISUNGANE_ENCRYPTION_KEY:...}
  cookie:
    secure: ${COOKIE_SECURE:false}      # set COOKIE_SECURE=true in .env
```

All secrets come from `/opt/twisungane/.env` on the server.

---

### A10. Create the App Directory & Environment File

```bash
# Create directory structure
mkdir -p /opt/twisungane
mkdir -p /var/www/twisungane
mkdir -p /opt/twisungane/uploads   # for file attachments

# Create the environment file — contains all secrets
nano /opt/twisungane/.env
```

Paste the following into `.env` (replace all placeholder values):

```
DB_URL=jdbc:postgresql://localhost:5432/twisungane_prod
DB_USER=twisungane_user
DB_PASSWORD=REPLACE_WITH_STRONG_DB_PASSWORD

# Generate with: openssl rand -hex 32
JWT_SECRET=REPLACE_WITH_64_CHAR_HEX

# Encrypts PII (name, nationalId, phone). NEVER change after data is stored.
ENCRYPTION_SECRET_KEY=REPLACE_WITH_DIFFERENT_64_CHAR_HEX

ALLOWED_ORIGINS=https://twisungane.online
SPRING_PROFILES_ACTIVE=prod
```

To generate strong hex secrets on the server:
```bash
openssl rand -hex 32   # run twice — once for JWT_SECRET, once for ENCRYPTION_KEY
```

Lock down the file:
```bash
chmod 600 /opt/twisungane/.env
```

---

### A11. Create systemd Service

```bash
nano /etc/systemd/system/twisungane.service
```

Paste:

```ini
[Unit]
Description=Twisungane SACCO Application
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
WorkingDirectory=/opt/twisungane
ExecStart=/usr/bin/java -jar /opt/twisungane/twisungane.jar
EnvironmentFile=/opt/twisungane/.env
Restart=on-failure
RestartSec=15
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable twisungane
```

---

### A12. Configure Nginx

```bash
nano /etc/nginx/conf.d/twisungane.conf
```

Paste (HTTP only for now — HTTPS added after SSL cert):

```nginx
server {
    listen 80;
    server_name twisungane.online www.twisungane.online;

    root /var/www/twisungane;
    index index.html;

    # React SPA — all non-API routes served by index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API & auth calls to Spring Boot
    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        client_max_body_size 25M;
    }

    # File uploads served directly
    location /uploads/ {
        alias /opt/twisungane/uploads/;
    }
}
```

```bash
nginx -t          # test config — must say "syntax is ok"
systemctl reload nginx
```

---

### A13. Point DNS to Your Server

In your **Namecheap domain dashboard** for `twisungane.online`, add/update these records:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A | @ | 162.0.231.119 | Automatic |
| A | www | 162.0.231.119 | Automatic |

Wait 5–30 minutes for DNS to propagate. Verify:
```bash
nslookup twisungane.online
# Should return 162.0.231.119
```

---

### A14. Install SSL Certificate (Let's Encrypt)

Run this **after DNS is pointing to your server**:

```bash
dnf install -y certbot python3-certbot-nginx
certbot --nginx -d twisungane.online -d www.twisungane.online \
        --non-interactive --agree-tos --email YOUR_EMAIL_HERE \
        --redirect
```

Certbot will:
1. Verify domain ownership via HTTP challenge
2. Issue the certificate
3. Auto-update your nginx config with HTTPS and HTTP→HTTPS redirect

Test auto-renewal:
```bash
certbot renew --dry-run
```

After SSL is live, the Nginx config will be updated automatically by Certbot to look like:

```nginx
server {
    listen 443 ssl;
    server_name twisungane.online www.twisungane.online;
    # ... (managed by Certbot)
    
    root /var/www/twisungane;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        client_max_body_size 25M;
    }
}

server {
    listen 80;
    server_name twisungane.online www.twisungane.online;
    return 301 https://$host$request_uri;
}
```

---

## PART B — DEPLOY AN UPDATE (Run Every Time You Release Changes)

> **Server paths (do not change these):**
> - JAR: `/opt/twisungane/app.jar`
> - Frontend: `/opt/twisungane/frontend/`
> - Service name: `twisungane` · Service user: `twisungane`

---

### Step 1 — Build locally (Windows PowerShell)

Open **two PowerShell windows** in the project root and run both at the same time:

**Window 1 — Frontend:**
```powershell
cd C:\Users\Yanba\Desktop\Twisungane\Twisungane\frontend
npm install
npm run build
```
Verify `frontend\dist\index.html` exists when done.

**Window 2 — Backend:**
```powershell
cd C:\Users\Yanba\Desktop\Twisungane\Twisungane\backend
mvn clean package -DskipTests
```
Verify `backend\target\twisungane-1.0.0-SNAPSHOT.jar` exists when done.

---

### Step 2 — Transfer files to the server (Windows PowerShell, project root)

```powershell
# Create staging directory on the server
ssh root@162.0.231.119 "mkdir -p /tmp/tw-dist"

# Upload the JAR
scp backend\target\twisungane-1.0.0-SNAPSHOT.jar root@162.0.231.119:/opt/twisungane/app-new.jar

# Upload the frontend
scp -r frontend\dist\* root@162.0.231.119:/tmp/tw-dist/
```

---

### Step 3 — SSH into the server

```powershell
ssh root@162.0.231.119
```

---

### Step 4 — Stop the service

```bash
systemctl stop twisungane
```

Expected output includes `Stopped Twisungane` — status 143 (SIGTERM) is normal and means clean shutdown.

---

### Step 5 — Deploy the new JAR

```bash
mv /opt/twisungane/app.jar /opt/twisungane/app.jar.bak
mv /opt/twisungane/app-new.jar /opt/twisungane/app.jar
chown twisungane:twisungane /opt/twisungane/app.jar
```

If asked `overwrite app.jar.bak?` — type `y` and Enter (safe to overwrite the old backup).

---

### Step 6 — Deploy the new frontend

```bash
rm -rf /opt/twisungane/frontend/*
cp -r /tmp/tw-dist/* /opt/twisungane/frontend/
rm -rf /tmp/tw-dist

# Fix permissions — nginx must be able to read these files
find /opt/twisungane/frontend -type d -exec chmod 755 {} \;
find /opt/twisungane/frontend -type f -exec chmod 644 {} \;
chown -R twisungane:twisungane /opt/twisungane/frontend/

nginx -t && systemctl reload nginx
```

---

### Step 7 — Start the service and watch logs

```bash
systemctl start twisungane
journalctl -u twisungane -f
```

Wait for this line:
```
Started TwisunganeApplication in X.XXX seconds
```

Press `Ctrl+C` to stop watching once you see it.

If there are new Flyway migration scripts, you'll also see:
```
Successfully applied N migration(s) to schema "public"
```
before the started message — that's normal, it means the DB schema was updated.

---

### Step 8 — Verify

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/api/v1/auth/health
# Should return 200 or 404 — anything except 500
```

Then open `https://twisungane.online` in a browser:
- Login page loads with no blank screen and no console errors
- Log in and confirm the main pages load correctly

---

## PART C — FRESH DATABASE (First Deployment / Full Reset)

> Use this when starting with a completely empty database.

```bash
# On the server — drop and recreate clean
sudo -u postgres psql <<'EOF'
DROP DATABASE IF EXISTS twisungane;
CREATE DATABASE twisungane OWNER twisungane;
GRANT ALL PRIVILEGES ON DATABASE twisungane TO twisungane;
EOF
```

Then start the backend — Flyway will automatically run all migration scripts
(`V1__baseline.sql`, `V2__add_member_hash_columns.sql`, etc.) to build the schema from scratch.

```bash
systemctl start twisungane
journalctl -u twisungane -f
# Watch for: "Successfully applied N migration(s)" then "Started TwisunganeApplication"
```

---

## PART D — ROLLBACK

### Frontend rollback
```bash
# Quick: just re-deploy the previous dist from your local machine (Section B2–B4)
```

### Backend rollback
```bash
systemctl stop twisungane
mv /opt/twisungane/twisungane.jar.bak /opt/twisungane/twisungane.jar
systemctl start twisungane
journalctl -u twisungane -f
```

### Database rollback (use only if schema corruption)
```bash
systemctl stop twisungane
sudo -u postgres psql <<'EOF'
DROP DATABASE twisungane;
CREATE DATABASE twisungane OWNER twisungane;
EOF
psql -U twisungane -d twisungane -h 127.0.0.1 -W < ~/backups/twisungane_<timestamp>.sql
systemctl start twisungane
```

---

## PART E — ENVIRONMENT VARIABLES REFERENCE

| Variable | Used In | Notes |
|---|---|---|
| `DB_PASSWORD` | `application.yml` datasource | PostgreSQL password for `twisungane` user |
| `JWT_SECRET` | `JwtUtil` | 64-char hex. Used to sign/verify JWT tokens. |
| `TWISUNGANE_ENCRYPTION_KEY` | `EncryptionConverter`, `HmacUtil` | 64-char hex. Encrypts PII (name, nationalId, phone). **Never change after data is stored.** |
| `COOKIE_SECURE` | `application.yml` cookie config | Set to `true` in production (requires HTTPS) |

Generate secrets:
```bash
openssl rand -hex 32   # → 64-char hex string
```

---

## PART F — USEFUL SERVER COMMANDS

```bash
# Check app logs
journalctl -u twisungane -f
journalctl -u twisungane --since "1 hour ago"

# Check Nginx logs
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log

# Check database
psql -U twisungane -d twisungane -h 127.0.0.1 -W

# Check what's listening on port 8080
ss -tlnp | grep 8080

# Check service status
systemctl status twisungane
systemctl status nginx
systemctl status postgresql

# Disk space
df -h

# Check SSL cert expiry
certbot certificates
```

---

## PART G — SECURITY HARDENING (Recommended After First Deploy)

```bash
# 1. Disable password SSH — use key-based auth instead
# First: copy your public key to the server
ssh-copy-id root@162.0.231.119
# Then in /etc/ssh/sshd_config:
# PasswordAuthentication no
# systemctl restart sshd

# 2. Fail2ban — auto-ban brute-force SSH attempts
dnf install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban

# 3. Keep packages updated
dnf update -y
```

---

## Change Log

| Date | Description |
|------|-------------|
| 2026-05-28 | Initial first-time deployment guide written for AlmaLinux 9 VPS |
