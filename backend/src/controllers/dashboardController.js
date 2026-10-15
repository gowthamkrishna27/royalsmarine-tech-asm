const sequelize = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');

const getSalesExecutiveDashboard = async (userId) => {
  const [todayFollowups] = await sequelize.query(
    "SELECT COUNT(*) as count FROM followups WHERE assigned_salesperson_id=? AND followup_date=CURDATE() AND status='pending' AND deleted_at IS NULL",
    { replacements: [userId] }
  );
  const [overdueFollowups] = await sequelize.query(
    "SELECT COUNT(*) as count FROM followups WHERE assigned_salesperson_id=? AND followup_date<CURDATE() AND status IN ('pending','overdue') AND deleted_at IS NULL",
    { replacements: [userId] }
  );
  const [monthVisits] = await sequelize.query(
    "SELECT COUNT(*) as count FROM visits WHERE salesperson_id=? AND MONTH(visit_date)=MONTH(NOW()) AND YEAR(visit_date)=YEAR(NOW()) AND deleted_at IS NULL",
    { replacements: [userId] }
  );
  const [pendingVisits] = await sequelize.query(
    "SELECT COUNT(*) as count FROM visits WHERE salesperson_id=? AND approval_status='pending' AND deleted_at IS NULL",
    { replacements: [userId] }
  );
  const [recentVisits] = await sequelize.query(
    `SELECT v.id, v.visit_date, v.visit_time, v.meeting_type, v.approval_status, c.company_name, c.city
     FROM visits v JOIN clients c ON v.client_id = c.id
     WHERE v.salesperson_id=? AND v.deleted_at IS NULL
     ORDER BY v.visit_date DESC, v.visit_time DESC LIMIT 5`,
    { replacements: [userId] }
  );
  const [recentFollowups] = await sequelize.query(
    `SELECT f.id, f.title, f.followup_date, f.priority, f.status, c.company_name
     FROM followups f JOIN clients c ON f.client_id = c.id
     WHERE f.assigned_salesperson_id=? AND f.deleted_at IS NULL
     ORDER BY f.followup_date ASC LIMIT 5`,
    { replacements: [userId] }
  );

  return {
    today_followups: todayFollowups[0].count,
    overdue_followups: overdueFollowups[0].count,
    month_visits: monthVisits[0].count,
    pending_visits: pendingVisits[0].count,
    recent_visits: recentVisits,
    recent_followups: recentFollowups,
  };
};

const getSalesManagerDashboard = async (userId) => {
  const [pendingApprovals] = await sequelize.query(
    "SELECT COUNT(*) as count FROM visits WHERE salesperson_id IN (SELECT id FROM users WHERE manager_id=?) AND approval_status='pending' AND deleted_at IS NULL",
    { replacements: [userId] }
  );
  const [teamVisits] = await sequelize.query(
    "SELECT u.full_name, COUNT(v.id) as visit_count FROM users u LEFT JOIN visits v ON v.salesperson_id=u.id AND MONTH(v.visit_date)=MONTH(NOW()) AND v.deleted_at IS NULL WHERE u.manager_id=? GROUP BY u.id, u.full_name",
    { replacements: [userId] }
  );
  const [overdueFollowups] = await sequelize.query(
    "SELECT COUNT(*) as count FROM followups WHERE assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id=?) AND followup_date<CURDATE() AND status IN ('pending','overdue') AND deleted_at IS NULL",
    { replacements: [userId] }
  );
  let pipeline = [];
  try {
    const [p] = await sequelize.query(
      "SELECT current_stage, COUNT(*) as count, COALESCE(SUM(estimated_value),0) as value FROM opportunities WHERE (assigned_manager_id=? OR assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id=?)) AND current_stage NOT IN ('won','lost') AND deleted_at IS NULL GROUP BY current_stage",
      { replacements: [userId, userId] }
    );
    pipeline = p;
  } catch (err) {
    pipeline = [];
  }

  return { pending_approvals: pendingApprovals[0]?.count || 0, team_visits: teamVisits, overdue_followups: overdueFollowups[0]?.count || 0, pipeline };
};

