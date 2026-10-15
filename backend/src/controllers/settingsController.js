const sequelize = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');

const DEFAULT_SETTINGS = {
  company_name: 'Royals Marine Tech',
  company_email: 'support@royalsmarine.com',
  company_phone: '+91 98480 12345',
  head_office: 'Bhimavaram, Andhra Pradesh',
  followup_overdue_escalation_days: '2',
  gps_tracking_required: 'true',
  min_dissolved_oxygen_ppm: '4.0',
  optimal_ph_min: '7.5',
  optimal_ph_max: '8.5',
  optimal_salinity_min: '5.0',
  optimal_salinity_max: '35.0',
};

const getSettings = async (req, res) => {
  try {
    const [rows] = await sequelize.query('SELECT key_name, value FROM settings');
    const settingsMap = { ...DEFAULT_SETTINGS };

    for (const r of rows) {
      if (r.key_name) {
        settingsMap[r.key_name] = r.value;
      }
    }

    return sendSuccess(res, 'Settings fetched successfully', settingsMap);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const updateSettings = async (req, res) => {
  try {
    const updates = req.body;
    const userId = req.user?.id || null;

    if (!updates || typeof updates !== 'object') {
      return sendError(res, 'Invalid settings payload', 400);
    }

    for (const [key, val] of Object.entries(updates)) {
      const stringVal = val !== null && val !== undefined ? String(val) : '';
      await sequelize.query(`
        INSERT INTO settings (key_name, value, updated_by, updated_at)
        VALUES (?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE value = VALUES(value), updated_by = VALUES(updated_by), updated_at = NOW()
      `, {
        replacements: [key, stringVal, userId]
      });
    }

    const [rows] = await sequelize.query('SELECT key_name, value FROM settings');
    const settingsMap = { ...DEFAULT_SETTINGS };
    for (const r of rows) {
      if (r.key_name) {
        settingsMap[r.key_name] = r.value;
      }
    }

    return sendSuccess(res, 'Settings updated successfully', settingsMap);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

module.exports = { getSettings, updateSettings };
