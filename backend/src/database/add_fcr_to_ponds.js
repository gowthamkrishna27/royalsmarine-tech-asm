const sequelize = require('../config/database');

async function migrate() {
  try {
    const [cols] = await sequelize.query("SHOW COLUMNS FROM ponds LIKE 'fcr'");
    if (cols.length === 0) {
      await sequelize.query('ALTER TABLE ponds ADD COLUMN fcr DECIMAL(4,2) DEFAULT NULL AFTER abw');
      console.log('Added fcr column to ponds table.');
    }

    await sequelize.query(`
      UPDATE ponds 
      SET fcr = CASE
        WHEN doc >= 100 THEN ROUND(1.36 + (RAND() * 0.10), 2)
        WHEN doc >= 80  THEN ROUND(1.28 + (RAND() * 0.08), 2)
        WHEN doc >= 60  THEN ROUND(1.22 + (RAND() * 0.06), 2)
        WHEN doc >= 40  THEN ROUND(1.15 + (RAND() * 0.06), 2)
        ELSE ROUND(1.10 + (RAND() * 0.05), 2)
      END
      WHERE fcr IS NULL
    `);
    console.log('Populated FCR values for ponds.');

    const [rows] = await sequelize.query('SELECT id, pond_name, doc, abw, fcr FROM ponds LIMIT 5');
    console.log('Sample updated ponds:', rows);
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    process.exit(0);
  }
}

migrate();
