const sequelize = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');

const getSalesExecutiveDashboard = async (userId) => {
  const [farmerStats] = await sequelize.query(
    `SELECT 
      COUNT(*) as total_farmers,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active_farmers,
      COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_farmers,
      COUNT(CASE WHEN status IN ('forcely_closed', 'forced_closed', 'closed') THEN 1 END) as forcely_closed_farmers
    FROM clients 
    WHERE (assigned_salesperson_id=? OR created_by=?) AND deleted_at IS NULL`,
    { replacements: [userId, userId] }
  );
  const [tankStats] = await sequelize.query(
    `SELECT 
      COUNT(*) as total_tanks,
      COUNT(CASE WHEN p.status = 'active' THEN 1 END) as active_tanks,
      COUNT(CASE WHEN p.status = 'harvested' OR p.status = 'inactive' OR EXISTS (
        SELECT 1 FROM visits v 
        WHERE v.deleted_at IS NULL 
          AND (v.tank_id = p.id OR (v.client_id = p.client_id AND v.tank_number = p.tank_number))
          AND v.harvest_details IS NOT NULL 
          AND v.harvest_details != '' 
          AND v.harvest_details != '{}'
          AND v.harvest_details != 'null'
      ) THEN 1 END) as harvested_tanks,
      COUNT(CASE WHEN p.status != 'active' OR p.status IS NULL THEN 1 END) as inactive_tanks
    FROM ponds p
    JOIN clients c ON (p.client_id = c.id OR p.farmer_id = c.id)
    WHERE (c.assigned_salesperson_id=? OR c.created_by=?) AND p.deleted_at IS NULL AND c.deleted_at IS NULL`,
    { replacements: [userId, userId] }
  );
  const [submissionsCount] = await sequelize.query(
    "SELECT COUNT(*) as count FROM visits WHERE salesperson_id=? AND deleted_at IS NULL",
    { replacements: [userId] }
  );
  const [dueFollowups] = await sequelize.query(
    "SELECT COUNT(*) as count FROM followups WHERE assigned_salesperson_id=? AND status IN ('pending','overdue') AND followup_date <= CURDATE() AND deleted_at IS NULL",
    { replacements: [userId] }
  );
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
  const [recentVisits] = await sequelize.query(
    `SELECT v.id, v.client_id, v.visit_date, v.visit_time, v.meeting_type,
            v.tank_number, c.company_name, c.city, sp.full_name as salesperson_name
     FROM visits v
     JOIN clients c ON v.client_id = c.id
     JOIN users sp ON v.salesperson_id = sp.id
     WHERE v.salesperson_id=? AND v.deleted_at IS NULL
     ORDER BY v.visit_date DESC, v.created_at DESC LIMIT 5`,
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
    total_farmers: Number(farmerStats[0]?.total_farmers || 0),
    active_farmers: Number(farmerStats[0]?.active_farmers || 0),
    inactive_farmers: Number(farmerStats[0]?.inactive_farmers || 0),
    my_farmers: Number(farmerStats[0]?.my_farmers || 0),
    tech_exec_farmers: Number(farmerStats[0]?.tech_exec_farmers || 0),
    my_farmers_list: myFarmersList || [],
    tech_exec_farmers_list: techFarmersList || [],
    forcely_closed_farmers: Number(farmerStats[0]?.forcely_closed_farmers || 0),
    total_tanks: Number(tankStats[0]?.total_tanks || 0),
    active_tanks: Number(tankStats[0]?.active_tanks || 0),
    harvested_tanks: Number(tankStats[0]?.harvested_tanks || 0),
    inactive_tanks: Number(tankStats[0]?.inactive_tanks || 0),
    total_clients: Number(farmerStats[0]?.total_farmers || 0),
    total_submissions: submissionsCount[0]?.count || 0,
    due_followups: dueFollowups[0]?.count || 0,
    today_followups: todayFollowups[0]?.count || 0,
    overdue_followups: overdueFollowups[0]?.count || 0,
    month_visits: monthVisits[0]?.count || 0,
    recent_visits: recentVisits,
    recent_followups: recentFollowups,
  };
};

