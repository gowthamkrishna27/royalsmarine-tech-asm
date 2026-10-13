const cron = require('node-cron');
const sequelize = require('../config/database');
const logger = require('../utils/logger');

// Run at midnight daily - mark overdue, escalate
cron.schedule('0 0 * * *', async () => {
  logger.info('Running daily followup job...');
  try {
    // Mark pending past-due followups as overdue
    const [updated] = await sequelize.query(
      "UPDATE followups SET status='overdue', updated_at=NOW() WHERE status='pending' AND followup_date < CURDATE() AND deleted_at IS NULL"
    );
    logger.info(`Marked ${updated.affectedRows} followups as overdue`);

    // Escalate followups overdue by configurable days
    const [[setting]] = await sequelize.query(
      "SELECT value FROM settings WHERE key_name='followup_overdue_escalation_days' LIMIT 1"
    );
    const days = parseInt(setting?.value) || 2;

    const [toEscalate] = await sequelize.query(
      `SELECT f.id, f.assigned_salesperson_id, u.manager_id
       FROM followups f JOIN users u ON f.assigned_salesperson_id=u.id
       WHERE f.status='overdue' AND f.escalated_at IS NULL
       AND DATEDIFF(CURDATE(), f.followup_date) >= ? AND f.deleted_at IS NULL`,
      { replacements: [days] }
    );

    for (const f of toEscalate) {
      if (f.manager_id) {
        await sequelize.query(
          'UPDATE followups SET escalated_to=?, escalated_at=NOW() WHERE id=?',
          { replacements: [f.manager_id, f.id] }
        );
        await sequelize.query(
          `INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id)
           VALUES (?, ?, ?, 'escalation', 'followup', ?)`,
          { replacements: [f.manager_id, 'Overdue Follow-up Escalated', `A follow-up is overdue by ${days}+ days`, f.id] }
        );
      }
    }

    logger.info(`Escalated ${toEscalate.length} followups`);
  } catch (err) {
    logger.error('Followup job failed:', err.message);
  }
});

// Morning reminder at 8 AM
cron.schedule('0 8 * * *', async () => {
  try {
    const [todayFollowups] = await sequelize.query(
      `SELECT f.id, f.title, f.assigned_salesperson_id FROM followups f
       WHERE f.followup_date = CURDATE() AND f.status='pending' AND f.deleted_at IS NULL`
    );

    for (const f of todayFollowups) {
      await sequelize.query(
        `INSERT IGNORE INTO notifications (user_id, title, message, type, reference_type, reference_id)
         VALUES (?, ?, ?, 'followup', 'followup', ?)`,
        { replacements: [f.assigned_salesperson_id, "Today's Follow-up", `You have a follow-up scheduled: ${f.title}`, f.id] }
      );
    }
  } catch (err) {
    logger.error('Morning reminder job failed:', err.message);
  }
});

logger.info('Cron jobs scheduled');
