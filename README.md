# TurfCRM — Own Your Territory

**TurfCRM** is a smart, open-source Field Sales CRM built for trading and distribution businesses. Track visits, manage pipelines, automate follow-ups, import Tally billing data, and generate brand-wise reports — all in one place.

> Built for field sales teams that are serious about owning their territory.

---

## Why TurfCRM?

Most CRMs are built for SaaS companies. TurfCRM is built for **field sales teams** — the ones visiting clients daily, managing distributors, tracking orders, and reporting to brand partners.

- 📍 **GPS visit tracking** — capture exact location on every client visit
- 📊 **Brand-wise pipeline** — report to each brand partner with real data
- 🔔 **Auto follow-up escalation** — never let a lead go cold
- 📥 **Tally billing import** — upload Excel from Tally, auto-match clients
- 📈 **Month-over-Month reports** — see exactly which clients are growing or declining
- 👥 **Role-based access** — 6 roles from field exec to CEO

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Tailwind CSS 3, Vite 5 |
| Backend | Node.js, Express.js |
| Database | MySQL 8+ |
| Auth | JWT (access + refresh tokens) |
| Charts | Recharts |
| File Upload | Multer |
| Excel Export/Import | ExcelJS |
| Process Manager | PM2 |
| Web Server | Nginx |
| Deployment | Ubuntu VPS |

---

## Features

### ✅ Core Modules
- **Authentication** — JWT, 6 roles, forgot/reset password
- **User Management** — create users, assign roles & managers
- **Client Master** — GPS coordinates, brands, categories, bulk Excel import
- **Field Visit Tracking** — GPS capture, photo upload, manager approval workflow
- **Follow-up System** — auto-create from visits, overdue detection, daily escalation cron
- **Opportunity Pipeline** — 8 stages, stage history, comments, brand-wise tracking
- **Quotation Tracking** — link to opportunities, track status
- **Purchase Orders** — log POs, track dispatch status
- **Tally Billing Import** — Excel upload, auto client matching, unmatched record mapping
- **Role-based Dashboards** — different views for exec, manager, management, ops
- **Reports** — visits, pipeline, follow-ups, billing, brand report, MOM comparison
- **Excel Export** — every module exportable
- **Notifications** — in-app bell, overdue alerts, escalation alerts
- **Audit Trail** — every critical action logged

### 🗺️ User Roles
| Role | Access |
|------|--------|
| `super_admin` | Full system access |
| `admin` | Users, clients, brands, reports |
| `sales_manager` | Team visits, approvals, pipeline |
| `sales_executive` | Own visits, clients, opportunities |
| `backend_ops` | Quotations, POs, billing imports |
| `management` | View-only dashboards & reports |

---

## Project Structure

```
TurfCRM/
├── backend/
│   ├── src/
│   │   ├── config/          # DB, JWT, Multer config
│   │   ├── controllers/     # Business logic
│   │   ├── database/        # schema.sql, migrate.js, seed.js
│   │   ├── jobs/            # Cron jobs (followup escalation)
│   │   ├── middleware/      # auth, error handler, rate limiter
│   │   ├── routes/          # Express routers
│   │   ├── uploads/         # File storage (gitignored)
│   │   ├── utils/           # response, pagination, audit, logger
│   │   └── server.js        # Entry point
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI (Badge, Modal, Spinner, etc.)
│   │   ├── constants/       # Roles, stages, types
│   │   ├── context/         # AuthContext
│   │   ├── hooks/           # useApi, downloadBlob
│   │   ├── layouts/         # AppLayout, Sidebar, TopBar
│   │   ├── pages/           # All CRM pages
│   │   ├── routes/          # PrivateRoute
│   │   ├── services/        # Axios API client
│   │   └── App.jsx
│   ├── index.html
│   ├── tailwind.config.js
│   └── package.json
│
└── docs/
    ├── nginx.conf           # Production Nginx config
    ├── ecosystem.config.js  # PM2 config
    ├── deploy.sh            # Full VPS setup script
    ├── update.sh            # Update deployed app
    ├── API.md               # REST API reference
    └── ADMIN_GUIDE.md       # Admin usage guide
```

---

## Local Development

### Prerequisites
- Node.js 18+
- MySQL 8+

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your DB credentials

npm install
node src/database/migrate.js    # Create tables
node src/database/seed.js       # Create default admin
npm run dev                     # Start on port 5000
```

### Frontend

```bash
cd frontend
npm install
npm run dev                     # Start on port 3000
```

Open: [http://localhost:3000](http://localhost:3000)
Login: `admin@example.com` / `Admin@123`

---

## Deployment (VPS)

```bash
# 1. Upload project to server
scp -r TurfCRM/ root@YOUR_VPS_IP:/var/www/

# 2. SSH to server
ssh root@YOUR_VPS_IP

# 3. Configure environment
cd /var/www/TurfCRM/backend
cp .env.example .env
nano .env   # Set DB password, JWT secrets, domain

# 4. Run full setup
bash /var/www/TurfCRM/docs/deploy.sh

# 5. Run migrations
node src/database/migrate.js
node src/database/seed.js
```

Full instructions: [docs/ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md)

---

## Roadmap

### Phase 1 ✅ Done
- [x] Authentication & RBAC
- [x] Client master with GPS & bulk import
- [x] Field visit tracking & approval workflow
- [x] Follow-up automation & escalation
- [x] 8-stage opportunity pipeline
- [x] Role-based dashboards
- [x] Reports with Excel export
- [x] Audit trail & notifications

### Phase 2 ✅ Done
- [x] Quotation & PO tracking
- [x] Tally billing import
- [x] Brand-wise performance report
- [x] Month-over-Month billing comparison
- [x] Product movement analysis
- [x] Mobile-responsive UI

### Phase 3 🔜 Coming Soon
- [ ] WhatsApp notifications (WATI)
- [ ] Zoho Books integration
- [ ] React Native mobile app
- [ ] SMS reminders

---

## API Documentation

See [docs/API.md](docs/API.md)

---

## License

MIT — free to use, modify and deploy.

---

*TurfCRM — Own Your Territory* 🎯
