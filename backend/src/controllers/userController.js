const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { getPagination, buildMeta } = require('../utils/pagination');
const { log } = require('../utils/audit');

const listUsers = async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const { role, status, manager_id, search, region } = req.query;

  let where = 'u.deleted_at IS NULL';
  const replacements = [];

  if (role) { where += ' AND r.name = ?'; replacements.push(role); }
  if (status) { where += ' AND u.status = ?'; replacements.push(status); }
  if (manager_id) { where += ' AND u.manager_id = ?'; replacements.push(manager_id); }
  if (region) {
    if (role === 'sales_manager') {
      where += ' AND u.region = ?';
      replacements.push(region);
    } else {
      where += ' AND (u.region = ? OR u.id IN (SELECT id FROM users WHERE manager_id IN (SELECT id FROM users WHERE region = ? AND role_id = (SELECT id FROM roles WHERE name = \'sales_manager\'))))';
      replacements.push(region, region);
    }
  }
  if (search) {
    where += ' AND (u.full_name LIKE ? OR u.email LIKE ? OR u.mobile LIKE ? OR u.region LIKE ? OR u.area LIKE ?)';
    replacements.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  try {
    const [[{ total }]] = await sequelize.query(
      `SELECT COUNT(*) as total FROM users u JOIN roles r ON u.role_id = r.id WHERE ${where}`,
      { replacements }
    );

    const [users] = await sequelize.query(
      `SELECT u.id, u.uuid, u.full_name, u.email, u.mobile, u.department, u.region, u.area, u.status,
              u.joining_date, u.last_login, u.created_at,
              u.manager_id, u.role_id,
              r.name as role, r.display_name as role_display,
              m.full_name as manager_name,
              (SELECT GROUP_CONCAT(te.full_name SEPARATOR ', ') FROM users te WHERE te.manager_id = u.id AND te.deleted_at IS NULL AND te.status = 'active') as assigned_executives_names,
              (SELECT COUNT(*) FROM users te WHERE te.manager_id = u.id AND te.deleted_at IS NULL AND te.status = 'active') as assigned_executives_count
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN users m ON u.manager_id = m.id AND m.deleted_at IS NULL AND m.status = 'active'
       WHERE ${where}
       ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
      { replacements: [...replacements, limit, offset] }
    );

    return sendPaginated(res, 'Users fetched', users, buildMeta(total, page, limit));
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const createUser = async (req, res) => {
  const { full_name, email, mobile, role_id, manager_id, department, region, area, joining_date, password, executive_ids } = req.body;

  try {
    const [existing] = await sequelize.query(
      'SELECT id FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1',
      { replacements: [email] }
    );
    if (existing[0]) return sendError(res, 'Email already registered', 409);

    const hash = await bcrypt.hash(password || 'Welcome@123', 12);
    const uuid = uuidv4();

    await sequelize.query(
      `INSERT INTO users (uuid, full_name, email, mobile, password_hash, role_id, manager_id, department, region, area, joining_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      { replacements: [uuid, full_name, email, mobile, hash, role_id, manager_id || null, department || null, region || null, area || null, joining_date || null, req.user.id] }
    );

    const [[user]] = await sequelize.query(
      `SELECT u.id, u.uuid, u.full_name, u.email, r.name as role FROM users u
       JOIN roles r ON u.role_id = r.id WHERE u.uuid = ? LIMIT 1`,
      { replacements: [uuid] }
    );

    // If technical executives are assigned to this ASM/manager
    if (Array.isArray(executive_ids) && executive_ids.length > 0) {
      await sequelize.query(
        `UPDATE users SET manager_id = ? WHERE id IN (?) AND deleted_at IS NULL`,
        { replacements: [user.id, executive_ids] }
      );
    }

    await log({ action: 'USER_CREATED', module: 'users', recordId: user.id, newValue: { email }, performedBy: req.user.id, req });

    return sendSuccess(res, 'User created successfully', user, 201);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const getUser = async (req, res) => {
  try {
    const [users] = await sequelize.query(
      `SELECT u.id, u.uuid, u.full_name, u.email, u.mobile, u.department, u.region, u.area, u.status,
              u.joining_date, u.last_login, u.created_at, u.updated_at,
              r.id as role_id, r.name as role, r.display_name as role_display,
              m.id as manager_id, m.full_name as manager_name, m.email as manager_email, m.mobile as manager_mobile, m.region as manager_region
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN users m ON u.manager_id = m.id
       WHERE u.id = ? AND u.deleted_at IS NULL LIMIT 1`,
      { replacements: [req.params.id] }
    );
    if (!users[0]) return sendError(res, 'User not found', 404);

    const user = users[0];

    // Get assigned technical executives if any (e.g. for ASM)
    const [assignedExecutives] = await sequelize.query(
      `SELECT u.id, u.full_name, u.email, u.mobile, u.area, u.status, u.last_login,
              (SELECT COUNT(*) FROM visits WHERE salesperson_id = u.id AND deleted_at IS NULL) as visits_count,
              (SELECT COUNT(*) FROM clients WHERE (assigned_salesperson_id = u.id OR (assigned_salesperson_id IS NULL AND created_by = u.id)) AND deleted_at IS NULL) as farmers_count
       FROM users u 
       WHERE u.manager_id = ? AND u.deleted_at IS NULL
       ORDER BY u.full_name ASC`,
      { replacements: [user.id] }
    );
    user.assigned_executives = assignedExecutives;
    user.executive_ids = assignedExecutives.map(e => e.id);

    // Compute stats & recent records based on role
    let totalFarmers = 0;
    let totalVisits = 0;
    let totalPonds = 0;
    user.recent_visits = [];
    user.recent_farmers = [];

    if (user.role === 'sales_manager') {
      const execIds = assignedExecutives.map(e => e.id);
      const allTeamIds = [user.id, ...execIds];
      const placeholders = allTeamIds.map(() => '?').join(',');

      const [farmerCountRes] = await sequelize.query(
        `SELECT COUNT(DISTINCT id) as count FROM clients 
         WHERE (assigned_manager_id = ? OR assigned_salesperson_id IN (${placeholders}) OR created_by IN (${placeholders}))
           AND deleted_at IS NULL`,
        { replacements: [user.id, ...allTeamIds, ...allTeamIds] }
      );
      totalFarmers = parseInt(farmerCountRes[0]?.count || 0, 10);

      const [visitCountRes] = await sequelize.query(
        `SELECT COUNT(DISTINCT id) as count FROM visits 
         WHERE salesperson_id IN (${placeholders}) AND deleted_at IS NULL`,
        { replacements: allTeamIds }
      );
      totalVisits = parseInt(visitCountRes[0]?.count || 0, 10);

      const [pondCountRes] = await sequelize.query(
        `SELECT COUNT(DISTINCT p.id) as count FROM ponds p
         JOIN clients c ON p.client_id = c.id
         WHERE (c.assigned_manager_id = ? OR c.assigned_salesperson_id IN (${placeholders}) OR c.created_by IN (${placeholders}))
           AND p.deleted_at IS NULL AND c.deleted_at IS NULL`,
        { replacements: [user.id, ...allTeamIds, ...allTeamIds] }
      );
      totalPonds = parseInt(pondCountRes[0]?.count || 0, 10);

      // Recent visits across ASM + team
      const [recentVisits] = await sequelize.query(
        `SELECT v.id, v.visit_date, v.meeting_type as visit_type, v.remarks, v.created_at,
                c.id as client_id, c.company_name as farmer_name, c.village, c.district,
                sp.full_name as technician_name
         FROM visits v
         JOIN clients c ON v.client_id = c.id
         LEFT JOIN users sp ON v.salesperson_id = sp.id
         WHERE v.salesperson_id IN (${placeholders}) AND v.deleted_at IS NULL
         ORDER BY v.visit_date DESC, v.id DESC LIMIT 8`,
        { replacements: allTeamIds }
      );
      user.recent_visits = recentVisits;

      // Recent farmers under ASM + team
      const [recentFarmers] = await sequelize.query(
        `SELECT c.id, c.company_name, c.contact_person, c.mobile, c.village, c.district, c.area, c.status, c.created_at,
                sp.full_name as assigned_to_name
         FROM clients c
         LEFT JOIN users sp ON c.assigned_salesperson_id = sp.id
         WHERE (c.assigned_manager_id = ? OR c.assigned_salesperson_id IN (${placeholders}) OR c.created_by IN (${placeholders}))
           AND c.deleted_at IS NULL
         ORDER BY c.created_at DESC LIMIT 8`,
        { replacements: [user.id, ...allTeamIds, ...allTeamIds] }
      );
      user.recent_farmers = recentFarmers;

    } else if (user.role === 'sales_executive') {
      const [farmerCountRes] = await sequelize.query(
        `SELECT COUNT(DISTINCT id) as count FROM clients 
         WHERE (assigned_salesperson_id = ? OR (assigned_salesperson_id IS NULL AND created_by = ?))
           AND deleted_at IS NULL`,
        { replacements: [user.id, user.id] }
      );
      totalFarmers = parseInt(farmerCountRes[0]?.count || 0, 10);

      const [visitCountRes] = await sequelize.query(
        `SELECT COUNT(DISTINCT id) as count FROM visits 
         WHERE salesperson_id = ? AND deleted_at IS NULL`,
        { replacements: [user.id] }
      );
      totalVisits = parseInt(visitCountRes[0]?.count || 0, 10);

      const [pondCountRes] = await sequelize.query(
        `SELECT COUNT(DISTINCT p.id) as count FROM ponds p
         JOIN clients c ON p.client_id = c.id
         WHERE (c.assigned_salesperson_id = ? OR (c.assigned_salesperson_id IS NULL AND c.created_by = ?))
           AND p.deleted_at IS NULL AND c.deleted_at IS NULL`,
        { replacements: [user.id, user.id] }
      );
      totalPonds = parseInt(pondCountRes[0]?.count || 0, 10);

      // Recent visits logged by this executive
      const [recentVisits] = await sequelize.query(
        `SELECT v.id, v.visit_date, v.meeting_type as visit_type, v.remarks, v.created_at,
                c.id as client_id, c.company_name as farmer_name, c.village, c.district
         FROM visits v
         JOIN clients c ON v.client_id = c.id
         WHERE v.salesperson_id = ? AND v.deleted_at IS NULL
         ORDER BY v.visit_date DESC, v.id DESC LIMIT 8`,
        { replacements: [user.id] }
      );
      user.recent_visits = recentVisits;

      // Recent farmers assigned to this executive
      const [recentFarmers] = await sequelize.query(
        `SELECT c.id, c.company_name, c.contact_person, c.mobile, c.village, c.district, c.area, c.status, c.created_at
         FROM clients c
         WHERE (c.assigned_salesperson_id = ? OR (c.assigned_salesperson_id IS NULL AND c.created_by = ?))
           AND c.deleted_at IS NULL
         ORDER BY c.created_at DESC LIMIT 8`,
        { replacements: [user.id, user.id] }
      );
      user.recent_farmers = recentFarmers;
    }

    user.stats = {
      total_farmers: totalFarmers,
      total_visits: totalVisits,
      total_ponds: totalPonds,
      total_team_members: assignedExecutives.length,
    };

    return sendSuccess(res, 'User fetched', user);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const updateUser = async (req, res) => {
  const { full_name, mobile, role_id, manager_id, department, region, area, status, joining_date, executive_ids } = req.body;
  try {
    const [users] = await sequelize.query(
      'SELECT id, role_id, status FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      { replacements: [req.params.id] }
    );
    if (!users[0]) return sendError(res, 'User not found', 404);

    const finalStatus = status || users[0].status || 'active';
    const finalRoleId = role_id || users[0].role_id;

    await sequelize.query(
      `UPDATE users SET full_name = ?, mobile = ?, role_id = ?, manager_id = ?,
       department = ?, region = ?, area = ?, status = ?, joining_date = ?, updated_at = NOW() WHERE id = ?`,
      { replacements: [full_name, mobile, finalRoleId, manager_id || null, department || null, region || null, area || null, finalStatus, joining_date || null, req.params.id] }
    );

    // If executive_ids was provided in the update (e.g. managing executives for an ASM)
    if (Array.isArray(executive_ids)) {
      if (executive_ids.length > 0) {
        // Assign selected executives to this user
        await sequelize.query(
          `UPDATE users SET manager_id = ? WHERE id IN (?) AND deleted_at IS NULL`,
          { replacements: [req.params.id, executive_ids] }
        );
        // Unassign executives who were previously assigned to this user but no longer selected
        await sequelize.query(
          `UPDATE users SET manager_id = NULL WHERE manager_id = ? AND id NOT IN (?) AND deleted_at IS NULL`,
          { replacements: [req.params.id, executive_ids] }
        );
      } else {
        // Clear all executives currently assigned to this user
        await sequelize.query(
          `UPDATE users SET manager_id = NULL WHERE manager_id = ? AND deleted_at IS NULL`,
          { replacements: [req.params.id] }
        );
      }
    }

    await log({ action: 'USER_UPDATED', module: 'users', recordId: req.params.id, performedBy: req.user.id, req });
    return sendSuccess(res, 'User updated successfully');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const deleteUser = async (req, res) => {
  try {
    await sequelize.query(
      'UPDATE users SET deleted_at = NOW(), status = ? WHERE id = ?',
      { replacements: ['inactive', req.params.id] }
    );
    await log({ action: 'USER_DEACTIVATED', module: 'users', recordId: req.params.id, performedBy: req.user.id, req });
    return sendSuccess(res, 'User deactivated successfully');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const resetUserPassword = async (req, res) => {
  const { password } = req.body;
  if (!password) return sendError(res, 'New password required');

  try {
    const hash = await bcrypt.hash(password, 12);
    await sequelize.query('UPDATE users SET password_hash = ? WHERE id = ?', {
      replacements: [hash, req.params.id],
    });
    await log({ action: 'PASSWORD_RESET', module: 'users', recordId: req.params.id, performedBy: req.user.id, req });
    return sendSuccess(res, 'Password reset successfully');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const getRoles = async (req, res) => {
  try {
    const [roles] = await sequelize.query('SELECT * FROM roles ORDER BY id');
    return sendSuccess(res, 'Roles fetched', roles);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

module.exports = { listUsers, createUser, getUser, updateUser, deleteUser, resetUserPassword, getRoles };
