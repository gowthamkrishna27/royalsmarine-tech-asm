const sequelize = require('../src/config/database');

async function dropTables() {
  try {
    console.log('Dropping brands, categories, and related tables from database...');
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
    await sequelize.query('DROP TABLE IF EXISTS visit_brands;');
    await sequelize.query('DROP TABLE IF EXISTS visit_categories;');
    await sequelize.query('DROP TABLE IF EXISTS client_brands;');
    await sequelize.query('DROP TABLE IF EXISTS client_categories;');
    await sequelize.query('DROP TABLE IF EXISTS products;');
    await sequelize.query('DROP TABLE IF EXISTS brands;');
    await sequelize.query('DROP TABLE IF EXISTS categories;');
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('✅ Successfully dropped all brands and categories tables.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error dropping tables:', err);
    process.exit(1);
  }
}

dropTables();
