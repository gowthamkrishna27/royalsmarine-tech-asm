const sequelize = require('../src/config/database');

async function renameClientsToFarmers() {
  try {
    console.log('Checking database tables...');
    const [tables] = await sequelize.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = DATABASE() AND table_name IN ('clients', 'farmers')
    `);
    const tableNames = tables.map(t => Object.values(t)[0]);
    console.log('Existing tables found:', tableNames);

    const hasClients = tableNames.includes('clients');
    const hasFarmers = tableNames.includes('farmers');

    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');

    if (hasClients && !hasFarmers) {
      console.log('Renaming table `clients` to `farmers`...');
      await sequelize.query('RENAME TABLE clients TO farmers;');
      console.log('✅ Table `clients` renamed to `farmers`.');
    } else if (hasFarmers) {
      console.log('Table `farmers` already exists.');
    } else {
      console.log('Neither clients nor farmers table found.');
    }

    // Create compatibility view so any query referencing clients or farmers works seamlessly
    await sequelize.query('CREATE OR REPLACE VIEW clients AS SELECT * FROM farmers;');
    console.log('✅ Compatibility view `clients` created pointing to `farmers`.');

    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('🎉 Done.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error renaming table:', err);
    process.exit(1);
  }
}

renameClientsToFarmers();
