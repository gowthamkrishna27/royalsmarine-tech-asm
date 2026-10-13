require('dotenv').config();
const sequelize = require('../src/config/database');
const { v4: uuidv4 } = require('uuid');

async function run() {
  console.log('====================================================');
  console.log('   RUNNING DATABASE TRANSACTION ROLLBACK TEST       ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  const testUuid = uuidv4();
  const testCompanyName = `Rollback Test Client - ${Date.now()}`;

  console.log('--- 1. Simulating Multi-Table Operation with Induced Failure ---');

  const t = await sequelize.transaction();
  let caughtError = false;

  try {
    // Step 1: Insert client inside transaction
    const [result] = await sequelize.query(
      `INSERT INTO clients (uuid, company_name, contact_person, mobile, email, created_by)
       VALUES (?, ?, ?, ?, ?, 1)`,
      {
        replacements: [testUuid, testCompanyName, 'Rollback Tester', '9876543210', `test-${Date.now()}@test.com`],
        transaction: t,
      }
    );

    const clientId = result.insertId;
    console.log(`Inserted parent client (ID: ${clientId}) within transaction...`);

    // Step 2: Intentionally trigger a failure (e.g. invalid query or forced throw)
    console.log('Inducing mid-transaction failure before secondary insertions commit...');
    throw new Error('SIMULATED_DATABASE_FAILURE_TRIGGERED');

    // If it didn't throw:
    await t.commit();
  } catch (err) {
    caughtError = true;
    console.log(`Caught expected failure: "${err.message}". Executing t.rollback()...`);
    await t.rollback();
  }

  assert(caughtError, 'Transaction safely intercepted failure');

  console.log('\n--- 2. Verifying Zero Orphan Records in Database ---');
  const [existing] = await sequelize.query(
    'SELECT id FROM clients WHERE uuid = ? LIMIT 1',
    { replacements: [testUuid] }
  );

  assert(existing.length === 0, 'Parent client record was completely rolled back (zero orphans)');

  const [existingByName] = await sequelize.query(
    'SELECT id FROM clients WHERE company_name = ? LIMIT 1',
    { replacements: [testCompanyName] }
  );

  assert(existingByName.length === 0, 'No partial records committed to database');

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('====================================================\n');

  await sequelize.close();

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Rollback test failed with exception:', err);
  process.exit(1);
});
