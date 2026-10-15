require('dotenv').config();
const seq = require('../src/config/database');

async function test() {
  try {
    const [rows] = await seq.query(`
      SELECT 
        id, 
        pond_name, 
        status,
        seed_date, 
        doc as raw_doc, 
        created_at, 
        CASE
          WHEN LOWER(status) = 'harvested' THEN COALESCE(doc, 0)
          WHEN seed_date IS NOT NULL AND seed_date <= COALESCE(DATE(CONVERT_TZ(NOW(), '+00:00', '+05:30')), CURDATE()) THEN
            GREATEST(
              DATEDIFF(COALESCE(DATE(CONVERT_TZ(NOW(), '+00:00', '+05:30')), CURDATE()), seed_date),
              COALESCE(doc, 0) + GREATEST(0, DATEDIFF(COALESCE(DATE(CONVERT_TZ(NOW(), '+00:00', '+05:30')), CURDATE()), DATE(CONVERT_TZ(created_at, '+00:00', '+05:30'))))
            )
          WHEN doc IS NOT NULL AND doc > 0 THEN
            doc + GREATEST(0, DATEDIFF(COALESCE(DATE(CONVERT_TZ(NOW(), '+00:00', '+05:30')), CURDATE()), DATE(CONVERT_TZ(created_at, '+00:00', '+05:30'))))
          ELSE 0
        END as doc
      FROM ponds
      ORDER BY id ASC
    `);
    console.log('Tested query successfully on', rows.length, 'ponds:');
    console.table(rows);
    process.exit(0);
  } catch (err) {
    console.error('SQL Error:', err);
    process.exit(1);
  }
}

test();
