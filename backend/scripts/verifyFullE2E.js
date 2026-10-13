require('dotenv').config();

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
  console.log('   RUNNING FULL END-TO-END WORKFLOW SUITE           ');
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

  // 1. Authenticate Sales Executive 1 (Amit Verma)
  console.log('--- 1. Authenticating Roles ---');
  const exec1Res = await request('/auth/login', {
    method: 'POST',
    body: { email: 'amit.verma@rupaenterprises.com', password: 'Welcome@123' },
  });
  assert(exec1Res.status === 200, 'Sales Executive 1 (Amit Verma) logged in');
  const exec1Token = exec1Res.data.data?.accessToken;
  const exec1Id = exec1Res.data.data?.user?.id;

  // Authenticate Sales Manager (Rajesh Kumar)
  const mgrRes = await request('/auth/login', {
    method: 'POST',
    body: { email: 'rajesh.kumar@rupaenterprises.com', password: 'Welcome@123' },
  });
  assert(mgrRes.status === 200, 'Sales Manager (Rajesh Kumar) logged in');
  const mgrToken = mgrRes.data.data?.accessToken;

  // 2. Executive creates a new visit
  console.log('\n--- 2. Sales Executive Submits Visit ---');
  const newVisitRes = await request('/visits', {
    method: 'POST',
    token: exec1Token,
    body: {
      visit_date: new Date().toISOString().split('T')[0],
      visit_time: '14:30',
      client_id: 1,
      latitude: 28.6139,
      longitude: 77.2090,
      gps_address: 'New Delhi Central, Connaught Place',
      gps_captured_at: new Date().toISOString(),
      person_met: 'Mr. Arvind Aggarwal',
      designation_met: 'Purchase Manager',
      meeting_type: 'follow_up',
      meeting_highlights: 'Reviewed sample garments; client interested in Frontline range.',
      visit_outcome: 'warm',
      next_action: 'send_quotation',
      next_followup_date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
      brands: [1, 2],
    },
  });
  if (!(newVisitRes.status === 201 && newVisitRes.data.data?.id)) {
    console.log('DEBUG newVisitRes:', newVisitRes.status, JSON.stringify(newVisitRes.data));
  }
  assert(newVisitRes.status === 201 && newVisitRes.data.data?.id, 'Visit submitted atomically with GPS and brands');
  const visitId = newVisitRes.data.data?.id;

  // 3. Executive reads own visit
  console.log('\n--- 3. Executive Accesses Own Visit ---');
  const ownVisitRes = await request(`/visits/${visitId}`, { token: exec1Token });
  assert(ownVisitRes.status === 200 && ownVisitRes.data.data?.id === visitId, 'Executive successfully read own visit');

  // 4. Executive can update pending visit
  console.log('\n--- 4. Executive Updates Pending Visit ---');
  const updatePendingRes = await request(`/visits/${visitId}`, {
    method: 'PUT',
    token: exec1Token,
    body: {
      visit_date: new Date().toISOString().split('T')[0],
      visit_time: '15:00',
      meeting_type: 'follow_up',
      person_met: 'Mr. Arvind Aggarwal (Updated)',
      meeting_highlights: 'Confirmed quotation requirements.',
    },
  });
  assert(updatePendingRes.status === 200, 'Executive successfully updated pending visit');

  // 5. Manager approves the visit
  console.log('\n--- 5. Manager Approves Visit ---');
  const approveRes = await request(`/visits/${visitId}/approve`, {
    method: 'PATCH',
    token: mgrToken,
    body: { status: 'approved' },
  });
  assert(approveRes.status === 200, 'Sales Manager approved the visit');

  // 6. Immutability: Executive CANNOT edit approved visit
  console.log('\n--- 6. Verifying Immutability of Approved Visit ---');
  const editApprovedRes = await request(`/visits/${visitId}`, {
    method: 'PUT',
    token: exec1Token,
    body: {
      person_met: 'Tampering Attempt',
    },
  });
  assert(editApprovedRes.status === 400, 'Executive blocked from editing approved visit (assert 400)');

  // 7. Verify Sales Executive is blocked from Opportunities & Manager has access
  console.log('\n--- 7. Verifying Opportunity RBAC Boundaries ---');
  const execOppAttempt = await request('/opportunities', {
    method: 'POST',
    token: exec1Token,
    body: {
      title: 'Unauthorized Opp by Executive',
      client_id: 1,
      estimated_value: 150000,
    },
  });
  assert(execOppAttempt.status === 403, 'Sales Executive is strictly blocked from creating opportunities (assert 403)');

  const execGetOppAttempt = await request('/opportunities', { token: exec1Token });
  assert(execGetOppAttempt.status === 403, 'Sales Executive is strictly blocked from querying opportunities (assert 403)');

  // Manager creates and manages opportunity
  const newOppRes = await request('/opportunities', {
    method: 'POST',
    token: mgrToken,
    body: {
      title: 'Bulk Order - Premium Undergarments',
      client_id: 1,
      estimated_value: 150000,
      current_stage: 'identification',
    },
  });
  assert(newOppRes.status === 201 && newOppRes.data.data?.id, 'Sales Manager created an opportunity');
  const oppId = newOppRes.data.data?.id;

  const getOppRes = await request(`/opportunities/${oppId}`, { token: mgrToken });
  assert(getOppRes.status === 200 && getOppRes.data.data?.id === oppId, 'Sales Manager can view team opportunity');

  const advanceStageRes = await request(`/opportunities/${oppId}/stage`, {
    method: 'PATCH',
    token: mgrToken,
    body: { stage: 'qualified', remarks: 'Client passed credit and eligibility check' },
  });
  assert(advanceStageRes.status === 200, 'Sales Manager advanced stage atomically');

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('E2E test encountered an error:', err);
  process.exit(1);
});
