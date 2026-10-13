require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const mysql = require('mysql2/promise');

async function seedDummy() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'rupa_crm',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    multipleStatements: true,
  });

  try {
    console.log('Seeding dummy data...');
    const pw = await bcrypt.hash('Welcome@123', 10);

    // ── 1. USERS ──────────────────────────────────────────────────────────────
    // role_ids: 1=super_admin 2=admin 3=sales_manager 4=sales_executive 5=backend_ops 6=management
    await conn.query(`
      INSERT IGNORE INTO users (uuid, full_name, email, mobile, password_hash, role_id, department, joining_date, status) VALUES
      (?, 'Rajesh Kumar',     'rajesh.kumar@rupaenterprises.com',   '9876543201', ?, 3, 'Sales',      '2023-01-10', 'active'),
      (?, 'Priya Sharma',     'priya.sharma@rupaenterprises.com',   '9876543202', ?, 3, 'Sales',      '2023-02-15', 'active'),
      (?, 'Amit Verma',       'amit.verma@rupaenterprises.com',     '9876543203', ?, 4, 'Sales',      '2023-03-01', 'active'),
      (?, 'Sunita Patel',     'sunita.patel@rupaenterprises.com',   '9876543204', ?, 4, 'Sales',      '2023-04-10', 'active'),
      (?, 'Deepak Singh',     'deepak.singh@rupaenterprises.com',   '9876543205', ?, 4, 'Sales',      '2023-05-20', 'active'),
      (?, 'Kavita Mehta',     'kavita.mehta@rupaenterprises.com',   '9876543206', ?, 4, 'Sales',      '2023-06-01', 'active'),
      (?, 'Ravi Nair',        'ravi.nair@rupaenterprises.com',      '9876543207', ?, 5, 'Operations', '2023-01-15', 'active'),
      (?, 'Meena Joshi',      'meena.joshi@rupaenterprises.com',    '9876543208', ?, 6, 'Management', '2022-11-01', 'active')
    `, [
      uuidv4(), pw,
      uuidv4(), pw,
      uuidv4(), pw,
      uuidv4(), pw,
      uuidv4(), pw,
      uuidv4(), pw,
      uuidv4(), pw,
      uuidv4(), pw,
    ]);

    // Get user IDs
    const [users] = await conn.query(`SELECT id, email FROM users WHERE email LIKE '%@rupaenterprises.com' ORDER BY id`);
    const u = {};
    users.forEach(r => { u[r.email.split('@')[0].replace('.', '_')] = r.id; });
    // u.admin (already exists), rajesh_kumar, priya_sharma, amit_verma, sunita_patel, deepak_singh, kavita_mehta, ravi_nair, meena_joshi

    const [adminRow] = await conn.query(`SELECT id FROM users WHERE email='admin@rupaenterprises.com'`);
    const adminId = adminRow[0].id;
    const mgr1 = u['rajesh_kumar'];
    const mgr2 = u['priya_sharma'];
    const se1  = u['amit_verma'];
    const se2  = u['sunita_patel'];
    const se3  = u['deepak_singh'];
    const se4  = u['kavita_mehta'];

    // Assign managers
    await conn.query(`UPDATE users SET manager_id=? WHERE id IN (?,?)`, [mgr1, se1, se2]);
    await conn.query(`UPDATE users SET manager_id=? WHERE id IN (?,?)`, [mgr2, se3, se4]);

    // ── 2. BRANDS ─────────────────────────────────────────────────────────────
    await conn.query(`
      INSERT IGNORE INTO brands (name, description, status, created_by) VALUES
      ('Rupa Classic',    'Classic innerwear & hosiery range',       'active', ?),
      ('Frontline',       'Premium menswear & activewear',           'active', ?),
      ('Jon',             'Youth fashion & casual wear',             'active', ?),
      ('Macroman M-Series','Luxury innerwear collection',            'active', ?),
      ('Euro',            'Value range innerwear',                   'active', ?)
    `, [adminId, adminId, adminId, adminId, adminId]);

    const [brands] = await conn.query(`SELECT id, name FROM brands WHERE deleted_at IS NULL`);
    const b = {};
    brands.forEach(r => { b[r.name] = r.id; });

    // ── 3. CATEGORIES ─────────────────────────────────────────────────────────
    await conn.query(`
      INSERT IGNORE INTO categories (name, description, status, created_by) VALUES
      ('Innerwear',   'Briefs, vests, trunks',        'active', ?),
      ('Activewear',  'Track pants, shorts, t-shirts','active', ?),
      ('Thermals',    'Winter thermal range',          'active', ?),
      ('Socks',       'All types of socks',            'active', ?),
      ('Casual Wear', 'T-shirts, casual bottoms',      'active', ?)
    `, [adminId, adminId, adminId, adminId, adminId]);

    const [cats] = await conn.query(`SELECT id, name FROM categories WHERE deleted_at IS NULL`);
    const c = {};
    cats.forEach(r => { c[r.name] = r.id; });

    // ── 4. CLIENTS ────────────────────────────────────────────────────────────
    const clients = [
      { company: 'Sharma Garments Pvt Ltd',      contact: 'Mohan Sharma',   mobile: '9811001001', city: 'Delhi',     state: 'Delhi',       type: 'existing_client', sp: se1, mgr: mgr1, lat: 28.6139, lng: 77.2090 },
      { company: 'Mehta Textiles',               contact: 'Suresh Mehta',   mobile: '9821001002', city: 'Mumbai',    state: 'Maharashtra', type: 'existing_client', sp: se1, mgr: mgr1, lat: 19.0760, lng: 72.8777 },
      { company: 'Patel Brothers Wholesale',     contact: 'Ramesh Patel',   mobile: '9831001003', city: 'Ahmedabad', state: 'Gujarat',     type: 'distributor',     sp: se2, mgr: mgr1, lat: 23.0225, lng: 72.5714 },
      { company: 'Jain Fashion House',           contact: 'Dinesh Jain',    mobile: '9841001004', city: 'Jaipur',    state: 'Rajasthan',   type: 'retailer',        sp: se2, mgr: mgr1, lat: 26.9124, lng: 75.7873 },
      { company: 'Gupta & Sons Trading Co',      contact: 'Anil Gupta',     mobile: '9851001005', city: 'Kanpur',    state: 'UP',          type: 'new_prospect',    sp: se3, mgr: mgr2, lat: 26.4499, lng: 80.3319 },
      { company: 'Kumar Retail Stores',          contact: 'Vijay Kumar',    mobile: '9861001006', city: 'Pune',      state: 'Maharashtra', type: 'retailer',        sp: se3, mgr: mgr2, lat: 18.5204, lng: 73.8567 },
      { company: 'Singh Enterprise',             contact: 'Harpreet Singh', mobile: '9871001007', city: 'Ludhiana',  state: 'Punjab',      type: 'existing_client', sp: se4, mgr: mgr2, lat: 30.9010, lng: 75.8573 },
      { company: 'Rao Fashions',                 contact: 'Naresh Rao',     mobile: '9881001008', city: 'Hyderabad', state: 'Telangana',   type: 'new_prospect',    sp: se4, mgr: mgr2, lat: 17.3850, lng: 78.4867 },
      { company: 'Reddy Garment Center',         contact: 'Srikanth Reddy', mobile: '9891001009', city: 'Bangalore', state: 'Karnataka',   type: 'corporate',       sp: se1, mgr: mgr1, lat: 12.9716, lng: 77.5946 },
      { company: 'Mishra Cloth House',           contact: 'Shyam Mishra',   mobile: '9901001010', city: 'Lucknow',   state: 'UP',          type: 'retailer',        sp: se2, mgr: mgr1, lat: 26.8467, lng: 80.9462 },
      { company: 'National Garments Ltd',        contact: 'Rajan Nair',     mobile: '9911001011', city: 'Chennai',   state: 'Tamil Nadu',  type: 'distributor',     sp: se3, mgr: mgr2, lat: 13.0827, lng: 80.2707 },
      { company: 'Eastern Textile Corporation',  contact: 'Biplab Das',     mobile: '9921001012', city: 'Kolkata',   state: 'West Bengal', type: 'existing_client', sp: se4, mgr: mgr2, lat: 22.5726, lng: 88.3639 },
    ];

    const clientIds = [];
    for (const cl of clients) {
      const [res] = await conn.query(`
        INSERT IGNORE INTO clients (uuid, company_name, contact_person, mobile, city, state, client_type,
          assigned_salesperson_id, assigned_manager_id, latitude, longitude, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
      `, [uuidv4(), cl.company, cl.contact, cl.mobile, cl.city, cl.state, cl.type, cl.sp, cl.mgr, cl.lat, cl.lng, cl.sp]);
      const [row] = await conn.query(`SELECT id FROM clients WHERE company_name=?`, [cl.company]);
      clientIds.push(row[0].id);
    }

    // Link clients to brands and categories
    for (const cid of clientIds) {
      const brandPick = [b['Rupa Classic'], b['Frontline']];
      const catPick   = [c['Innerwear'], c['Activewear']];
      for (const bid of brandPick) {
        await conn.query(`INSERT IGNORE INTO client_brands (client_id, brand_id) VALUES (?,?)`, [cid, bid]);
      }
      for (const catid of catPick) {
        await conn.query(`INSERT IGNORE INTO client_categories (client_id, category_id) VALUES (?,?)`, [cid, catid]);
      }
    }

    // ── 5. VISITS ─────────────────────────────────────────────────────────────
    const visitTypes = ['cold_call', 'follow_up', 'demo', 'negotiation', 'order_discussion'];
    const visitData = [
      { sp: se1, ci: clientIds[0], date: '2026-04-28', type: 'follow_up',       outcome: 'Discussed new summer collection. Client interested in bulk order.', next: '2026-05-10', approved: true, approver: mgr1 },
      { sp: se1, ci: clientIds[1], date: '2026-04-29', type: 'order_discussion', outcome: 'Finalized order for 500 pieces Rupa Classic vests.',                next: '2026-05-08', approved: true, approver: mgr1 },
      { sp: se1, ci: clientIds[8], date: '2026-05-01', type: 'demo',             outcome: 'Showed new Frontline activewear range. Very positive response.',    next: '2026-05-12', approved: true, approver: mgr1 },
      { sp: se2, ci: clientIds[2], date: '2026-04-27', type: 'negotiation',      outcome: 'Price negotiation ongoing. Offered 5% discount on bulk.',           next: '2026-05-06', approved: true, approver: mgr1 },
      { sp: se2, ci: clientIds[3], date: '2026-04-30', type: 'cold_call',        outcome: 'First visit. Introduced Rupa product range.',                       next: '2026-05-15', approved: true, approver: mgr1 },
      { sp: se2, ci: clientIds[9], date: '2026-05-02', type: 'follow_up',        outcome: 'Client confirmed interest in thermals for winter stock.',            next: '2026-05-14', approved: false, approver: mgr1 },
      { sp: se3, ci: clientIds[4], date: '2026-04-26', type: 'cold_call',        outcome: 'Initial meeting. Shared brochures and pricing.',                    next: '2026-05-05', approved: true, approver: mgr2 },
      { sp: se3, ci: clientIds[5], date: '2026-04-29', type: 'order_discussion', outcome: 'Confirmed order for 200 pieces Jon casual wear.',                   next: '2026-05-09', approved: true, approver: mgr2 },
      { sp: se3, ci: clientIds[10], date: '2026-05-03', type: 'demo',            outcome: 'Demo of new Macroman M-Series. Good feedback.',                     next: '2026-05-13', approved: false, approver: mgr2 },
      { sp: se4, ci: clientIds[6], date: '2026-04-28', type: 'follow_up',        outcome: 'Discussed payment terms and delivery schedule.',                    next: '2026-05-07', approved: true, approver: mgr2 },
      { sp: se4, ci: clientIds[7], date: '2026-05-01', type: 'negotiation',      outcome: 'Negotiating on credit period. Client wants 60 days.',               next: '2026-05-11', approved: true, approver: mgr2 },
      { sp: se4, ci: clientIds[11], date: '2026-05-04', type: 'cold_call',       outcome: 'Met new buyer. Huge potential for bulk orders.',                    next: '2026-05-16', approved: false, approver: mgr2 },
      { sp: se1, ci: clientIds[0], date: '2026-04-15', type: 'order_discussion', outcome: 'Repeat order placed. 1000 pieces innnerwear.',                      next: null,         approved: true, approver: mgr1 },
      { sp: se3, ci: clientIds[4], date: '2026-04-20', type: 'follow_up',        outcome: 'Client reviewed samples. Will decide next week.',                   next: '2026-04-28', approved: true, approver: mgr2 },
    ];

    const visitIds = [];
    for (const v of visitData) {
      const [res] = await conn.query(`
        INSERT INTO visits (uuid, visit_date, visit_time, salesperson_id, client_id,
          latitude, longitude, person_met, meeting_type, meeting_highlights,
          visit_outcome, next_followup_date, approval_status, approved_by, approved_at, created_by)
        VALUES (?, ?, '10:30:00', ?, ?, 28.6139, 77.2090, 'Owner / Buyer', ?, ?, ?, ?, ?, ?, NOW(), ?)
      `, [
        uuidv4(), v.date, v.sp, v.ci,
        v.type, v.outcome, v.outcome,
        v.next,
        v.approved ? 'approved' : 'pending',
        v.approved ? v.approver : null,
        v.sp,
      ]);
      visitIds.push(res.insertId);
    }

    // ── 6. FOLLOW-UPS ─────────────────────────────────────────────────────────
    const followups = [
      { title: 'Follow up on summer collection order',  ci: clientIds[0],  vi: visitIds[0],  sp: se1, date: '2026-05-10', pri: 'high',   status: 'pending' },
      { title: 'Confirm delivery schedule',             ci: clientIds[1],  vi: visitIds[1],  sp: se1, date: '2026-05-08', pri: 'high',   status: 'pending' },
      { title: 'Price negotiation follow up',           ci: clientIds[2],  vi: visitIds[3],  sp: se2, date: '2026-05-06', pri: 'high',   status: 'pending' },
      { title: 'Send product catalogue',                ci: clientIds[3],  vi: visitIds[4],  sp: se2, date: '2026-05-15', pri: 'medium', status: 'pending' },
      { title: 'Check on samples feedback',             ci: clientIds[4],  vi: visitIds[6],  sp: se3, date: '2026-05-05', pri: 'high',   status: 'overdue' },
      { title: 'Confirm bulk order from Kumar Retail',  ci: clientIds[5],  vi: visitIds[7],  sp: se3, date: '2026-05-09', pri: 'medium', status: 'pending' },
      { title: 'Payment follow up – Singh Enterprise',  ci: clientIds[6],  vi: visitIds[9],  sp: se4, date: '2026-05-07', pri: 'high',   status: 'pending' },
      { title: 'Share revised quotation with Rao',      ci: clientIds[7],  vi: visitIds[10], sp: se4, date: '2026-05-11', pri: 'medium', status: 'pending' },
      { title: 'Cold call follow up – Gupta & Sons',    ci: clientIds[4],  vi: null,          sp: se3, date: '2026-04-30', pri: 'medium', status: 'overdue' },
      { title: 'Demo follow up – Reddy Garment',        ci: clientIds[8],  vi: visitIds[2],  sp: se1, date: '2026-05-12', pri: 'medium', status: 'pending' },
      { title: 'Discuss thermals winter order',         ci: clientIds[9],  vi: visitIds[5],  sp: se2, date: '2026-05-14', pri: 'low',    status: 'pending' },
      { title: 'Follow up on National Garments demo',   ci: clientIds[10], vi: visitIds[8],  sp: se3, date: '2026-05-13', pri: 'medium', status: 'pending' },
      { title: 'Eastern Textile – first order close',   ci: clientIds[11], vi: visitIds[11], sp: se4, date: '2026-05-16', pri: 'high',   status: 'pending' },
      { title: 'Repeat order confirmation – Sharma',    ci: clientIds[0],  vi: visitIds[12], sp: se1, date: '2026-04-25', pri: 'high',   status: 'completed', notes: 'Order confirmed. 1000 pieces dispatched.' },
    ];

    for (const f of followups) {
      await conn.query(`
        INSERT INTO followups (uuid, title, client_id, visit_id, assigned_salesperson_id,
          followup_date, priority, status, completion_notes, completed_date, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        uuidv4(), f.title, f.ci, f.vi || null, f.sp,
        f.date, f.pri, f.status,
        f.notes || null,
        f.status === 'completed' ? new Date() : null,
        f.sp,
      ]);
    }

    // ── 7. OPPORTUNITIES ──────────────────────────────────────────────────────
    const opps = [
      { title: 'Sharma Garments – Summer Innerwear Bulk Order',  ci: clientIds[0],  sp: se1, mgr: mgr1, brand: b['Rupa Classic'], cat: c['Innerwear'],  val: 450000,  close: '2026-05-30', stage: 'negotiation',      prob: 60 },
      { title: 'Mehta Textiles – Activewear Annual Contract',     ci: clientIds[1],  sp: se1, mgr: mgr1, brand: b['Frontline'],    cat: c['Activewear'],  val: 1200000, close: '2026-06-15', stage: 'quotation_sent',   prob: 50 },
      { title: 'Patel Brothers – Distributor Agreement',          ci: clientIds[2],  sp: se2, mgr: mgr1, brand: b['Euro'],         cat: c['Innerwear'],  val: 800000,  close: '2026-07-01', stage: 'evaluation',       prob: 30 },
      { title: 'Jain Fashion House – Jon Casual Wear Range',      ci: clientIds[3],  sp: se2, mgr: mgr1, brand: b['Jon'],          cat: c['Casual Wear'], val: 320000,  close: '2026-05-20', stage: 'finalization',     prob: 80 },
      { title: 'Gupta & Sons – New Client Onboarding Order',      ci: clientIds[4],  sp: se3, mgr: mgr2, brand: b['Rupa Classic'], cat: c['Innerwear'],  val: 150000,  close: '2026-06-30', stage: 'qualified',        prob: 20 },
      { title: 'Kumar Retail – Q2 Casual Wear Supply',            ci: clientIds[5],  sp: se3, mgr: mgr2, brand: b['Jon'],          cat: c['Casual Wear'], val: 280000,  close: '2026-05-25', stage: 'won',              prob: 100, won: 280000, wonDate: '2026-05-03' },
      { title: 'Singh Enterprise – Thermal Winter Stock',         ci: clientIds[6],  sp: se4, mgr: mgr2, brand: b['Macroman M-Series'], cat: c['Thermals'], val: 600000, close: '2026-08-15', stage: 'identification',   prob: 10 },
      { title: 'Rao Fashions – Premium Menswear Pilot',           ci: clientIds[7],  sp: se4, mgr: mgr2, brand: b['Frontline'],    cat: c['Activewear'],  val: 200000,  close: '2026-06-10', stage: 'negotiation',      prob: 55 },
      { title: 'Reddy Garment – Corporate Uniform Order',         ci: clientIds[8],  sp: se1, mgr: mgr1, brand: b['Frontline'],    cat: c['Activewear'],  val: 950000,  close: '2026-07-20', stage: 'quotation_sent',   prob: 45 },
      { title: 'Mishra Cloth House – Socks & Innerwear Bundle',   ci: clientIds[9],  sp: se2, mgr: mgr1, brand: b['Rupa Classic'], cat: c['Socks'],       val: 180000,  close: '2026-05-31', stage: 'evaluation',       prob: 35 },
      { title: 'National Garments – South India Distribution',    ci: clientIds[10], sp: se3, mgr: mgr2, brand: b['Euro'],         cat: c['Innerwear'],   val: 2500000, close: '2026-09-30', stage: 'qualified',        prob: 25 },
      { title: 'Eastern Textile – Bengal Region Expansion',       ci: clientIds[11], sp: se4, mgr: mgr2, brand: b['Rupa Classic'], cat: c['Innerwear'],   val: 1800000, close: '2026-10-15', stage: 'identification',   prob: 10 },
      { title: 'Sharma Garments – Rejected Activewear Proposal',  ci: clientIds[0],  sp: se1, mgr: mgr1, brand: b['Frontline'],    cat: c['Activewear'],  val: 300000,  close: '2026-04-15', stage: 'lost',             prob: 0,  lostReason: 'Client chose competitor product at lower price.' },
      { title: 'Patel Brothers – Closed Socks Deal Q1',           ci: clientIds[2],  sp: se2, mgr: mgr1, brand: b['Euro'],         cat: c['Socks'],        val: 420000,  close: '2026-03-31', stage: 'won',              prob: 100, won: 420000, wonDate: '2026-03-28' },
    ];

    const oppIds = [];
    for (const o of opps) {
      const [res] = await conn.query(`
        INSERT INTO opportunities (uuid, title, client_id, assigned_salesperson_id, assigned_manager_id,
          brand_id, category_id, estimated_value, expected_closing_date, current_stage, probability,
          lost_reason, won_date, won_value, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        uuidv4(), o.title, o.ci, o.sp, o.mgr,
        o.brand, o.cat, o.val, o.close,
        o.stage, o.prob,
        o.lostReason || null,
        o.wonDate || null,
        o.won || null,
        o.sp,
      ]);
      oppIds.push(res.insertId);

      // Stage history
      await conn.query(`
        INSERT INTO opportunity_stage_history (opportunity_id, from_stage, to_stage, changed_by, remarks)
        VALUES (?, NULL, 'identification', ?, 'Opportunity created')
      `, [res.insertId, o.sp]);

      if (o.stage !== 'identification') {
        await conn.query(`
          INSERT INTO opportunity_stage_history (opportunity_id, from_stage, to_stage, changed_by, remarks)
          VALUES (?, 'identification', ?, ?, 'Stage progressed')
        `, [res.insertId, o.stage, o.sp]);
      }

      // Add a comment
      await conn.query(`
        INSERT INTO opportunity_comments (opportunity_id, comment, created_by)
        VALUES (?, ?, ?)
      `, [res.insertId, `Initial assessment done. ${o.title.split('–')[1]?.trim() || 'Pursuing actively.'} Estimated value ₹${o.val.toLocaleString('en-IN')}.`, o.sp]);
    }

    // ── 8. QUOTATIONS ─────────────────────────────────────────────────────────
    const quotations = [
      { num: 'QT-2026-001', ci: clientIds[0], sp: se1, oppIdx: 0,  brand: b['Rupa Classic'], cat: c['Innerwear'],  date: '2026-04-20', val: 445000,  status: 'under_discussion' },
      { num: 'QT-2026-002', ci: clientIds[1], sp: se1, oppIdx: 1,  brand: b['Frontline'],    cat: c['Activewear'], date: '2026-04-25', val: 1185000, status: 'sent' },
      { num: 'QT-2026-003', ci: clientIds[3], sp: se2, oppIdx: 3,  brand: b['Jon'],          cat: c['Casual Wear'],date: '2026-04-28', val: 315000,  status: 'accepted' },
      { num: 'QT-2026-004', ci: clientIds[5], sp: se3, oppIdx: 5,  brand: b['Jon'],          cat: c['Casual Wear'],date: '2026-04-30', val: 280000,  status: 'converted' },
      { num: 'QT-2026-005', ci: clientIds[7], sp: se4, oppIdx: 7,  brand: b['Frontline'],    cat: c['Activewear'], date: '2026-05-01', val: 195000,  status: 'sent' },
      { num: 'QT-2026-006', ci: clientIds[8], sp: se1, oppIdx: 8,  brand: b['Frontline'],    cat: c['Activewear'], date: '2026-05-02', val: 940000,  status: 'sent' },
      { num: 'QT-2026-007', ci: clientIds[2], sp: se2, oppIdx: 13, brand: b['Euro'],         cat: c['Socks'],      date: '2026-03-10', val: 420000,  status: 'converted' },
      { num: 'QT-2026-008', ci: clientIds[0], sp: se1, oppIdx: 12, brand: b['Frontline'],    cat: c['Activewear'], date: '2026-04-01', val: 290000,  status: 'rejected' },
    ];

    for (const q of quotations) {
      await conn.query(`
        INSERT IGNORE INTO quotations (uuid, quotation_number, client_id, opportunity_id, salesperson_id,
          brand_id, category_id, quotation_date, quotation_value, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [uuidv4(), q.num, q.ci, oppIds[q.oppIdx], q.sp, q.brand, q.cat, q.date, q.val, q.status, q.sp]);
    }

    // ── 9. PURCHASE ORDERS ────────────────────────────────────────────────────
    const pos = [
      { num: 'PO-2026-001', ci: clientIds[5],  sp: se3, oppIdx: 5,  brand: b['Jon'],          cat: c['Casual Wear'], date: '2026-05-03', val: 280000, status: 'dispatched' },
      { num: 'PO-2026-002', ci: clientIds[2],  sp: se2, oppIdx: 13, brand: b['Euro'],         cat: c['Socks'],       date: '2026-03-29', val: 420000, status: 'completed' },
      { num: 'PO-2026-003', ci: clientIds[0],  sp: se1, oppIdx: 0,  brand: b['Rupa Classic'], cat: c['Innerwear'],   date: '2026-04-16', val: 210000, status: 'completed' },
      { num: 'PO-2026-004', ci: clientIds[3],  sp: se2, oppIdx: 3,  brand: b['Jon'],          cat: c['Casual Wear'], date: '2026-05-05', val: 315000, status: 'processing' },
    ];

    for (const p of pos) {
      await conn.query(`
        INSERT IGNORE INTO purchase_orders (uuid, po_number, po_date, client_id, salesperson_id,
          opportunity_id, brand_id, category_id, po_value, order_status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [uuidv4(), p.num, p.date, p.ci, p.sp, oppIds[p.oppIdx], p.brand, p.cat, p.val, p.status, p.sp]);
    }

    // ── 10. NOTIFICATIONS ─────────────────────────────────────────────────────
    const notifications = [
      { uid: se1, title: 'Follow-up Reminder',        msg: 'You have a follow-up with Sharma Garments today at 10:30 AM.',          type: 'followup' },
      { uid: se1, title: 'Visit Approved',             msg: 'Your visit to Mehta Textiles on Apr 29 has been approved by Rajesh Kumar.', type: 'visit' },
      { uid: se2, title: 'Follow-up Overdue',          msg: 'Follow-up with Gupta & Sons is overdue by 2 days. Please update.',       type: 'followup' },
      { uid: se3, title: 'Follow-up Overdue',          msg: 'Follow-up with Gupta & Sons is overdue. Manager has been notified.',     type: 'escalation' },
      { uid: mgr1, title: 'Escalation Alert',          msg: 'Follow-up for Gupta & Sons (Deepak Singh) has been escalated to you.',  type: 'escalation' },
      { uid: mgr1, title: 'Pending Visit Approvals',   msg: '3 visits are pending your approval.',                                    type: 'visit' },
      { uid: se4, title: 'Opportunity Stage Updated',  msg: 'Opportunity "Rao Fashions – Premium Menswear Pilot" moved to Negotiation.', type: 'opportunity' },
      { uid: se3, title: 'PO Received',                msg: 'Purchase Order PO-2026-001 from Kumar Retail Stores has been created.',  type: 'system' },
      { uid: mgr2, title: 'Pending Visit Approvals',   msg: '2 visits are pending your approval.',                                    type: 'visit' },
      { uid: adminId, title: 'System Ready',           msg: 'CRM system is set up and operational. Dummy data has been loaded.',       type: 'system' },
    ];

    for (const n of notifications) {
      await conn.query(`
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (?, ?, ?, ?)
      `, [n.uid, n.title, n.msg, n.type]);
    }

    console.log('\n✓ Dummy data seeded successfully!\n');
    console.log('Users created (all passwords: Welcome@123):');
    console.log('  Sales Managers : rajesh.kumar@rupaenterprises.com, priya.sharma@rupaenterprises.com');
    console.log('  Sales Execs    : amit.verma@, sunita.patel@, deepak.singh@, kavita.mehta@rupaenterprises.com');
    console.log('  Backend Ops    : ravi.nair@rupaenterprises.com');
    console.log('  Management     : meena.joshi@rupaenterprises.com');
    console.log('\nData created:');
    console.log('  5 Brands, 5 Categories, 12 Clients');
    console.log('  14 Visits, 14 Follow-ups, 14 Opportunities');
    console.log('  8 Quotations, 4 Purchase Orders, 10 Notifications');

  } catch (err) {
    console.error('Dummy seed failed:', err.message);
    console.error(err);
  } finally {
    await conn.end();
  }
}

seedDummy();
