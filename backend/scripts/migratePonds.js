const sequelize = require('../src/config/database');

async function migratePonds() {
  try {
    console.log('Creating ponds table if not exists...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS ponds (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        client_id INT NOT NULL,
        pond_name VARCHAR(100) NOT NULL,
        area_acres DECIMAL(8,2) NULL,
        culture_type VARCHAR(100) NULL,
        water_type VARCHAR(100) NULL,
        latitude DECIMAL(10,8) NULL,
        longitude DECIMAL(11,8) NULL,
        gps_address TEXT NULL,
        status ENUM('active','fallow','nursery','harvested','inactive') DEFAULT 'active',
        remarks TEXT NULL,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_pond_client (client_id),
        INDEX idx_pond_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Ponds table created successfully.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to create ponds table:', err);
    process.exit(1);
  }
}

migratePonds();
