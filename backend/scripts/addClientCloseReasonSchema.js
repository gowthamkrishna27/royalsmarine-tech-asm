require('dotenv').config();
const sequelize = require('../src/config/database');

async function migrate() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Database connected!');

    const [cols] = await sequelize.query('DESCRIBE clients');
    const existingCols = new Set((cols || []).map(c => c.Field.toLowerCase()));

    if (!existingCols.has('close_reason')) {
      console.log('Adding close_reason to clients table...');
      await sequelize.query('ALTER TABLE clients ADD COLUMN close_reason TEXT NULL');
    } else {
      console.log('Column close_reason already exists in clients');
    }

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
