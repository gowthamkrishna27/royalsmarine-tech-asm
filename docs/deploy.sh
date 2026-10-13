#!/bin/bash
# Rupa Enterprises CRM - Hostinger VPS Deployment Script
# Run as: bash deploy.sh
# Tested on Ubuntu 22.04

set -e

APP_DIR="/var/www/rupa-crm"
DOMAIN="crm.rupaenterprises.com"

echo "=========================================="
echo "  Rupa CRM - Deployment Setup"
echo "=========================================="

# 1. System packages
echo "[1/10] Updating system packages..."
apt-get update -y && apt-get upgrade -y
apt-get install -y curl git nginx certbot python3-certbot-nginx ufw

# 2. Node.js 20.x
echo "[2/10] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node -v && npm -v

# 3. MySQL
echo "[3/10] Installing MySQL..."
apt-get install -y mysql-server
mysql_secure_installation

# 4. PM2
echo "[4/10] Installing PM2..."
npm install -g pm2
pm2 startup systemd -u www-data --hp /var/www

# 5. App directory
echo "[5/10] Setting up app directory..."
mkdir -p $APP_DIR/{backend,frontend,logs}
chown -R www-data:www-data $APP_DIR

# 6. Backend setup
echo "[6/10] Installing backend dependencies..."
cd $APP_DIR/backend
npm install --production

# 7. Database
echo "[7/10] Creating database..."
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS rupa_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
echo "  Run: cd $APP_DIR/backend && node src/database/migrate.js"
echo "  Then: node src/database/seed.js"

# 8. Frontend build
echo "[8/10] Building frontend..."
cd $APP_DIR/frontend
npm install
npm run build

# 9. Nginx
echo "[9/10] Configuring Nginx..."
cp /var/www/rupa-crm/docs/nginx.conf /etc/nginx/sites-available/rupa-crm
ln -sf /etc/nginx/sites-available/rupa-crm /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# 10. SSL
echo "[10/10] Installing SSL certificate..."
certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m admin@rupaenterprises.com
certbot renew --dry-run

# PM2 start
cd $APP_DIR
pm2 start docs/ecosystem.config.js --env production
pm2 save

# Firewall
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Daily backup cron
echo "0 2 * * * root mysqldump -u root rupa_crm > /var/backups/rupa_crm_\$(date +\%Y\%m\%d).sql && find /var/backups -name 'rupa_crm_*.sql' -mtime +30 -delete" >> /etc/crontab

echo ""
echo "=========================================="
echo "  Deployment Complete!"
echo "  App: https://$DOMAIN"
echo "  Admin: admin@rupaenterprises.com"
echo "  Password: Admin@123 (change on first login!)"
echo "=========================================="
