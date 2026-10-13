require('dotenv').config();
const sequelize = require('../src/config/database');

async function migrate() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Database connected!');

    // Check & Add columns to `clients` table
    const [clientCols] = await sequelize.query('DESCRIBE clients');
    const existingClientCols = new Set(clientCols.map(c => c.Field.toLowerCase()));

    const clientAdditions = [
      { name: 'area', def: 'VARCHAR(255) NULL' },
      { name: 'village', def: 'VARCHAR(255) NULL' },
      { name: 'farm_extent_acres', def: 'DECIMAL(10,2) NULL' },
      { name: 'number_of_tanks', def: 'INT NULL DEFAULT 0' },
      { name: 'water_source', def: "VARCHAR(50) NULL DEFAULT 'bore'" },
    ];

    for (const col of clientAdditions) {
      if (!existingClientCols.has(col.name.toLowerCase())) {
        console.log(`Adding ${col.name} to clients...`);
        await sequelize.query(`ALTER TABLE clients ADD COLUMN ${col.name} ${col.def}`);
      } else {
        console.log(`Column ${col.name} already exists in clients`);
      }
    }

    // Check & Add columns to `ponds` table
    const [pondCols] = await sequelize.query('DESCRIBE ponds');
    const existingPondCols = new Set(pondCols.map(c => c.Field.toLowerCase()));

    const pondAdditions = [
      { name: 'tank_number', def: 'VARCHAR(100) NULL' },
      { name: 'tank_size', def: 'DECIMAL(10,2) NULL' },
      { name: 'salinity', def: 'DECIMAL(10,2) NULL' },
      { name: 'soil_type', def: "VARCHAR(50) NULL" },
      { name: 'hatchery_name', def: 'VARCHAR(255) NULL' },
      { name: 'brooder', def: 'VARCHAR(255) NULL' },
      { name: 'seed_date', def: 'DATE NULL' },
      { name: 'stocking_quantity_lakhs', def: 'DECIMAL(10,2) NULL' },
      { name: 'feed_type', def: 'VARCHAR(255) NULL' },
    ];

    for (const col of pondAdditions) {
      if (!existingPondCols.has(col.name.toLowerCase())) {
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