const getManagementDashboard = async () => {
  const [farmerRows] = await sequelize.query(
    "SELECT (SELECT COUNT(*) FROM clients WHERE deleted_at IS NULL) as total_farmers, (SELECT COUNT(*) FROM clients WHERE LOWER(status) = 'active' AND deleted_at IS NULL) as active_farmers"
  );
  const [pondStats] = await sequelize.query(
    `SELECT COUNT(*) as total,
            COALESCE(SUM(CASE WHEN LOWER(status) = 'active' THEN 1 ELSE 0 END), 0) as active,
            COALESCE(SUM(CASE WHEN LOWER(status) = 'harvested' THEN 1 ELSE 0 END), 0) as harvested
     FROM ponds WHERE deleted_at IS NULL`
  );
  const [tankStats] = await sequelize.query(
    `SELECT COUNT(*) as total,
            COALESCE(SUM(CASE WHEN LOWER(status) = 'active' THEN 1 ELSE 0 END), 0) as active,
            COALESCE(SUM(CASE WHEN LOWER(status) = 'harvested' THEN 1 ELSE 0 END), 0) as harvested,
            ROUND(AVG(CASE WHEN abw IS NOT NULL AND TRIM(abw) != '' AND CAST(abw AS DECIMAL(10,2)) > 0 THEN CAST(abw AS DECIMAL(10,2)) ELSE NULL END), 2) as avg_abw
     FROM tanks`
  );
  const [asmRows] = await sequelize.query(
    "SELECT COUNT(*) as count FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'sales_manager' AND u.deleted_at IS NULL"
  );
  const [techExecRows] = await sequelize.query(
    "SELECT COUNT(*) as count FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'sales_executive' AND u.deleted_at IS NULL"
  );

  let pipelineTotal = [{ total_pipeline: 0, total_opportunities: 0 }];
  try {
    const [pt] = await sequelize.query(
      "SELECT COALESCE(SUM(estimated_value),0) as total_pipeline, COUNT(*) as total_opportunities FROM opportunities WHERE current_stage NOT IN ('won','lost') AND deleted_at IS NULL"
    );
    pipelineTotal = pt;
  } catch (e) {
    pipelineTotal = [{ total_pipeline: 0, total_opportunities: 0 }];
  }

  let brandPipeline = [];
  try {
    const [bp] = await sequelize.query(
      "SELECT b.name, COUNT(o.id) as count, COALESCE(SUM(o.estimated_value),0) as value FROM opportunities o LEFT JOIN brands b ON o.brand_id=b.id WHERE o.current_stage NOT IN ('won','lost') AND o.deleted_at IS NULL GROUP BY b.id, b.name ORDER BY value DESC"
    );
    brandPipeline = bp;
  } catch (e) {
    brandPipeline = [];
  }

  let salespersonPerf = [];
  try {
    const [sp] = await sequelize.query(
      "SELECT u.full_name, COUNT(v.id) as visits, SUM(CASE WHEN o.current_stage='won' THEN 1 ELSE 0 END) as won_opps, COALESCE(SUM(CASE WHEN o.current_stage='won' THEN o.won_value ELSE 0 END),0) as won_value FROM users u LEFT JOIN visits v ON v.salesperson_id=u.id AND MONTH(v.visit_date)=MONTH(NOW()) AND v.deleted_at IS NULL LEFT JOIN opportunities o ON o.assigned_salesperson_id=u.id AND MONTH(o.updated_at)=MONTH(NOW()) AND o.deleted_at IS NULL WHERE u.role_id=(SELECT id FROM roles WHERE name='sales_executive') AND u.deleted_at IS NULL GROUP BY u.id, u.full_name ORDER BY visits DESC, won_value DESC"
    );
    salespersonPerf = sp;
  } catch (e) {
    try {
      const [sp] = await sequelize.query(
        "SELECT u.full_name, COUNT(v.id) as visits, 0 as won_opps, 0 as won_value FROM users u LEFT JOIN visits v ON v.salesperson_id=u.id AND MONTH(v.visit_date)=MONTH(NOW()) AND v.deleted_at IS NULL WHERE u.role_id=(SELECT id FROM roles WHERE name='sales_executive') AND u.deleted_at IS NULL GROUP BY u.id, u.full_name ORDER BY visits DESC"
      );
      salespersonPerf = sp;
    } catch {
      salespersonPerf = [];
    }
  }

  let monthBilling = [{ total_billed: 0, total_outstanding: 0 }];
  try {
    const [mb] = await sequelize.query(
      "SELECT COALESCE(SUM(invoice_amount),0) as total_billed, COALESCE(SUM(outstanding_amount),0) as total_outstanding FROM billing_records WHERE MONTH(invoice_date)=MONTH(NOW())"
    );
    monthBilling = mb;
  } catch (e) {
    monthBilling = [{ total_billed: 0, total_outstanding: 0 }];
  }

  const totalTanks = Number(pondStats[0]?.total || 0) + Number(tankStats[0]?.total || 0);
  const activeTanks = Number(pondStats[0]?.active || 0) + Number(tankStats[0]?.active || 0);
  const harvestedTanks = Number(pondStats[0]?.harvested || 0) + Number(tankStats[0]?.harvested || 0);
  const averageAbw = tankStats[0]?.avg_abw !== null && tankStats[0]?.avg_abw !== undefined ? Number(tankStats[0].avg_abw) : 0;

  // Followed-up tests by admins for Admin Dashboard display
  let followedUpTests = [];
  let testFollowupStats = { due: 0, overdue: 0, completed: 0 };
  try {
    const [tests] = await sequelize.query(`
      SELECT 
        s.id,
        s.test_type,
        s.date as test_date,
        COALESCE(s.due_date, s.date) as due_date,
        s.submission_time,
        s.followup_status,
        s.followed_up_by_id,
        s.followed_up_by_name,
        s.followed_up_at,
        s.admin_completion_notes,
        s.user_id,
        COALESCE(s.user_name, u.full_name, 'Field Executive') as submitter_name,
        COALESCE(s.role, r.display_name, r.name, 'Technical Executive') as submitter_role,
        CASE 
          WHEN LOWER(COALESCE(s.role, r.display_name, r.name, '')) LIKE '%asm%' 
            OR LOWER(COALESCE(s.role, r.name, '')) LIKE '%sales_manager%' 
            OR LOWER(COALESCE(s.role, r.display_name, '')) LIKE '%area sales manager%'
          THEN 'asm'
          ELSE 'agent'
        END as submitter_type,
        s.farmer_id,
        COALESCE(c.company_name, f.name, 'Farmer') as farmer_name,
        COALESCE(c.mobile, f.phone, '—') as farmer_mobile,
        s.tank_id,
        COALESCE(p.pond_name, t.name, CONCAT('Tank #', s.tank_id)) as tank_name,
        COALESCE(s.locality, c.village, c.city, f.district, 'Local') as locality,
        s.data as parameters,
        n.is_read as notification_is_read,
        n.read_at as notification_read_at
      FROM submissions s
      LEFT JOIN users u ON u.id = CAST(NULLIF(s.user_id, '') AS UNSIGNED)
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN clients c ON c.id = CAST(NULLIF(s.farmer_id, '') AS UNSIGNED)
      LEFT JOIN farmers f ON f.id = CAST(NULLIF(s.farmer_id, '') AS UNSIGNED)
      LEFT JOIN ponds p ON p.id = CAST(NULLIF(s.tank_id, '') AS UNSIGNED)
      LEFT JOIN tanks t ON t.id = CAST(NULLIF(s.tank_id, '') AS UNSIGNED)
      LEFT JOIN (
        SELECT reference_id, MAX(is_read) as is_read, MAX(read_at) as read_at
        FROM notifications 
        WHERE reference_type = 'test_submission'
        GROUP BY reference_id
      ) n ON n.reference_id = s.id
      WHERE s.followup_status = 'completed' AND s.followed_up_by_name IS NOT NULL
      ORDER BY s.followed_up_at DESC
      LIMIT 25
    `);
    followedUpTests = tests;

    const [[stats]] = await sequelize.query(`
      SELECT 
        SUM(CASE WHEN followup_status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN followup_status != 'completed' AND COALESCE(due_date, date) < CURDATE() THEN 1 ELSE 0 END) as overdue,
        SUM(CASE WHEN followup_status != 'completed' AND COALESCE(due_date, date) >= CURDATE() THEN 1 ELSE 0 END) as due
      FROM submissions
    `);
    testFollowupStats = {
      completed: Number(stats?.completed || 0),
      overdue: Number(stats?.overdue || 0),
      due: Number(stats?.due || 0)
    };
  } catch (err) {
    console.error('Error fetching followed-up tests for dashboard:', err);
  }

  return {
    total_farmers: Number(farmerRows[0]?.total_farmers || 0),
    active_farmers: Number(farmerRows[0]?.active_farmers || 0),
    total_tanks: totalTanks,
    active_tanks: activeTanks,
    harvested_tanks: harvestedTanks,
    average_abw: averageAbw,
    total_asms: Number(asmRows[0]?.count || 0),
    total_technical_executives: Number(techExecRows[0]?.count || 0),
    pipeline_total: pipelineTotal[0],
    brand_pipeline: brandPipeline,
    salesperson_performance: salespersonPerf,
    month_billing: monthBilling[0],
    followed_up_tests: followedUpTests,
    test_followup_stats: testFollowupStats,
  };
};

