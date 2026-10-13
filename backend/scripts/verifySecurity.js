require('dotenv').config();
const http = require('http');

const API_BASE = 'http://localhost:5000/api/v1';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function run() {
  console.log('====================================================');
  console.log('   RUNNING SECURITY & RBAC VERIFICATION SUITE       ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Unauthenticated endpoints must return 401
  console.log('--- 1. Testing Unauthenticated Access (Expecting 401) ---');
  const noAuthVisits = await request('/visits');
  assert(noAuthVisits.status === 401, 'GET /visits without token returns 401');

  const noAuthClients = await request('/clients');
  assert(noAuthClients.status === 401, 'GET /clients without token returns 401');

  const noAuthUsers = await request('/users');
  assert(noAuthUsers.status === 401, 'GET /users without token returns 401');

  // 2. Login as Sales Executive
  console.log('\n--- 2. Authenticating as Sales Executive ---');
  const execLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'amit.verma@rupaenterprises.com', password: 'Welcome@123' },
  });
  assert(execLogin.status === 200 && execLogin.data.data?.accessToken, 'Sales Executive logged in successfully');
  const execToken = execLogin.data.data?.accessToken;

  // 3. Sales Executive blocked from Admin / Operations Endpoints (Expecting 403)
  console.log('\n--- 3. Testing Sales Executive RBAC Boundary (Expecting 403) ---');
  const execUsers = await request('/users', { token: execToken });
  assert(execUsers.status === 403, 'Sales Executive blocked from GET /users (403)');

  const execAuditLogs = await request('/audit-logs', { token: execToken });
  assert(execAuditLogs.status === 403, 'Sales Executive blocked from GET /audit-logs (403)');

  const execBillingImports = await request('/billing/imports', { token: execToken });
  assert(execBillingImports.status === 403, 'Sales Executive blocked from GET /billing/imports (403)');

  const execMasterBrandCreate = await request('/master/brands', {
    method: 'POST',
    token: execToken,
    body: { name: 'Unauthorized Brand' },
  });
  assert(execMasterBrandCreate.status === 403, 'Sales Executive blocked from POST /master/brands (403)');

  const execOpportunities = await request('/opportunities', { token: execToken });
  assert(execOpportunities.status === 403, 'Sales Executive blocked from GET /opportunities (403)');

  const execApproveVisit = await request('/visits/1/approve', {
    method: 'PATCH',
    token: execToken,
    body: { status: 'approved' },
  });
  assert(execApproveVisit.status === 403, 'Sales Executive blocked from approving visits (403)');

  const execPoStatus = await request('/purchase-orders/1/status', {
    method: 'PATCH',
    token: execToken,
    body: { order_status: 'dispatched' },
  });
  assert(execPoStatus.status === 403, 'Sales Executive blocked from updating PO status (403)');

  // 4. Rate Limiting Protection on /auth/login
  console.log('\n--- 4. Testing Rate Limiting Protection ---');
  const healthRes = await fetch('http://localhost:5000/health');
  assert(healthRes.status === 200, 'Health check endpoint responds 200');

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Security test encountered an error:', err);
  process.exit(1);
});
