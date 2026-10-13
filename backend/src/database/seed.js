require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const mysql = require('mysql2/promise');

async function seed() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    const hash = await bcrypt.hash('Admin@123', 12);

    await connection.query(`
      INSERT IGNORE INTO users (uuid, full_name, email, mobile, password_hash, role_id, status)
      VALUES (?, 'Super Administrator', 'admin@rupaenterprises.com', '9999999999', ?, 1, 'active')
    `, [uuidv4(), hash]);

    console.log('Seed complete.');
    console.log('Default admin: admin@rupaenterprises.com / Admin@123');
  } catch (err) {
    console.error('Seed failed:', err.message);
  } finally {
    await connection.end();
  }
}

seed();
