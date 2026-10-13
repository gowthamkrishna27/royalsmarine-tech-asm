# Rupa CRM — REST API Reference

Base URL: `https://crm.rupaenterprises.com/api/v1`

All protected endpoints require: `Authorization: Bearer <accessToken>`

---

## Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Login with email + password |
| POST | `/auth/refresh-token` | Refresh access token |
| POST | `/auth/logout` | Logout (invalidates refresh token) |
| POST | `/auth/forgot-password` | Send password reset email |
| POST | `/auth/reset-password` | Reset password with token |
| GET  | `/auth/me` | Get current user profile |

**Login Request:**
```json
{ "email": "admin@rupaenterprises.com", "password": "Admin@123" }
```

**Login Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": { "id": 1, "full_name": "Super Admin", "role": "super_admin" }
  }
}
```

---

## Users

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/users` | admin, super_admin, sales_manager | List users |
| POST | `/users` | admin, super_admin | Create user |
| GET | `/users/:id` | authenticated | Get user |
| PUT | `/users/:id` | admin, super_admin | Update user |
| DELETE | `/users/:id` | admin, super_admin | Deactivate user |
| PUT | `/users/:id/reset-password` | admin, super_admin | Reset password |
| GET | `/users/roles` | authenticated | List roles |

**Query params:** `page`, `limit`, `role`, `status`, `search`

---

## Clients

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/clients` | List clients (filtered by role) |
| POST | `/clients` | Create client |
| GET | `/clients/:id` | Get client details |
| GET | `/clients/:id/profile` | Get client profile with stats |
| PUT | `/clients/:id` | Update client |
| GET | `/clients/export` | Export clients to Excel |

**Query params:** `page`, `limit`, `search`, `city`, `state`, `client_type`, `status`, `salesperson_id`

---

## Visits

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/visits` | List visits |
| POST | `/visits` | Submit visit report |
| GET | `/visits/:id` | Get visit details |
| PUT | `/visits/:id` | Update visit (before approval) |
| PATCH | `/visits/:id/approve` | Approve or reject visit |
| POST | `/visits/:id/attachments` | Upload attachment (multipart) |
| GET | `/visits/export` | Export visits to Excel |

**Approve Request:**
```json
{ "status": "approved" }
{ "status": "rejected", "rejection_reason": "GPS not captured" }
```

---

## Follow-ups

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/followups` | List follow-ups |
| GET | `/followups/today` | Today's pending follow-ups |
| GET | `/followups/overdue` | Overdue follow-ups |
| POST | `/followups` | Create follow-up |
| PUT | `/followups/:id` | Update follow-up |
| PATCH | `/followups/:id/complete` | Mark as completed |

---

## Opportunities

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/opportunities` | List opportunities |
| GET | `/opportunities/pipeline` | Pipeline summary by stage |
| POST | `/opportunities` | Create opportunity |
| GET | `/opportunities/:id` | Get opportunity details |
| PUT | `/opportunities/:id` | Update opportunity |
| PATCH | `/opportunities/:id/stage` | Change stage |
| POST | `/opportunities/:id/comments` | Add comment |

**Stage Change Request:**
```json
{
  "stage": "won",
  "remarks": "Deal closed",
  "won_value": 150000,
  "won_date": "2026-05-07"
}
```
For lost: `{ "stage": "lost", "lost_reason": "Budget constraint" }`

---

## Master Data (Brands / Categories / Products)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/master/brands` | List brands |
| POST | `/master/brands` | Create brand |
| PUT | `/master/brands/:id` | Update brand |
| GET | `/master/categories` | List categories |
| POST | `/master/categories` | Create category |
| GET | `/master/products` | List products |
| POST | `/master/products` | Create product |

---

## Quotations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/quotations` | List quotations |
| POST | `/quotations` | Create quotation (multipart for file) |
| PUT | `/quotations/:id` | Update quotation status |

---

## Purchase Orders

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/purchase-orders` | List POs |
| POST | `/purchase-orders` | Create PO (multipart for file) |
| PATCH | `/purchase-orders/:id/status` | Update PO status |

---

## Billing Import

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/billing/imports` | Import history |
| POST | `/billing/import` | Upload and import billing file |
| GET | `/billing/unmatched` | Unmatched records |
| PATCH | `/billing/records/:id/map` | Map unmatched record to client |

**Excel Format (row 2 onwards):**
`Invoice No | Date | Client Name | Client Code | Salesperson | Brand | Category | Invoice Amt | Paid Amt | Outstanding | Due Date`

---

## Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard` | Role-based dashboard data |

---

## Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/reports/visits` | Salesperson visit report |
| GET | `/reports/opportunities` | Opportunity + brand pipeline |
| GET | `/reports/followups` | Follow-up completion report |
| GET | `/reports/billing` | Client billing + overdue |
| GET | `/reports/export?type=visits` | Export report to Excel |

---

## Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notifications` | User notifications |
| PATCH | `/notifications/:id/read` | Mark as read |
| PATCH | `/notifications/read-all` | Mark all as read |

---

## Standard Response Format

```json
{
  "success": true,
  "message": "...",
  "data": { ... }
}
```

**Paginated:**
```json
{
  "success": true,
  "message": "...",
  "data": [...],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Error:**
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [{ "field": "email", "message": "Email is required" }]
}
```
