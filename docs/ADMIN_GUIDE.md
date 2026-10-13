# Rupa CRM — Admin Guide

## First-Time Setup

### 1. Login
- URL: `https://crm.rupaenterprises.com`
- Email: `admin@rupaenterprises.com`
- Password: `Admin@123`
- **Change your password immediately** after first login.

### 2. Add Master Data (in order)
1. **Brands** → Master Data → Brands & Categories → Add Brand
2. **Categories** → Master Data → Brands & Categories → Add Category
3. **Products** → Master Data → Products → Add Product (optional for MVP)

### 3. Create Users
Go to **Users** → Add User

Recommended user creation order:
1. Sales Managers
2. Sales Executives (assign to managers)
3. Backend / Operations staff
4. Management viewers

Default password for all new users: `Welcome@123` — users must change on first login.

---

## User Roles Explained

| Role | What They Can Do |
|------|-----------------|
| Super Admin | Full access — everything |
| Admin | Manage users, clients, brands, reports |
| Sales Manager | View team visits, approve/reject visits, see pipeline |
| Sales Executive | Add visits, clients, opportunities, own follow-ups |
| Backend / Operations | Manage quotations, POs, billing imports |
| Management | View-only dashboards and reports |

---

## Day-to-Day Operations

### Managing Visits
- Sales executives submit visits from mobile browser
- Managers see pending visits on their dashboard
- Approve/reject from **Visits** page (✓ / ✗ buttons)
- Rejected visits require a reason

### Follow-up System
- Follow-ups are auto-created when a salesperson sets "Next Follow-up Date" on a visit
- Overdue follow-ups auto-escalate to manager after 2 days (configurable in Settings)
- Salespeople see today's follow-ups on their dashboard

### Billing Import (Tally)
1. Export from Tally as Excel
2. Ensure columns: Invoice No, Date, Client Name, Code, Salesperson, Brand, Category, Invoice Amt, Paid Amt, Outstanding, Due Date
3. Go to **Billing Import** → Upload file
4. Review unmatched records → Map to CRM clients

### Monthly Reports
- Go to **Reports** → Select tab (Visits / Opportunities / Follow-ups / Billing)
- Filter by date range, salesperson, brand
- Click **Export Excel** to download

---

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| followup_overdue_escalation_days | 2 | Days before overdue escalation |
| company_name | Rupa Enterprises | Company name |
| smtp_configured | false | Enable email notifications |

---

## Troubleshooting

### App is slow
- Check PM2: `pm2 status rupa-crm-api`
- Check logs: `pm2 logs rupa-crm-api --lines 50`

### Database backup
- Manual: `mysqldump -u root -p rupa_crm > backup_$(date +%Y%m%d).sql`
- Auto backup runs daily at 2 AM, stored in `/var/backups/`
- Backups older than 30 days are auto-deleted

### Restart app
```bash
pm2 restart rupa-crm-api
```

### Update app
```bash
cd /var/www/rupa-crm
git pull
bash docs/update.sh
```

---

## Security Checklist

- [ ] Changed default admin password
- [ ] All user passwords changed on first login
- [ ] SSL certificate active (auto-renews via certbot)
- [ ] Firewall enabled (only ports 22, 80, 443 open)
- [ ] Database password is strong and not default
- [ ] `.env` file permissions: `chmod 600 .env`
- [ ] Backup running daily and tested for restore

---

## Support

For technical issues, contact your CRM development team with:
1. Screenshot of the error
2. Steps to reproduce
3. User role and page URL
