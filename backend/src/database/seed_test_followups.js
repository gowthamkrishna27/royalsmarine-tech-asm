const seq = require('../config/database');

async function seedTestFollowups() {
  try {
    // 1. Update existing submissions to set due_date = date
    await seq.query(`
      UPDATE submissions 
      SET due_date = date,
          followup_status = CASE 
            WHEN date < CURDATE() THEN 'overdue'
            ELSE 'due'
          END
      WHERE due_date IS NULL
    `);

    // 2. Add extra realistic test records for ASMs and Agents
    const extraTests = [
      {
        id: 'SUB-20261012-007',
        agent_id: 'ASM-03',
        user_id: '3',
        user_name: 'Priya Sharma',
        role: 'Area Sales Manager',
        farmer_id: '6',
        tank_id: '9',
        test_type: 'Soil & Sediments Chemistry Test',
        date: '2026-10-12',
        due_date: '2026-10-12',
        submission_time: '11:15 AM',
        status: 'PENDING_VERIFICATION',
        followup_status: 'overdue',
        data: JSON.stringify({ soil_ph: 6.9, redox_potential_mv: -150, organic_carbon_pct: 1.2, h2s_level: 'Trace' }),
        latitude: 16.5100,
        longitude: 81.5600,
        accuracy: 4.0,
        locality: 'Tanuku, West Godavari',
        review_notes: 'Soil sample analyzed. Minor anaerobic patch near feed tray 3. Recommended probiotic drenching.'
      },
      {
        id: 'SUB-20261013-008',
        agent_id: 'AGT-04',
        user_id: '4',
        user_name: 'Amit Verma',
        role: 'Technical Executive',
        farmer_id: '7',
        tank_id: '10',
        test_type: 'Dissolved Oxygen & Temperature Profiling',
        date: '2026-10-13',
        due_date: '2026-10-13',
        submission_time: '06:30 AM',
        status: 'PENDING_VERIFICATION',
        followup_status: 'overdue',
        data: JSON.stringify({ surface_do_ppm: 6.2, bottom_do_ppm: 3.1, surface_temp_c: 29.0, bottom_temp_c: 27.2 }),
        latitude: 16.5750,
        longitude: 81.5150,
        accuracy: 3.2,
        locality: 'Bhimavaram Rural, AP',
        review_notes: 'Significant DO drop at pond bottom. Aerators must run from 11 PM to 6 AM.'
      },
      {
        id: 'SUB-20261015-009',
        agent_id: 'ASM-07',
        user_id: '7',
        user_name: 'Gowtham krishna',
        role: 'Area Sales Manager',
        farmer_id: '8',
        tank_id: '11',
        test_type: 'Comprehensive Water Quality & Mineral Balance',
        date: '2026-10-15',
        due_date: '2026-10-15',
        submission_time: '09:40 AM',
        status: 'PENDING_VERIFICATION',
        followup_status: 'due',
        data: JSON.stringify({ ph: 7.9, calcium_ppm: 380, magnesium_ppm: 1150, ratio_ca_mg: '1:3.02', salinity_ppt: 14 }),
        latitude: 16.5320,
        longitude: 81.5410,
        accuracy: 3.8,
        locality: 'Undi Mandal, AP',
        review_notes: 'Mineral balance is slightly off for DOC 55. Need magnesium chloride supplement.'
      },
      {
        id: 'SUB-20261015-010',
        agent_id: 'AGT-06',
        user_id: '6',
        user_name: 'Deepak Singh',
        role: 'Technical Executive',
        farmer_id: '9',
        tank_id: '12',
        test_type: 'Hepatopancreas Health & Gut Microscopic Exam',
        date: '2026-10-15',
        due_date: '2026-10-15',
        submission_time: '11:20 AM',
        status: 'PENDING_VERIFICATION',
        followup_status: 'due',
        data: JSON.stringify({ lipid_vacuoles: 'Dense / 4+', gut_fullness_pct: 95, eHP_spores: 'Negative', deformity_rate: '0%' }),
        latitude: 16.4950,
        longitude: 81.6050,
        accuracy: 4.1,
        locality: 'Mogalthur, AP',
        review_notes: 'Excellent hepatopancreas condition. Good lipid reserve.'
      }
    ];

    for (const t of extraTests) {
      const [existing] = await seq.query('SELECT id FROM submissions WHERE id = ?', { replacements: [t.id] });
      if (!existing.length) {
        await seq.query(`
          INSERT INTO submissions (
            id, agent_id, user_id, user_name, role, farmer_id, tank_id,
            test_type, date, due_date, submission_time, status, followup_status,
            data, latitude, longitude, accuracy, locality, review_notes,
            submitted_ago, created_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            'Today', NOW()
          )
        `, {
          replacements: [
            t.id, t.agent_id, t.user_id, t.user_name, t.role, t.farmer_id, t.tank_id,
            t.test_type, t.date, t.due_date, t.submission_time, t.status, t.followup_status,
            t.data, t.latitude, t.longitude, t.accuracy, t.locality, t.review_notes
          ]
        });
        console.log('Inserted test:', t.id, t.role, t.user_name, t.followup_status);
      }
    }

    console.log('Seed test followups finished successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding test followups:', err);
    process.exit(1);
  }
}

seedTestFollowups();
