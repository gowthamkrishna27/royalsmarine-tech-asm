const seq = require('../config/database');

async function run() {
  try {
    const [cols] = await seq.query('DESCRIBE submissions');
    const colNames = cols.map(c => c.Field);
    console.log('Existing submissions columns count:', colNames.length);

    const toAdd = [
      { name: 'due_date', def: 'DATE NULL' },
      { name: 'followup_status', def: "VARCHAR(50) DEFAULT 'due'" },
      { name: 'followed_up_by_id', def: 'INT NULL' },
      { name: 'followed_up_by_name', def: 'VARCHAR(100) NULL' },
      { name: 'followed_up_at', def: 'TIMESTAMP NULL' },
      { name: 'admin_completion_notes', def: 'TEXT NULL' }
    ];

    for (const col of toAdd) {
      if (!colNames.includes(col.name)) {
        console.log('Adding column:', col.name);
        await seq.query(`ALTER TABLE submissions ADD COLUMN ${col.name} ${col.def}`);
      } else {
        console.log('Column already exists:', col.name);
      }
    }

    // Also modify notifications reference_id to VARCHAR(50)
    try {
      await seq.query('ALTER TABLE notifications MODIFY COLUMN reference_id VARCHAR(50) NULL');
      console.log('Notifications reference_id updated to VARCHAR(50)');
    } catch(e) {
      console.log('Notifications alter:', e.message);
    }

    console.log('Migration successful!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
