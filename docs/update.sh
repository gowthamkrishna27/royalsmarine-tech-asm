#!/bin/bash
# Rupa CRM - Quick Update Script (run after pulling new code)

set -e
APP_DIR="/var/www/rupa-crm"

echo "Updating Rupa CRM..."

# Backend
cd $APP_DIR/backend
npm install --production
pm2 restart rupa-crm-api --update-env

# Frontend
cd $APP_DIR/frontend
npm install
npm run build

echo "Update complete. App is live."
