const sequelize = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * List all test submissions with submitter, client, and pond details
 */
const listSubmissions = async (req, res) => {
  try {
    const { user_id, agent_id, role, farmer_id, status, date, limit = 100 } = req.query;

    let whereConditions = ['1=1'];
    const replacements = [];

    if (user_id) {
      whereConditions.push('s.user_id = ?');
      replacements.push(user_id);
    }
    if (agent_id) {
      whereConditions.push('s.agent_id = ?');
      replacements.push(agent_id);
    }
    if (farmer_id) {
      whereConditions.push('s.farmer_id = ?');
      replacements.push(farmer_id);
    }
    if (status) {
      whereConditions.push('UPPER(s.status) = ?');
      replacements.push(status.toUpperCase());
    }
    if (date) {
      whereConditions.push('s.date = ?');
      replacements.push(date);
    }
    if (role) {
      whereConditions.push('(s.role LIKE ? OR r.name LIKE ? OR r.display_name LIKE ?)');
      replacements.push(`%${role}%`, `%${role}%`, `%${role}%`);
    }

    const whereClause = whereConditions.join(' AND ');

    const [submissions] = await sequelize.query(`
      SELECT 
        s.id,
        'test_submission' as source,
        s.agent_id,
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
        COALESCE(s.locality, c.village, c.city, f.district, 'Local') as locality,
        s.tank_id,
        COALESCE(p.pond_name, t.name, CONCAT('Tank #', s.tank_id)) as tank_name,
        COALESCE(s.test_type, 'Water Quality Analysis') as test_type,
        s.date,
        s.submission_time,
        UPPER(COALESCE(s.status, 'PENDING_VERIFICATION')) as status,
        s.data as parameters,
        s.latitude,
        s.longitude,
        s.accuracy,
        s.review_notes as notes,
        s.created_at
      FROM submissions s
      LEFT JOIN users u ON u.id = CAST(NULLIF(s.user_id, '') AS UNSIGNED)
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN clients c ON c.id = CAST(NULLIF(s.farmer_id, '') AS UNSIGNED)
      LEFT JOIN farmers f ON f.id = CAST(NULLIF(s.farmer_id, '') AS UNSIGNED)
      LEFT JOIN ponds p ON p.id = CAST(NULLIF(s.tank_id, '') AS UNSIGNED)
      LEFT JOIN tanks t ON t.id = CAST(NULLIF(s.tank_id, '') AS UNSIGNED)
      WHERE ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT ?
    `, { replacements: [...replacements, parseInt(limit, 10)] });

    return sendSuccess(res, 'Submissions fetched successfully', submissions);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

/**
 * Create a new test submission (by Agent or ASM)
 */
const createSubmission = async (req, res) => {
  try {
    const {
      farmer_id,
      tank_id,
      test_type = 'Water Quality Analysis',
      date,
      submission_time,
      status = 'PENDING_VERIFICATION',
      data = {},
      latitude,
      longitude,
      accuracy = 5.0,
      locality,
      review_notes = '',
    } = req.body;

    if (!latitude || !longitude) {
      return sendError(res, 'Latitude and longitude coordinates are required for test submission', 400);
    }

    // Determine submitter details from auth user or body
    const userId = req.user?.id ? String(req.user.id) : (req.body.user_id ? String(req.body.user_id) : '1');
    const userName = req.user?.full_name || req.body.user_name || 'Field Executive';
    
    // Determine user role and agent_id
    let userRole = req.body.role;
    if (!userRole && req.user) {
      const userRoleLower = (req.user.role || '').toLowerCase();
      if (userRoleLower === 'sales_manager') {
        userRole = 'Area Sales Manager';
      } else if (userRoleLower === 'sales_executive') {
        userRole = 'Technical Executive';
      } else {
        userRole = req.user.role_display || req.user.role || 'Technical Executive';
      }
    }
    if (!userRole) userRole = 'Technical Executive';

    const agentId = req.body.agent_id || (userRole.toLowerCase().includes('manager') || userRole.toLowerCase().includes('asm') ? `ASM-${userId}` : `AGT-${userId.padStart(2, '0')}`);

    // Generate unique submission ID: SUB-YYYYMMDD-XXXX
    const now = new Date();
    const dateStr = date || now.toISOString().slice(0, 10);
    const dateFormatted = dateStr.replace(/-/g, '');
    const randomHex = Math.floor(100 + Math.random() * 900);
    const submissionId = `SUB-${dateFormatted}-${randomHex}`;

    // Format submission time if not provided: hh:mm AM/PM
    let timeStr = submission_time;
    if (!timeStr) {
      timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    // Stringify JSON data if needed
    const jsonData = typeof data === 'object' ? JSON.stringify(data) : data;

    await sequelize.query(`
      INSERT INTO submissions (
        id, agent_id, user_id, user_name, role, farmer_id, tank_id,
        test_type, date, submission_time, status, data, latitude, longitude,
        accuracy, locality, review_notes, submitted_ago, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, 'Just now', NOW()
      )
    `, {
      replacements: [
        submissionId,
        agentId,
        userId,
        userName,
        userRole,
        farmer_id ? String(farmer_id) : null,
        tank_id ? String(tank_id) : null,
        test_type,
        dateStr,
        timeStr,
        (status || 'PENDING_VERIFICATION').toUpperCase(),
        jsonData,
        parseFloat(latitude),
        parseFloat(longitude),
        accuracy ? parseFloat(accuracy) : 5.0,
        locality || null,
        review_notes || null,
      ]
    });

    // Fetch the newly created record with joined details
    const [createdRows] = await sequelize.query(`
      SELECT 
        s.id,
        'test_submission' as source,
        s.agent_id,
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
        COALESCE(s.locality, c.village, c.city, f.district, 'Local') as locality,
        s.tank_id,
        COALESCE(p.pond_name, t.name, CONCAT('Tank #', s.tank_id)) as tank_name,
        COALESCE(s.test_type, 'Water Quality Analysis') as test_type,
        s.date,
        s.submission_time,
        UPPER(COALESCE(s.status, 'PENDING_VERIFICATION')) as status,
        s.data as parameters,
        s.latitude,
        s.longitude,
        s.accuracy,
        s.review_notes as notes,
        s.created_at
      FROM submissions s
      LEFT JOIN users u ON u.id = CAST(NULLIF(s.user_id, '') AS UNSIGNED)
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN clients c ON c.id = CAST(NULLIF(s.farmer_id, '') AS UNSIGNED)
      LEFT JOIN farmers f ON f.id = CAST(NULLIF(s.farmer_id, '') AS UNSIGNED)
      LEFT JOIN ponds p ON p.id = CAST(NULLIF(s.tank_id, '') AS UNSIGNED)
      LEFT JOIN tanks t ON t.id = CAST(NULLIF(s.tank_id, '') AS UNSIGNED)
      WHERE s.id = ?
    `, { replacements: [submissionId] });

    return sendSuccess(res, 'Test submitted successfully', createdRows[0] || { id: submissionId }, 201);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

/**
 * Get single submission
 */
const getSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await sequelize.query(`
      SELECT 
        s.id,
        'test_submission' as source,
        s.agent_id,
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
        COALESCE(s.locality, c.village, c.city, f.district, 'Local') as locality,
        s.tank_id,
        COALESCE(p.pond_name, t.name, CONCAT('Tank #', s.tank_id)) as tank_name,
        COALESCE(s.test_type, 'Water Quality Analysis') as test_type,
        s.date,
        s.submission_time,
        UPPER(COALESCE(s.status, 'PENDING_VERIFICATION')) as status,
        s.data as parameters,
        s.latitude,
        s.longitude,
        s.accuracy,
        s.review_notes as notes,
        s.created_at
      FROM submissions s
      LEFT JOIN users u ON u.id = CAST(NULLIF(s.user_id, '') AS UNSIGNED)
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN clients c ON c.id = CAST(NULLIF(s.farmer_id, '') AS UNSIGNED)
      LEFT JOIN farmers f ON f.id = CAST(NULLIF(s.farmer_id, '') AS UNSIGNED)
      LEFT JOIN ponds p ON p.id = CAST(NULLIF(s.tank_id, '') AS UNSIGNED)
      LEFT JOIN tanks t ON t.id = CAST(NULLIF(s.tank_id, '') AS UNSIGNED)
      WHERE s.id = ?
    `, { replacements: [id] });

    if (!rows.length) {
      return sendError(res, 'Submission not found', 404);
    }

    return sendSuccess(res, 'Submission fetched', rows[0]);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

module.exports = {
  listSubmissions,
  createSubmission,
  getSubmission,
};
