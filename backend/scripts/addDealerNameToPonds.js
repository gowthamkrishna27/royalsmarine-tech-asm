const sequelize = require('../src/config/database');

async function addDealerName() {
  try {
    console.log('Checking ponds table for dealer_name column...');
    const [cols] = await sequelize.query('DESCRIBE ponds;');
    const colNames = cols.map(c => c.Field);

    if (!colNames.includes('dealer_name')) {
      await sequelize.query(`ALTER TABLE ponds ADD COLUMN dealer_name VARCHAR(200) NULL AFTER brooder;`);
      console.log('Added dealer_name column to ponds table');
    } else {
      console.log('dealer_name column already exists in ponds table');
    }

    console.log('Migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('Error adding dealer_name column:', err);
    process.exit(1);
  }
}

addDealerName();