const getSalesManagerDashboard = async (userId) => {
  const [farmerStats] = await sequelize.query(
    `SELECT 
      COUNT(*) as total_farmers,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active_farmers,
      COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_farmers,
      COUNT(CASE WHEN status IN ('forcely_closed', 'forced_closed', 'closed') THEN 1 END) as forcely_closed_farmers,
      COUNT(CASE WHEN (assigned_salesperson_id = :userId OR ((assigned_manager_id = :userId OR created_by = :userId) AND (assigned_salesperson_id IS NULL OR assigned_salesperson_id = :userId))) THEN 1 END) as my_farmers,
      COUNT(CASE WHEN assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id = :userId) THEN 1 END) as tech_exec_farmers
    FROM clients 
    WHERE (assigned_manager_id=:userId OR assigned_salesperson_id=:userId OR created_by=:userId OR assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id=:userId) OR created_by IN (SELECT id FROM users WHERE manager_id=:userId)) AND deleted_at IS NULL`,
    { replacements: { userId } }
  );

  const [myFarmersList] = await sequelize.query(
    `SELECT c.id, c.company_name, c.contact_person, c.mobile, c.city, c.village, c.farm_extent_acres, c.number_of_tanks, c.status
     FROM clients c
     WHERE (c.assigned_salesperson_id = :userId OR ((c.assigned_manager_id = :userId OR c.created_by = :userId) AND (c.assigned_salesperson_id IS NULL OR c.assigned_salesperson_id = :userId)))
       AND c.deleted_at IS NULL
     ORDER BY c.company_name ASC`,
    { replacements: { userId } }
  );

  const [techFarmersList] = await sequelize.query(
    `SELECT c.id, c.company_name, c.contact_person, c.mobile, c.city, c.village, c.farm_extent_acres, c.number_of_tanks, c.status,
            sp.full_name as executive_name, sp.mobile as executive_mobile
     FROM clients c
     JOIN users sp ON c.assigned_salesperson_id = sp.id
     WHERE c.assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id = :userId)
       AND c.deleted_at IS NULL
     ORDER BY c.company_name ASC`,
    { replacements: { userId } }
  );
  const [tankStats] = await sequelize.query(
    `SELECT 
      COUNT(*) as total_tanks,
      COUNT(CASE WHEN p.status = 'active' THEN 1 END) as active_tanks,
      COUNT(CASE WHEN p.status = 'harvested' OR p.status = 'inactive' OR EXISTS (
        SELECT 1 FROM visits v 
        WHERE v.deleted_at IS NULL 
          AND (v.tank_id = p.id OR (v.client_id = p.client_id AND v.tank_number = p.tank_number))
          AND v.harvest_details IS NOT NULL 
          AND v.harvest_details != '' 
          AND v.harvest_details != '{}'
          AND v.harvest_details != 'null'
      ) THEN 1 END) as harvested_tanks,
      COUNT(CASE WHEN p.status != 'active' OR p.status IS NULL THEN 1 END) as inactive_tanks
    FROM ponds p
    JOIN clients c ON (p.client_id = c.id OR p.farmer_id = c.id)
    WHERE (c.assigned_manager_id=? OR c.assigned_salesperson_id=? OR c.created_by=? OR c.assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id=?) OR c.created_by IN (SELECT id FROM users WHERE manager_id=?)) AND p.deleted_at IS NULL AND c.deleted_at IS NULL`,
    { replacements: [userId, userId, userId, userId, userId] }
  );
  const [submissionsCount] = await sequelize.query(
    "SELECT COUNT(*) as count FROM visits WHERE (salesperson_id=? OR salesperson_id IN (SELECT id FROM users WHERE manager_id=?)) AND deleted_at IS NULL",
    { replacements: [userId, userId] }
  );
  const [dueFollowups] = await sequelize.query(
    "SELECT COUNT(*) as count FROM followups WHERE (assigned_salesperson_id=? OR assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id=?)) AND status IN ('pending','overdue') AND followup_date <= CURDATE() AND deleted_at IS NULL",
    { replacements: [userId, userId] }
  );
  const [teamVisits] = await sequelize.query(
    "SELECT u.full_name, COUNT(v.id) as visit_count FROM users u LEFT JOIN visits v ON v.salesperson_id=u.id AND MONTH(v.visit_date)=MONTH(NOW()) AND YEAR(v.visit_date)=YEAR(NOW()) AND v.deleted_at IS NULL WHERE u.manager_id=? GROUP BY u.id, u.full_name",
    { replacements: [userId] }
  );
  const [teamVisitsMonth] = await sequelize.query(
    "SELECT COUNT(v.id) as count FROM visits v JOIN users u ON v.salesperson_id=u.id WHERE u.manager_id=? AND MONTH(v.visit_date)=MONTH(NOW()) AND YEAR(v.visit_date)=YEAR(NOW()) AND v.deleted_at IS NULL",
    { replacements: [userId] }
  );
  const [overdueFollowups] = await sequelize.query(
    "SELECT COUNT(*) as count FROM followups WHERE assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id=?) AND followup_date<CURDATE() AND status IN ('pending','overdue') AND deleted_at IS NULL",
    { replacements: [userId] }
  );
  const [teamMembers] = await sequelize.query(
    "SELECT COUNT(*) as count FROM users WHERE manager_id=? AND deleted_at IS NULL",
    { replacements: [userId] }
  );
  const [recentVisits] = await sequelize.query(
    `SELECT v.id, v.client_id, v.visit_date, v.visit_time, v.meeting_type,
            v.tank_number, c.company_name, c.city, sp.full_name as salesperson_name
     FROM visits v
     JOIN clients c ON v.client_id = c.id
     JOIN users sp ON v.salesperson_id = sp.id
     WHERE (v.salesperson_id=? OR v.salesperson_id IN (SELECT id FROM users WHERE manager_id=?))
       AND v.deleted_at IS NULL
     ORDER BY v.visit_date DESC, v.created_at DESC LIMIT 5`,
    { replacements: [userId, userId] }
  );

  return {
    total_farmers: Number(farmerStats[0]?.total_farmers || 0),
    active_farmers: Number(farmerStats[0]?.active_farmers || 0),
    inactive_farmers: Number(farmerStats[0]?.inactive_farmers || 0),
    forcely_closed_farmers: Number(farmerStats[0]?.forcely_closed_farmers || 0),
    total_tanks: Number(tankStats[0]?.total_tanks || 0),
    active_tanks: Number(tankStats[0]?.active_tanks || 0),
    harvested_tanks: Number(tankStats[0]?.harvested_tanks || 0),
    inactive_tanks: Number(tankStats[0]?.inactive_tanks || 0),
    total_clients: Number(farmerStats[0]?.total_farmers || 0),
    total_submissions: submissionsCount[0]?.count || 0,
    due_followups: dueFollowups[0]?.count || 0,
    team_visits_month: teamVisitsMonth[0]?.count || 0,
    overdue_followups: overdueFollowups[0]?.count || 0,
    team_members: teamMembers[0]?.count || teamVisits.length,
    team_visits: teamVisits,
    recent_visits: recentVisits,
  };
};

