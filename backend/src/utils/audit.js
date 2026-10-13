const sequelize = require('../config/database');

const log = async ({ action, module, recordId, oldValue, newValue, performedBy, req }) => {
  try {
    await sequelize.query(
      `INSERT INTO audit_logs (action, module, record_id, old_value, new_value, performed_by, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      {
        replacements: [
          action,
          module,
          recordId || null,
          oldValue ? JSON.stringify(oldValue) : null,
          newValue ? JSON.stringify(newValue) : null,
          performedBy || null,
          req?.ip || null,
          req?.headers?.['user-agent'] || null,
        ],
      }
    );
  } catch (err) {
    // Non-blocking - log audit failure separately
    console.error('Audit log failed:', err.message);
  }
};

module.exports = { log };