const getDashboard = async (req, res) => {
  try {
    let data;
    const { role, id: userId } = req.user;

    if (role === 'sales_executive') {
      data = await getSalesExecutiveDashboard(userId);
    } else if (role === 'sales_manager') {
      data = await getSalesManagerDashboard(userId);
    } else if (['management', 'super_admin', 'admin'].includes(role)) {
      data = await getManagementDashboard();
    } else if (role === 'backend_ops') {
      const [pendingQuotations] = await sequelize.query("SELECT COUNT(*) as count FROM quotations WHERE status IN ('draft','sent','under_discussion') AND deleted_at IS NULL");
      const [pendingPOs] = await sequelize.query("SELECT COUNT(*) as count FROM purchase_orders WHERE order_status IN ('received','processing') AND deleted_at IS NULL");
      const [pendingBilling] = await sequelize.query("SELECT COUNT(*) as count FROM billing_records WHERE is_matched=0");
      data = { pending_quotations: pendingQuotations[0].count, pending_pos: pendingPOs[0].count, unmatched_billing: pendingBilling[0].count };
    }

    return sendSuccess(res, 'Dashboard fetched', data);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const getLiveSubmissions = async (req, res) => {
  try {
    const sql = `
      SELECT * FROM (
        SELECT 
          s.id,
          'test_submission' as source,
          COALESCE(s.test_type, 'Field Test') as submission_type,
          s.user_id,
          COALESCE(s.user_name, u.full_name, 'Field Executive') as submitter_name,
          COALESCE(u.username, u.email, CONCAT('agent', LPAD(COALESCE(s.user_id, '1'), 3, '0'))) as username,
          COALESCE(s.role, r.name, 'technical_executive') as submitter_role,
          s.farmer_id,
          COALESCE(c.company_name, f.name, 'Farmer') as farmer_name,
          COALESCE(c.mobile, f.phone, '—') as farmer_mobile,
          COALESCE(s.locality, c.village, c.city, f.district, 'Local') as locality,
          s.tank_id,
          COALESCE(p.pond_name, t.name, CONCAT('Tank #', s.tank_id)) as tank_name,
          s.submission_time,
          s.date,
          UPPER(s.status) as status,
          s.data as parameters,
          s.latitude,
          s.longitude,
          s.accuracy,
          s.review_notes as notes,
          s.followed_up_by_id,
          s.followed_up_by_name,
          s.followed_up_at,
          s.admin_completion_notes,
          s.followup_status,
          s.created_at
        FROM submissions s
        LEFT JOIN users u ON u.id = CAST(NULLIF(s.user_id, '') AS UNSIGNED)
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN clients c ON c.id = CAST(NULLIF(s.farmer_id, '') AS UNSIGNED)
        LEFT JOIN farmers f ON f.id = CAST(NULLIF(s.farmer_id, '') AS UNSIGNED)
        LEFT JOIN ponds p ON p.id = CAST(NULLIF(s.tank_id, '') AS UNSIGNED)
        LEFT JOIN tanks t ON t.id = CAST(NULLIF(s.tank_id, '') AS UNSIGNED)
        WHERE (s.date = CURDATE() OR DATE(s.created_at) = CURDATE() OR s.date = DATE_FORMAT(CURDATE(), '%Y-%m-%d'))

        UNION ALL

        SELECT
          CONCAT('VST-', v.id) as id,
          'visit' as source,
          CONCAT(REPLACE(REPLACE(v.meeting_type, '_', ' '), 'casual', 'Routine'), ' Visit') as submission_type,
          v.salesperson_id as user_id,
          u.full_name as submitter_name,
          COALESCE(u.username, u.email, CONCAT('agent', LPAD(v.salesperson_id, 3, '0'))) as username,
          r.name as submitter_role,
          v.client_id as farmer_id,
          c.company_name as farmer_name,
          c.mobile as farmer_mobile,
          COALESCE(v.gps_address, c.city, 'Local') as locality,
          v.tank_id,
          COALESCE(p.pond_name, v.tank_number, 'Main Pond') as tank_name,
          TIME_FORMAT(v.visit_time, '%h:%i %p') as submission_time,
          v.visit_date as date,
          UPPER(v.approval_status) as status,
          v.water_quality as parameters,
          v.latitude,
          v.longitude,
          NULL as accuracy,
          COALESCE(v.meeting_highlights, v.remarks) as notes,
          NULL as followed_up_by_id,
          NULL as followed_up_by_name,
          NULL as followed_up_at,
          NULL as admin_completion_notes,
          NULL as followup_status,
          v.created_at
        FROM visits v
        JOIN users u ON v.salesperson_id = u.id
        JOIN roles r ON u.role_id = r.id
        JOIN clients c ON v.client_id = c.id
        LEFT JOIN ponds p ON p.id = v.tank_id
        WHERE (v.visit_date = CURDATE() OR DATE(v.created_at) = CURDATE()) AND v.deleted_at IS NULL
      ) combined
      ORDER BY combined.created_at DESC, combined.submission_time DESC
    `;

    const [submissions] = await sequelize.query(sql);

    const totalToday = submissions.length;
    const verifiedCount = submissions.filter(s => ['VERIFIED', 'APPROVED'].includes(s.status)).length;
    const pendingCount = submissions.filter(s => ['PENDING', 'PENDING_VERIFICATION'].includes(s.status)).length;

    return sendSuccess(res, "Today's live submissions fetched", {
      total_today: totalToday,
      verified_count: verifiedCount,
      pending_count: pendingCount,
      submissions,
    });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

module.exports = { getDashboard, getLiveSubmissions };