const getManagementDashboard = async () => {
  const [farmerStats] = await sequelize.query(`
    SELECT 
      COUNT(*) as total_farmers,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active_farmers,
      COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_farmers,
      COUNT(CASE WHEN status IN ('forcely_closed', 'forced_closed', 'closed') THEN 1 END) as forcely_closed_farmers
    FROM clients 
    WHERE deleted_at IS NULL
  `);
  const [tankStats] = await sequelize.query(`
    SELECT 
      COUNT(*) as total_tanks,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active_tanks,
      COUNT(CASE WHEN status = 'harvested' OR status = 'inactive' OR EXISTS (
        SELECT 1 FROM visits v 
        WHERE v.deleted_at IS NULL 
          AND (v.tank_id = ponds.id OR (v.client_id = ponds.client_id AND v.tank_number = ponds.tank_number))
          AND v.harvest_details IS NOT NULL 
          AND v.harvest_details != '' 
          AND v.harvest_details != '{}'
          AND v.harvest_details != 'null'
      ) THEN 1 END) as harvested_tanks,
      COUNT(CASE WHEN status != 'active' OR status IS NULL THEN 1 END) as inactive_tanks
    FROM ponds 
    WHERE deleted_at IS NULL
  `);
  const [submissionsCount] = await sequelize.query(
    "SELECT COUNT(*) as total FROM visits WHERE deleted_at IS NULL"
  );
  const [dueFollowups] = await sequelize.query(
    "SELECT COUNT(*) as count FROM followups WHERE status IN ('pending','overdue') AND followup_date <= CURDATE() AND deleted_at IS NULL"
  );
  const [salespersonPerf] = await sequelize.query(
    "SELECT u.full_name, COUNT(v.id) as visits FROM users u LEFT JOIN visits v ON v.salesperson_id=u.id AND MONTH(v.visit_date)=MONTH(NOW()) AND YEAR(v.visit_date)=YEAR(NOW()) AND v.deleted_at IS NULL WHERE u.role_id=(SELECT id FROM roles WHERE name='sales_executive') AND u.deleted_at IS NULL GROUP BY u.id, u.full_name ORDER BY visits DESC"
  );
  const [monthVisits] = await sequelize.query(
    "SELECT COUNT(*) as count FROM visits WHERE MONTH(visit_date)=MONTH(NOW()) AND YEAR(visit_date)=YEAR(NOW()) AND deleted_at IS NULL"
  );
  const [executivesCount] = await sequelize.query(
    "SELECT COUNT(*) as count FROM users WHERE role_id=(SELECT id FROM roles WHERE name='sales_executive') AND deleted_at IS NULL"
  );
  const [recentVisits] = await sequelize.query(
    `SELECT v.id, v.client_id, v.visit_date, v.visit_time, v.meeting_type,
            v.tank_number, c.company_name, c.city, sp.full_name as salesperson_name
     FROM visits v
     JOIN clients c ON v.client_id = c.id
     JOIN users sp ON v.salesperson_id = sp.id
     WHERE v.deleted_at IS NULL
     ORDER BY v.visit_date DESC, v.created_at DESC LIMIT 5`
  );

  return {
    total_farmers: Number(farmerStats[0]?.total_farmers || 0),
    active_farmers: Number(farmerStats[0]?.active_farmers || 0),
    inactive_farmers: Number(farmerStats[0]?.inactive_farmers || 0),
    forcely_closed_farmers: Number(farmerStats[0]?.forcely_closed_farmers || 0),
    total_tanks: Number(tankStats[0]?.total_tanks || 0),
    active_tanks: Number(tankStats[0]?.active_tanks || 0),
    harvested_tanks: Number(tankStats[0]?.harvested_tanks || 0),
    inactive_tanks: Number(tankStats[0]?.inactive_tanks || 0),
    total_clients: Number(farmerStats[0]?.total_farmers || 0),
    total_submissions: submissionsCount[0]?.total || 0,
    due_followups: dueFollowups[0]?.count || 0,
    month_visits: monthVisits[0]?.count || 0,
    field_executives: executivesCount[0]?.count || salespersonPerf.length,
    salesperson_performance: salespersonPerf,
    recent_visits: recentVisits,
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
      data = await getManagementDashboard();
    }

    return sendSuccess(res, 'Dashboard fetched', data);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

module.exports = { getDashboard };
