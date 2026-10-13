const sequelize = require('../src/config/database');

async function updateSchema() {
  try {
    console.log('Modifying ponds table...');
    // 1. Make farm_id nullable
    await sequelize.query(`ALTER TABLE ponds MODIFY farm_id INT NULL;`).catch(e => console.log('farm_id alter:', e.message));

    // 2. Add client_id if not exists
    const [cols] = await sequelize.query(`DESCRIBE ponds;`);
    const colNames = cols.map(c => c.Field);

    if (!colNames.includes('client_id')) {
      await sequelize.query(`ALTER TABLE ponds ADD COLUMN client_id INT NULL;`);
      await sequelize.query(`UPDATE ponds SET client_id = farmer_id WHERE client_id IS NULL;`);
      console.log('Added client_id column');
    }

    if (!colNames.includes('latitude')) {
      await sequelize.query(`ALTER TABLE ponds ADD COLUMN latitude DECIMAL(10,8) NULL;`);
      console.log('Added latitude column');
    }

    if (!colNames.includes('longitude')) {
      await sequelize.query(`ALTER TABLE ponds ADD COLUMN longitude DECIMAL(11,8) NULL;`);
      console.log('Added longitude column');
    }

    if (!colNames.includes('gps_address')) {
      await sequelize.query(`ALTER TABLE ponds ADD COLUMN gps_address TEXT NULL;`);
      console.log('Added gps_address column');
    }

    if (!colNames.includes('remarks')) {
      await sequelize.query(`ALTER TABLE ponds ADD COLUMN remarks TEXT NULL;`);
      console.log('Added remarks column');
    }

    if (!colNames.includes('area_acres')) {
      await sequelize.query(`ALTER TABLE ponds ADD COLUMN area_acres DECIMAL(10,2) NULL;`);
      await sequelize.query(`UPDATE ponds SET area_acres = area WHERE area_acres IS NULL;`);
      console.log('Added area_acres column');
    }

    console.log('Schema update complete!');
    process.exit(0);
  } catch (err) {
    console.error('Error updating schema:', err);
    process.exit(1);
  }
}

updateSchema();
