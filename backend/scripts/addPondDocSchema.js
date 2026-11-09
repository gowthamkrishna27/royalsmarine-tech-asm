require('dotenv').config();
const sequelize = require('../src/config/database');

async function migrate() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Database connected!');

    const [pondCols] = await sequelize.query('DESCRIBE ponds');
    const existing = new Set(pondCols.map(c => c.Field.toLowerCase()));

    const additions = [
      { name: 'doc', def: 'INT NULL' },
      { name: 'doc_date', def: 'DATE NULL' },
    ];

    for (const col of additions) {
      if (!existing.has(col.name.toLowerCase())) {
        console.log(`Adding ${col.name} to ponds...`);
        await sequelize.query(`ALTER TABLE ponds ADD COLUMN ${col.name} ${col.def}`);
      } else {
        console.log(`Column ${col.name} already exists in ponds`);
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
