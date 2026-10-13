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
  const [pipeline] = await sequelize.query(
    "SELECT current_stage, COUNT(*) as count, COALESCE(SUM(estimated_value),0) as value FROM opportunities WHERE (assigned_manager_id=? OR assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id=?)) AND current_stage NOT IN ('won','lost') AND deleted_at IS NULL GROUP BY current_stage",
    { replacements: [userId, userId] }
  );

  return { pending_approvals: pendingApprovals[0].count, team_visits: teamVisits, overdue_followups: overdueFollowups[0].count, pipeline };
};

const getManagementDashboard = async () => {
  const [pipelineTotal] = await sequelize.query(
    "SELECT COALESCE(SUM(estimated_value),0) as total_pipeline, COUNT(*) as total_opportunities FROM opportunities WHERE current_stage NOT IN ('won','lost') AND deleted_at IS NULL"
  );
  const [brandPipeline] = await sequelize.query(
    "SELECT b.name, COUNT(o.id) as count, COALESCE(SUM(o.estimated_value),0) as value FROM opportunities o LEFT JOIN brands b ON o.brand_id=b.id WHERE o.current_stage NOT IN ('won','lost') AND o.deleted_at IS NULL GROUP BY b.id, b.name ORDER BY value DESC"
  );
  const [salespersonPerf] = await sequelize.query(
    "SELECT u.full_name, COUNT(v.id) as visits, SUM(CASE WHEN o.current_stage='won' THEN 1 ELSE 0 END) as won_opps, COALESCE(SUM(CASE WHEN o.current_stage='won' THEN o.won_value ELSE 0 END),0) as won_value FROM users u LEFT JOIN visits v ON v.salesperson_id=u.id AND MONTH(v.visit_date)=MONTH(NOW()) AND v.deleted_at IS NULL LEFT JOIN opportunities o ON o.assigned_salesperson_id=u.id AND MONTH(o.updated_at)=MONTH(NOW()) AND o.deleted_at IS NULL WHERE u.role_id=(SELECT id FROM roles WHERE name='sales_executive') AND u.deleted_at IS NULL GROUP BY u.id, u.full_name ORDER BY won_value DESC"
  );
  const [monthBilling] = await sequelize.query(
    "SELECT COALESCE(SUM(invoice_amount),0) as total_billed, COALESCE(SUM(outstanding_amount),0) as total_outstanding FROM billing_records WHERE MONTH(invoice_date)=MONTH(NOW())"
  );

  return {
    pipeline_total: pipelineTotal[0],
    brand_pipeline: brandPipeline,
    salesperson_performance: salespersonPerf,
    month_billing: monthBilling[0],
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

module.exports = { getDashboard };
