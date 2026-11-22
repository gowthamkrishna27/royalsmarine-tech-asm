const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const ExcelJS = require('exceljs');
const { Readable } = require('stream');
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

const downloadUserTemplate = async (req, res) => {
  try {
    const format = (req.query.format || 'xlsx').toLowerCase().trim();
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Royals Marine Food CRM';
    wb.created = new Date();

    const ws = wb.addWorksheet('Users Template');

    const headers = [
      { text: 'Full Name', mandatory: true, width: 22 },
      { text: 'Email', mandatory: true, width: 28 },
      { text: 'Mobile', mandatory: true, width: 16 },
      { text: 'Role', mandatory: true, width: 20 },
      { text: 'Region', mandatory: false, width: 20 },
      { text: 'Area', mandatory: false, width: 18 },
      { text: 'Department', mandatory: false, width: 18 },
      { text: 'Reporting Manager Email', mandatory: false, width: 28 },
      { text: 'Joining Date', mandatory: false, width: 16 },
    ];

    headers.forEach((col, idx) => {
      const cell = ws.getCell(1, idx + 1);
      if (col.mandatory) {
        cell.value = {
          richText: [
            { text: col.text + ' ', font: { bold: true, color: { argb: 'FF1F2937' }, size: 11 } },
            { text: '*', font: { bold: true, color: { argb: 'FFDC2626' }, size: 11 } },
          ],
        };
      } else {
        cell.value = col.text;
        cell.font = { bold: true, color: { argb: 'FF1F2937' }, size: 11 };
      }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' },
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'medium', color: { argb: 'FF9CA3AF' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      ws.getColumn(idx + 1).width = col.width;
    });

    ws.getRow(1).height = 28;

    // Role dropdown list stored in hidden sheet for 100% reliable Excel data validation
    const lookupWs = wb.addWorksheet('_Roles');
    lookupWs.state = 'veryHidden';
    const roleOptions = ['ASM', 'Technical Executive', 'Admin'];
    roleOptions.forEach((role, idx) => {
      lookupWs.getCell(idx + 1, 1).value = role;
    });

    // In-cell Role Dropdown Validation for Column D (Rows 2 to 1000)
    ws.dataValidations.add('D2:D1000', {
      type: 'list',
      allowBlank: true,
      formulae: ['_Roles!$A$1:$A$3'],
      showErrorMessage: true,
      errorTitle: 'Invalid Role',
      error: 'Please choose a valid role from the dropdown list.',
    });

    // Clean template with headers only, no raw data rows!

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="users_template.csv"');
      await wb.csv.write(res);
      res.end();
    } else {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="users_template.xlsx"');
      await wb.xlsx.write(res);
      res.end();
    }
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const importUsers = async (req, res) => {
  if (!req.file) return sendError(res, 'No file uploaded', 400);

  const summary = { total: 0, imported: 0, skipped: 0, errors: [] };

  try {
    const wb = new ExcelJS.Workbook();
    const originalName = (req.file.originalname || '').toLowerCase();
    const isCsv = originalName.endsWith('.csv') || req.file.mimetype === 'text/csv' || req.file.mimetype === 'text/plain';

    if (isCsv) {
      await wb.csv.read(Readable.from([req.file.buffer]));
    } else {
      try {
        await wb.xlsx.load(req.file.buffer);
      } catch (xlsxErr) {
        // Fallback to CSV if xlsx load fails
        await wb.csv.read(Readable.from([req.file.buffer]));
      }
    }

    const ws = wb.worksheets[0];
    if (!ws || ws.rowCount < 2) {
      return sendError(res, 'The uploaded file is empty or contains no user records', 400);
    }

    // Map column headers dynamically (case-insensitive & whitespace tolerant)
    const headerRow = ws.getRow(1);
    const colMap = {};
    headerRow.eachCell((cell, colNumber) => {
      let rawText = '';
      if (cell.value) {
        if (typeof cell.value === 'object') {
          if (Array.isArray(cell.value.richText)) {
            rawText = cell.value.richText.map(t => t.text).join('');
          } else if (cell.value.text) {
            rawText = cell.value.text;
          } else {
            rawText = String(cell.value);
          }
        } else {
          rawText = String(cell.value);
        }
      }
      const clean = rawText.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (clean.includes('fullname') || clean === 'name') colMap.full_name = colNumber;
      else if (clean.includes('email') && !clean.includes('manager')) colMap.email = colNumber;
      else if (clean.includes('mobile') || clean.includes('phone') || clean.includes('contact')) colMap.mobile = colNumber;
      else if (clean.includes('role')) colMap.role = colNumber;
      else if (clean.includes('region')) colMap.region = colNumber;
      else if (clean.includes('area')) colMap.area = colNumber;
      else if (clean.includes('department') || clean.includes('dept')) colMap.department = colNumber;
      else if (clean.includes('manager') || clean.includes('reporting')) colMap.manager_email = colNumber;
      else if (clean.includes('date') || clean.includes('joining')) colMap.joining_date = colNumber;
      else if (clean.includes('pass')) colMap.password = colNumber;
    });

    const colFullName = colMap.full_name || 1;
    const colEmail = colMap.email || 2;
    const colMobile = colMap.mobile || 3;
    const colRole = colMap.role || 4;
    const colRegion = colMap.region || 5;
    const colArea = colMap.area || 6;
    const colDept = colMap.department || 7;
    const colManager = colMap.manager_email || 8;
    const colJoining = colMap.joining_date || 9;
    const colPassword = colMap.password || 10;

    const extractVal = (rowValues, colIndex) => {
      if (!colIndex || !rowValues || rowValues[colIndex] === undefined || rowValues[colIndex] === null) return '';
      const val = rowValues[colIndex];
      if (typeof val === 'object') {
        if (val instanceof Date) return val.toISOString().split('T')[0];
        if (Array.isArray(val.richText)) return val.richText.map(t => t.text).join('').trim();
        if (val.text !== undefined) return String(val.text).trim();
        if (val.result !== undefined) return String(val.result).trim();
      }
      return String(val).trim();
    };

    // Load available roles from database
    const [rolesList] = await sequelize.query('SELECT id, name, display_name FROM roles');
    const roleMap = new Map();
    rolesList.forEach(r => {
      roleMap.set(r.name.toLowerCase().trim(), r.id);
      roleMap.set(r.display_name.toLowerCase().trim(), r.id);
      roleMap.set(r.name.toLowerCase().replace(/[^a-z0-9]/g, ''), r.id);
      roleMap.set(r.display_name.toLowerCase().replace(/[^a-z0-9]/g, ''), r.id);
    });

    const salesManagerId = roleMap.get('sales_manager') || rolesList.find(r => r.name === 'sales_manager')?.id;
    const salesExecutiveId = roleMap.get('sales_executive') || rolesList.find(r => r.name === 'sales_executive')?.id;
    const adminId = roleMap.get('admin') || rolesList.find(r => r.name === 'admin')?.id;
    const superAdminId = roleMap.get('super_admin') || rolesList.find(r => r.name === 'super_admin')?.id;

    const resolveRoleId = (roleStr) => {
      if (!roleStr) return salesExecutiveId;
      const clean = roleStr.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (clean === 'asm' || clean === 'salesmanager' || clean === 'areamanager' || clean === 'areasalesmanager') {
        return salesManagerId;
      }
      if (clean === 'tech' || clean === 'salesexecutive' || clean === 'technicalexecutive' || clean === 'fieldexecutive' || clean === 'executive') {
        return salesExecutiveId;
      }
      if (clean === 'admin' || clean === 'administrator') {
        return adminId;
      }
      if (clean === 'superadmin' || clean === 'superadministrator') {
        return superAdminId;
      }
      return roleMap.get(clean) || roleMap.get(roleStr.toLowerCase().trim()) || null;
    };

    // Pre-cache existing users by email
    const [existingUsers] = await sequelize.query('SELECT id, email FROM users WHERE deleted_at IS NULL');
    const emailToId = new Map();
    existingUsers.forEach(u => {
      if (u.email) emailToId.set(u.email.toLowerCase().trim(), u.id);
    });

    // Default password hash cached to avoid repeated bcrypt work
    const defaultHash = await bcrypt.hash('Welcome@123', 12);

    const rows = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        rows.push({ rowNumber, values: row.values });
      }
    });

    summary.total = rows.length;

    for (const { rowNumber, values } of rows) {
      const full_name = extractVal(values, colFullName);
      const email = extractVal(values, colEmail).toLowerCase();
      const mobile = extractVal(values, colMobile);
      const roleStr = extractVal(values, colRole);
      const region = extractVal(values, colRegion) || null;
      const area = extractVal(values, colArea) || null;
      const department = extractVal(values, colDept) || null;
      const manager_email = extractVal(values, colManager).toLowerCase();
      let joining_date = extractVal(values, colJoining) || null;
      const rawPassword = extractVal(values, colPassword);

      // Skip empty trailing rows
      if (!full_name && !email && !mobile) {
        summary.total--;
        continue;
      }

      if (!full_name) {
        summary.errors.push({ row: rowNumber, error: 'Full Name is required' });
        summary.skipped++;
        continue;
      }

      if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        summary.errors.push({ row: rowNumber, error: `Invalid or missing email: "${email || ''}"` });
        summary.skipped++;
        continue;
      }

      if (!mobile) {
        summary.errors.push({ row: rowNumber, error: 'Mobile number is required' });
        summary.skipped++;
        continue;
      }

      if (emailToId.has(email)) {
        summary.errors.push({ row: rowNumber, error: `Email "${email}" is already registered` });
        summary.skipped++;
        continue;
      }

      const roleId = resolveRoleId(roleStr);
      if (!roleId) {
        summary.errors.push({ row: rowNumber, error: `Invalid role "${roleStr}". Allowed: ASM, Technical Executive, Admin, etc.` });
        summary.skipped++;
        continue;
      }

      let managerId = null;
      if (manager_email) {
        if (emailToId.has(manager_email)) {
          managerId = emailToId.get(manager_email);
        }
      }

      // Format date if provided
      if (joining_date) {
        const d = new Date(joining_date);
        if (!isNaN(d.getTime())) {
          joining_date = d.toISOString().split('T')[0];
        } else {
          joining_date = null;
        }
      }

      try {
        const passwordHash = rawPassword ? await bcrypt.hash(rawPassword, 12) : defaultHash;
        const uuid = uuidv4();

        const [insertRes] = await sequelize.query(
          `INSERT INTO users (uuid, full_name, email, mobile, password_hash, role_id, manager_id, department, region, area, joining_date, status, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
          {
            replacements: [
              uuid, full_name, email, mobile, passwordHash, roleId, managerId,
              department, region, area, joining_date, req.user.id
            ]
          }
        );

        const newId = insertRes.insertId || insertRes;
        emailToId.set(email, newId);
        summary.imported++;
      } catch (rowErr) {
        summary.errors.push({ row: rowNumber, error: rowErr.message });
        summary.skipped++;
      }
    }

    await log({
      action: 'BULK_USERS_IMPORTED',
      module: 'users',
      newValue: { imported: summary.imported, total: summary.total, skipped: summary.skipped },
      performedBy: req.user.id,
      req
    });

    return sendSuccess(res, `Bulk import finished: ${summary.imported} imported, ${summary.skipped} skipped`, summary);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

module.exports = {
  listUsers,
  createUser,
  getUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  getRoles,
  downloadUserTemplate,
  importUsers,
};
