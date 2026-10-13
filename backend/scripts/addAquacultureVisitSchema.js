require('dotenv').config();
const sequelize = require('../src/config/database');

async function migrate() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Database connected!');

    const [cols] = await sequelize.query('DESCRIBE visits');
    const existingCols = new Set(cols.map(c => c.Field.toLowerCase()));

    const visitAdditions = [
      { name: 'tank_id', def: 'INT NULL' },
      { name: 'tank_number', def: 'VARCHAR(100) NULL' },
      { name: 'water_quality', def: 'JSON NULL' },
      { name: 'feeding_details', def: 'JSON NULL' },
      { name: 'medication_details', def: 'JSON NULL' },
      { name: 'harvest_details', def: 'JSON NULL' },
    ];

    for (const col of visitAdditions) {
      if (!existingCols.has(col.name.toLowerCase())) {
        console.log(`Adding ${col.name} to visits table...`);
        await sequelize.query(`ALTER TABLE visits ADD COLUMN ${col.name} ${col.def}`);
      } else {
        console.log(`Column ${col.name} already exists in visits`);
      }
    }

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
