const ExcelJS = require('exceljs');
const sequelize = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');

const salespersonVisitReport = async (req, res) => {
  const { from_date, to_date, salesperson_id, region, asm_id, technician_id, farmer_id } = req.query;
  const targetTechId = technician_id || salesperson_id;

  let where = "v.deleted_at IS NULL AND u.status = 'active' AND u.deleted_at IS NULL";
  const replacements = [];
  if (from_date) { where += ' AND v.visit_date >= ?'; replacements.push(from_date); }
  if (to_date) { where += ' AND v.visit_date <= ?'; replacements.push(to_date); }
  if (farmer_id) { where += ' AND v.client_id = ?'; replacements.push(farmer_id); }
  if (region && String(region).trim()) {
    const reg = String(region).trim();
    where += ` AND (
      LOWER(TRIM(COALESCE(u.region, ''))) = LOWER(TRIM(?))
      OR LOWER(TRIM(COALESCE(m.region, ''))) = LOWER(TRIM(?))
      OR LOWER(TRIM(COALESCE(c.district, ''))) = LOWER(TRIM(?))
      OR LOWER(TRIM(COALESCE(c.city, ''))) = LOWER(TRIM(?))
      OR LOWER(TRIM(COALESCE(c.area, ''))) = LOWER(TRIM(?))
    )`;
    replacements.push(reg, reg, reg, reg, reg);
  }
  if (asm_id) {
    where += ` AND (
      u.manager_id = ?
      OR v.salesperson_id = ?
      OR c.assigned_manager_id = ?
      OR u.id IN (SELECT id FROM users WHERE manager_id = ? AND deleted_at IS NULL)
    )`;
    replacements.push(asm_id, asm_id, asm_id, asm_id);
  }
  if (targetTechId) {
    where += ' AND v.salesperson_id = ?';
    replacements.push(targetTechId);
  }

  // Data isolation: Sales executive can only see their own visits
  if (req.user.role === 'sales_executive') {
    where += ' AND v.salesperson_id = ?';
    replacements.push(req.user.id);
  } else if (req.user.role === 'sales_manager') {
    if (targetTechId) {
      where += ' AND (v.salesperson_id = ? OR u.manager_id = ? OR c.assigned_manager_id = ? OR v.salesperson_id IN (SELECT id FROM users WHERE manager_id = ?))';
      replacements.push(req.user.id, req.user.id, req.user.id, req.user.id);
    } else {
      where += ' AND (v.salesperson_id = ? OR u.manager_id = ? OR c.assigned_manager_id = ? OR v.salesperson_id IN (SELECT id FROM users WHERE manager_id = ?))';
      replacements.push(req.user.id, req.user.id, req.user.id, req.user.id);
    }
  }

  try {
    const [data] = await sequelize.query(
      `SELECT u.full_name as salesperson, COUNT(v.id) as total_visits
       FROM visits v
       JOIN users u ON v.salesperson_id = u.id
       LEFT JOIN users m ON u.manager_id = m.id
       LEFT JOIN clients c ON v.client_id = c.id
       WHERE ${where} GROUP BY u.id, u.full_name ORDER BY total_visits DESC`,
      { replacements }
    );
    return sendSuccess(res, 'Salesperson visit report', data);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};


const followupReport = async (req, res) => {
  const { from_date, to_date, salesperson_id, status, region, asm_id, technician_id, farmer_id } = req.query;
  const targetTechId = technician_id || salesperson_id;

  let where = 'f.deleted_at IS NULL AND u.status = \'active\' AND u.deleted_at IS NULL';
  const replacements = [];
  if (from_date) { where += ' AND f.followup_date >= ?'; replacements.push(from_date); }
  if (to_date) { where += ' AND f.followup_date <= ?'; replacements.push(to_date); }
  if (status) { where += ' AND f.status = ?'; replacements.push(status); }
  if (farmer_id) { where += ' AND f.client_id = ?'; replacements.push(farmer_id); }
  if (region && String(region).trim()) {
    const reg = String(region).trim();
    where += ` AND (
      LOWER(TRIM(COALESCE(u.region, ''))) = LOWER(TRIM(?))
      OR LOWER(TRIM(COALESCE(m.region, ''))) = LOWER(TRIM(?))
      OR LOWER(TRIM(COALESCE(c.district, ''))) = LOWER(TRIM(?))
      OR LOWER(TRIM(COALESCE(c.city, ''))) = LOWER(TRIM(?))
      OR LOWER(TRIM(COALESCE(c.area, ''))) = LOWER(TRIM(?))
    )`;
    replacements.push(reg, reg, reg, reg, reg);
  }
  if (asm_id) {
    where += ` AND (
      u.manager_id = ?
      OR f.assigned_salesperson_id = ?
      OR c.assigned_manager_id = ?
      OR u.id IN (SELECT id FROM users WHERE manager_id = ? AND deleted_at IS NULL)
    )`;
    replacements.push(asm_id, asm_id, asm_id, asm_id);
  }
  if (targetTechId) {
    where += ' AND f.assigned_salesperson_id = ?';
    replacements.push(targetTechId);
  }

  // Data isolation: Sales executive can only see their assigned followups
  if (req.user.role === 'sales_executive') {
    where += ' AND (f.assigned_salesperson_id = ? OR (f.assigned_salesperson_id IS NULL AND f.created_by = ?))';
    replacements.push(req.user.id, req.user.id);
  } else if (req.user.role === 'sales_manager') {
    if (targetTechId) {
      where += ' AND (f.assigned_salesperson_id = ? OR u.manager_id = ? OR c.assigned_manager_id = ? OR f.assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id = ?))';
      replacements.push(req.user.id, req.user.id, req.user.id, req.user.id);
    } else {
      where += ' AND (f.assigned_salesperson_id = ? OR u.manager_id = ? OR c.assigned_manager_id = ? OR f.assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id = ?))';
      replacements.push(req.user.id, req.user.id, req.user.id, req.user.id);
    }
  }

  try {
    const [data] = await sequelize.query(
      `SELECT u.full_name as salesperson,
              SUM(CASE WHEN f.status='completed' THEN 1 ELSE 0 END) as completed,
              SUM(CASE WHEN f.status='overdue' THEN 1 ELSE 0 END) as overdue,
              SUM(CASE WHEN f.status='pending' THEN 1 ELSE 0 END) as pending,
              COUNT(*) as total
       FROM followups f
       JOIN users u ON f.assigned_salesperson_id = u.id
       LEFT JOIN users m ON u.manager_id = m.id
       LEFT JOIN clients c ON f.client_id = c.id
       WHERE ${where} GROUP BY u.id, u.full_name`,
      { replacements }
    );
    return sendSuccess(res, 'Follow-up report', data);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const billingReport = async (req, res) => {
  return sendSuccess(res, 'Billing report', { clientBilling: [], overduePayments: [] });
};

const exportReport = async (req, res) => {
  const { type, from_date, to_date, region, asm_id, technician_id, farmer_id, client_id, meeting_type, district } = req.query;
  const targetFarmerId = farmer_id || client_id;

  try {
    let data = [], headers = [], filename = 'report.xlsx';

    let baseWhere = "v.deleted_at IS NULL AND sp.status = 'active' AND sp.deleted_at IS NULL";
    const replacements = [];
    if (from_date) { baseWhere += ' AND v.visit_date >= ?'; replacements.push(from_date); }
    if (to_date) { baseWhere += ' AND v.visit_date <= ?'; replacements.push(to_date); }
    if (targetFarmerId) { baseWhere += ' AND v.client_id = ?'; replacements.push(targetFarmerId); }
    if (meeting_type) { baseWhere += ' AND v.meeting_type = ?'; replacements.push(meeting_type); }

    const targetTechId = technician_id || req.query.salesperson_id;
    const targetDistrict = district || req.query.district;
    if (targetDistrict && String(targetDistrict).trim()) {
      baseWhere += ' AND LOWER(TRIM(COALESCE(c.district, \'\'))) = LOWER(TRIM(?))';
      replacements.push(String(targetDistrict).trim());
    }

    if (region && String(region).trim()) {
      const reg = String(region).trim();
      baseWhere += ` AND (
        LOWER(TRIM(COALESCE(sp.region, ''))) = LOWER(TRIM(?))
        OR sp.manager_id IN (SELECT id FROM users WHERE LOWER(TRIM(region)) = LOWER(TRIM(?)) AND deleted_at IS NULL)
        OR LOWER(TRIM(COALESCE(c.district, ''))) = LOWER(TRIM(?))
        OR LOWER(TRIM(COALESCE(c.city, ''))) = LOWER(TRIM(?))
        OR LOWER(TRIM(COALESCE(c.area, ''))) = LOWER(TRIM(?))
      )`;
      replacements.push(reg, reg, reg, reg, reg);
    }
    if (asm_id) {
      baseWhere += ` AND (
        sp.manager_id = ?
        OR v.salesperson_id = ?
        OR c.assigned_manager_id = ?
        OR sp.id IN (SELECT id FROM users WHERE manager_id = ? AND deleted_at IS NULL)
      )`;
      replacements.push(asm_id, asm_id, asm_id, asm_id);
    }
    if (targetTechId) {
      baseWhere += ' AND v.salesperson_id = ?';
      replacements.push(targetTechId);
    }

    if (req.user.role === 'sales_executive') {
      baseWhere += ' AND v.salesperson_id = ?';
      replacements.push(req.user.id);
    } else if (req.user.role === 'sales_manager') {
      baseWhere += ' AND (v.salesperson_id = ? OR sp.manager_id = ? OR c.assigned_manager_id = ? OR v.salesperson_id IN (SELECT id FROM users WHERE manager_id = ?))';
      replacements.push(req.user.id, req.user.id, req.user.id, req.user.id);
    }

    if (type === 'farmer_report') {
      const wb = new ExcelJS.Workbook();
      let farmerName = 'Farmer';
      if (targetFarmerId) {
        const [cRows] = await sequelize.query('SELECT company_name, city, mobile, contact_person FROM clients WHERE id = ?', { replacements: [targetFarmerId] });
        if (cRows && cRows.length > 0) {
          farmerName = cRows[0].company_name || cRows[0].contact_person || 'Farmer';
        }
      }

      // Sheet 1: Visits
      const wsVisits = wb.addWorksheet('Visits');
      const visitHeaders = ['Date', 'Farmer', 'City', 'Tank / Pond', 'Meeting Type', 'Outcome', 'Remarks', 'Status', 'Technical Executive'];
      wsVisits.addRow(visitHeaders);
      wsVisits.getRow(1).font = { bold: true };

      const [visitRows] = await sequelize.query(
        `SELECT v.visit_date, sp.full_name, c.company_name, c.city, v.tank_number, v.meeting_type, v.visit_outcome, v.remarks, v.approval_status
         FROM visits v
         JOIN clients c ON v.client_id = c.id
         JOIN users sp ON v.salesperson_id = sp.id
         WHERE ${baseWhere}
         ORDER BY v.visit_date DESC`,
        { replacements }
      );

      visitRows.forEach(r => {
        wsVisits.addRow([
          r.visit_date,
          r.company_name,
          r.city || '—',
          r.tank_number || '—',
          r.meeting_type ? r.meeting_type.replace(/_/g, ' ') : '—',
          r.visit_outcome || '—',
          r.remarks || '—',
          r.approval_status || '—',
          r.full_name
        ]);
      });

      // Sheet 2: Harvest Records (Partial & Final)
      const wsHarvest = wb.addWorksheet('Harvest Records');
      const harvestHeaders = [
        'Date',
        'Farmer',
        'City',
        'Tank / Pond',
        'Harvest Type',
        'Harvest #',
        'DOC',
        'Count',
        'ABW (g)',
        'Quantity (kg)',
        'Biomass (kg)',
        'Total Feed (kg)',
        'FCR',
        'Total Count',
        'Survival %',
        'Technical Executive'
      ];
      wsHarvest.addRow(harvestHeaders);
      wsHarvest.getRow(1).font = { bold: true };

      const [harvestRows] = await sequelize.query(
        `SELECT v.id, v.visit_date, v.tank_number, v.harvest_details,
                c.company_name, c.city,
                sp.full_name as salesperson_name
         FROM visits v
         JOIN clients c ON v.client_id = c.id
         JOIN users sp ON v.salesperson_id = sp.id
         WHERE ${baseWhere} AND v.harvest_details IS NOT NULL AND v.harvest_details != ''
         ORDER BY v.visit_date DESC, v.id DESC`,
        { replacements }
      );

      for (const r of harvestRows) {
        let hd = r.harvest_details;
        if (typeof hd === 'string') { try { hd = JSON.parse(hd); } catch (e) { } }
        if (hd && typeof hd === 'object') {
          const partials = Array.isArray(hd.partial_harvests) ? hd.partial_harvests : (hd.partial_harvest ? [hd.partial_harvest] : []);
          for (let i = 0; i < partials.length; i++) {
            const p = partials[i];
            wsHarvest.addRow([
              p.date || r.visit_date,
              r.company_name,
              r.city || '—',
              r.tank_number || '—',
              'Partial Harvest',
              p.harvest_no || (i + 1),
              p.doc || '—',
              p.count || '—',
              p.abw ? `${p.abw} g` : '—',
              p.harvested_quantity ? `${p.harvested_quantity} kg` : '—',
              p.harvested_biomass ? `${p.harvested_biomass} kg` : '—',
              '—',
              '—',
              '—',
              '—',
              r.salesperson_name
            ]);
          }
          if (hd.final_harvest && typeof hd.final_harvest === 'object') {
            const fh = hd.final_harvest;
            const hasData = Object.values(fh).some(val => val !== null && val !== undefined && val !== '');
            if (hasData) {
              const derived = hd.derived || {};
              wsHarvest.addRow([
                fh.date || r.visit_date,
                r.company_name,
                r.city || '—',
                r.tank_number || '—',
                'Final Harvest',
                'Final',
                fh.doc || '—',
                fh.count || '—',
                fh.abw ? `${fh.abw} g` : '—',
                fh.harvested_quantity ? `${fh.harvested_quantity} kg` : '—',
                fh.harvested_biomass ? `${fh.harvested_biomass} kg` : '—',
                derived.totalFeed || derived.total_feed || '—',
                derived.fcr || '—',
                derived.totalCount || fh.count || '—',
                derived.survival || derived.survival_percentage || '—',
                r.salesperson_name
              ]);
            }
          }
        }
      }

      [wsVisits, wsHarvest].forEach(sheet => {
        sheet.columns.forEach(column => {
          let maxLength = 0;
          column.eachCell({ includeEmpty: true }, cell => {
            const val = cell.value ? String(cell.value) : '';
            maxLength = Math.max(maxLength, val.length);
          });
          column.width = Math.max(maxLength + 3, 12);
        });
      });

      const safeName = farmerName.replace(/[^a-z0-9]/gi, '_');
      filename = `${safeName}_report.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      await wb.xlsx.write(res);
      return res.end();
    }

    if (type === 'partial_harvest') {
      headers = [
        'Harvest Date',
        'Farmer Name',
        'City',
        'Tank / Pond',
        'Harvest #',
        'DOC',
        'Count',
        'ABW (g)',
        'Quantity (kg)',
        'Biomass (kg)',
        'Remarks',
        'Technical Executive'
      ];
      filename = 'partial-harvest-report.xlsx';

      const [rows] = await sequelize.query(
        `SELECT v.id, v.visit_date, v.tank_number, v.harvest_details,
                c.company_name, c.city,
                sp.full_name as salesperson_name
         FROM visits v
         JOIN clients c ON v.client_id = c.id
         JOIN users sp ON v.salesperson_id = sp.id
         WHERE ${baseWhere} AND v.harvest_details IS NOT NULL AND v.harvest_details != ''
         ORDER BY v.visit_date DESC, v.id DESC`,
        { replacements }
      );

      for (const r of rows) {
        let hd = r.harvest_details;
        if (typeof hd === 'string') { try { hd = JSON.parse(hd); } catch (e) { } }
        if (hd && typeof hd === 'object') {
          const partials = Array.isArray(hd.partial_harvests) ? hd.partial_harvests : (hd.partial_harvest ? [hd.partial_harvest] : []);
          for (let i = 0; i < partials.length; i++) {
            const p = partials[i];
            data.push([
              p.date || r.visit_date,
              r.company_name,
              r.city || '—',
              r.tank_number || '—',
              p.harvest_no || (i + 1),
              p.doc || '—',
              p.count || '—',
              p.abw ? `${p.abw} g` : '—',
              p.harvested_quantity ? `${p.harvested_quantity} kg` : '—',
              p.harvested_biomass ? `${p.harvested_biomass} kg` : '—',
              p.remarks || '—',
              r.salesperson_name
            ]);
          }
        }
      }
    } else if (type === 'final_harvest') {
      headers = [
        'Final Harvest Date',
        'Farmer Name',
        'City',
        'Tank / Pond',
        'DOC',
        'Count',
        'ABW (g)',
        'Quantity (kg)',
        'Biomass (kg)',
        'Total Feed (kg)',
        'Total Biomass Avg (kg)',
        'FCR',
        'Total Count',
        'Survival Rate',
        'Technical Executive'
      ];
      filename = 'final-harvest-report.xlsx';

      const [rows] = await sequelize.query(
        `SELECT v.id, v.visit_date, v.tank_number, v.harvest_details,
                c.company_name, c.city,
                sp.full_name as salesperson_name
         FROM visits v
         JOIN clients c ON v.client_id = c.id
         JOIN users sp ON v.salesperson_id = sp.id
         WHERE ${baseWhere} AND v.harvest_details IS NOT NULL AND v.harvest_details != ''
         ORDER BY v.visit_date DESC, v.id DESC`,
        { replacements }
      );

      for (const r of rows) {
        let hd = r.harvest_details;
        if (typeof hd === 'string') { try { hd = JSON.parse(hd); } catch (e) { } }
        if (hd && typeof hd === 'object' && hd.final_harvest && typeof hd.final_harvest === 'object') {
          const fh = hd.final_harvest;
          const hasData = Object.values(fh).some(val => val !== null && val !== undefined && val !== '');
          if (hasData) {
            const derived = hd.derived || {};
            data.push([
              fh.date || r.visit_date,
              r.company_name,
              r.city || '—',
              r.tank_number || '—',
              fh.doc || '—',
              fh.count || '—',
              fh.abw ? `${fh.abw} g` : '—',
              fh.harvested_quantity ? `${fh.harvested_quantity} kg` : '—',
              fh.harvested_biomass ? `${fh.harvested_biomass} kg` : '—',
              derived.totalFeed || derived.total_feed || '—',
              derived.avgBiomass || derived.total_biomass || '—',
              derived.fcr || '—',
              derived.totalCount || fh.count || '—',
              derived.survival || derived.survival_percentage || '—',
              r.salesperson_name
            ]);
          }
        }
      }
    } else if (type === 'harvest_data') {
      const wb = new ExcelJS.Workbook();
      const wsHarvest = wb.addWorksheet('Harvesting Data Sheet');

      // Title Row
      const titleRow = new Array(31).fill('');
      titleRow[12] = 'Harvesting Data Sheet';
      const r1 = wsHarvest.addRow(titleRow);
      r1.font = { bold: true, size: 14 };

      // Grouping Header Row
      const groupRow = new Array(31).fill('');
      groupRow[14] = 'Partial Harvest';
      groupRow[19] = 'Final Harvest';
      groupRow[24] = 'Total Material';
      const r2 = wsHarvest.addRow(groupRow);
      r2.font = { bold: true, size: 11 };

      // Column Headers Row
      const harvestHeaders = [
        'S. No',
        'ASM/RM',
        'Farmer Name and Details',
        'Mobile No',
        'District',
        'Village',
        'Brand Name',
        'Water Source',
        'Salinity',
        'Pond No. ',
        'Pond Area (Acres)',
        'Date of Stocking ',
        'No. of Seed Stocked (Laksh)',
        'Stocking density (Pcs/sqm)',
        'Date of Partial Harvest',
        'DOC at Partial Harvest',
        'Count of Partial Harvest',
        'Quantity  of Partial Harvest (Kgs)',
        'Partial Harvestd Seed',
        'Date of Final Harvest ',
        'DOC at Final Harvest',
        'Count Final  Harvest',
        'Quantity at Final Harvest (Kgs)',
        'Final Harvestd Seed',
        'Total Quantity Harvested (Kgs)',
        'Cumulative Feed Consumption (Kgs)',
        ' FCR',
        'Total No. Harvested',
        'Survival (%)',
        'Soil Type',
        'Remarks'
      ];
      const r3 = wsHarvest.addRow(harvestHeaders);
      r3.font = { bold: true };

      // Query harvest visits matching filters
      const [rows] = await sequelize.query(
        `SELECT v.id as visit_id, v.visit_date, v.tank_number, v.tank_id, v.harvest_details,
                v.feeding_details, v.water_quality, v.remarks as visit_remarks,
                c.id as client_id, c.company_name, c.contact_person, c.mobile as farmer_mobile,
                c.district, c.village, c.area as farmer_area,
                sp.id as salesperson_id, sp.full_name as salesperson_name,
                COALESCE(cm.id, sm.id) as manager_id,
                COALESCE(cm.full_name, sm.full_name) as manager_name,
                p.id as pond_id, p.pond_name, p.area_acres, p.area as pond_area,
                p.water_source, p.water_type, p.salinity as pond_salinity, p.soil_type,
                p.seed_date, p.stocking_quantity_lakhs, p.feed_type, p.dealer_name,
                p.fcr as pond_fcr, p.remarks as pond_remarks
         FROM visits v
         JOIN clients c ON v.client_id = c.id
         JOIN users sp ON v.salesperson_id = sp.id
         LEFT JOIN users cm ON cm.id = c.assigned_manager_id AND cm.status = 'active' AND cm.deleted_at IS NULL
         LEFT JOIN users sm ON sm.id = sp.manager_id AND sm.status = 'active' AND sm.deleted_at IS NULL
         LEFT JOIN ponds p ON (v.tank_id = p.id OR (v.client_id = p.client_id AND v.tank_number = p.tank_number))
         WHERE ${baseWhere} AND v.harvest_details IS NOT NULL AND v.harvest_details != '' AND v.harvest_details != '{}' AND v.harvest_details != 'null'
         ORDER BY v.visit_date DESC, v.id DESC`,
        { replacements }
      );

      // Group visits by unique pond/tank per client so partial & final harvest sit on one row
      const pondMap = new Map();
      for (const r of rows) {
        const pondKey = `${r.client_id}_${r.pond_id || r.tank_number || r.visit_id}`;
        if (!pondMap.has(pondKey)) {
          pondMap.set(pondKey, {
            rep: r,
            visits: [],
          });
        }
        pondMap.get(pondKey).visits.push(r);
      }

      let serialNo = 1;
      for (const [, item] of pondMap.entries()) {
        const r = item.rep;
        let partialHarvest = null;
        let finalHarvest = null;

        for (const v of item.visits) {
          let hd = v.harvest_details;
          if (typeof hd === 'string') { try { hd = JSON.parse(hd); } catch (e) { } }
          if (hd && typeof hd === 'object') {
            if (!finalHarvest && hd.final_harvest && typeof hd.final_harvest === 'object') {
              const hasFinal = Object.values(hd.final_harvest).some(val => val !== null && val !== undefined && val !== '');
              if (hasFinal) {
                finalHarvest = { ...hd.final_harvest, date: hd.final_harvest.date || v.visit_date, derived: hd.derived || {} };
              }
            }
            if (!partialHarvest) {
              const partials = Array.isArray(hd.partial_harvests) ? hd.partial_harvests : (hd.partial_harvest ? [hd.partial_harvest] : []);
              if (partials.length > 0) {
                partialHarvest = { ...partials[0], date: partials[0].date || v.visit_date };
              }
            }
          }
        }

        // Calculations
        const areaAcres = parseFloat(r.area_acres || r.pond_area || 0) || 0;
        let seedStocked = 0;
        if (r.stocking_quantity_lakhs) {
          const rawQty = parseFloat(r.stocking_quantity_lakhs);
          seedStocked = rawQty < 1000 ? Math.round(rawQty * 100000) : Math.round(rawQty);
        }
        let density = '';
        if (seedStocked > 0 && areaAcres > 0) {
          density = Math.round(seedStocked / (areaAcres * 4000));
        }

        // Partial Harvest values
        const partialDate = partialHarvest?.date || '';
        const partialDoc = partialHarvest?.doc || '';
        const partialCount = parseFloat(partialHarvest?.count) || '';
        const partialQty = parseFloat(partialHarvest?.harvested_quantity || partialHarvest?.harvested_biomass || partialHarvest?.biomass || 0) || 0;
        const partialSeed = (partialQty > 0 && partialCount > 0) ? Math.round(partialQty * partialCount) : 0;

        // Final Harvest values
        const finalDate = finalHarvest?.date || '';
        const finalDoc = finalHarvest?.doc || '';
        const finalCount = parseFloat(finalHarvest?.count) || '';
        const finalQty = parseFloat(finalHarvest?.harvested_quantity || finalHarvest?.total_biomass || finalHarvest?.harvested_biomass || 0) || 0;
        const finalSeed = (finalQty > 0 && finalCount > 0) ? Math.round(finalQty * finalCount) : 0;

        // Total Material values
        const totalQty = (partialQty + finalQty) || (finalQty || partialQty || 0);
        const cumFeed = parseFloat(finalHarvest?.derived?.totalFeed || finalHarvest?.derived?.total_feed || finalHarvest?.total_feed || 0) || 0;
        let fcr = '';
        if (cumFeed > 0 && totalQty > 0) {
          fcr = cumFeed / totalQty;
        } else if (r.pond_fcr) {
          fcr = parseFloat(r.pond_fcr) || '';
        }
        const totalNoHarvested = partialSeed + finalSeed;
        let survival = '';
        if (totalNoHarvested > 0 && seedStocked > 0) {
          survival = Math.round((totalNoHarvested / seedStocked) * 100);
        } else if (finalHarvest?.derived?.survival || finalHarvest?.derived?.survival_percentage) {
          survival = parseFloat(finalHarvest.derived.survival || finalHarvest.derived.survival_percentage) || '';
        }

        const soilType = r.soil_type || 'Black';
        const remarks = finalHarvest?.remarks || partialHarvest?.remarks || r.visit_remarks || r.pond_remarks || '';

        wsHarvest.addRow([
          serialNo++,
          r.manager_name || r.salesperson_name || '',
          r.company_name || r.contact_person || '',
          r.farmer_mobile || '',
          r.district || '',
          r.village || '',
          r.feed_type || r.dealer_name || 'Premium',
          r.water_source || r.water_type || 'Creak+Canel',
          r.pond_salinity || '',
          r.tank_number || r.pond_name || '',
          areaAcres || '',
          r.seed_date ? String(r.seed_date).slice(0, 10) : '',
          seedStocked || '',
          density || '',
          partialDate,
          partialDoc,
          partialCount,
          partialQty || '',
          partialSeed,
          finalDate,
          finalDoc,
          finalCount,
          finalQty || '',
          finalSeed,
          totalQty || '',
          cumFeed || '',
          fcr !== '' ? Number(fcr) : '',
          totalNoHarvested || '',
          survival !== '' ? Number(survival) : '',
          soilType,
          remarks
        ]);
      }

      // Sheet 2: Sampling & Growth Data Sheet
      const wsSampling = wb.addWorksheet('Sampling Data');
      const samplingHeaders = [
        'Sr. No',
        'ASM/RM',
        'Farmer Name ',
        'Mobile No',
        'District',
        'Village',
        'Brand Name',
        'water Source',
        'Salinity',
        'Pond. No',
        'Pond Area (Acres)',
        'No. of Seed Stocked (Laksh)',
        'Stocking density (Pcs/sqm)',
        'Date of Stocking ',
        'Previous Sampling Date',
        'Present Sampling Date',
        'Duration between samplings (days)',
        'Previous ABW (g)',
        'Present ABW (g)',
        'Growth Increment (g)',
        'ADG for the Daily (g)',
        'Count',
        'DOC',
        'Cumulative Feed Consumption',
        'Cumulative Feed as per chart',
        'Estimated Survival %',
        'Estimated Survival Nos',
        'Estimated Biomass (Kg)',
        'Estimated FCR',
        'Remarks'
      ];
      const sRow = wsSampling.addRow(samplingHeaders);
      sRow.font = { bold: true };

      // Query visits with test details / sampling
      const [sampleVisits] = await sequelize.query(
        `SELECT v.id, v.visit_date, v.tank_number, v.water_quality, v.feeding_details, v.remarks as visit_remarks,
                c.company_name, c.mobile as farmer_mobile, c.district, c.village,
                sp.full_name as salesperson_name,
                COALESCE(cm.full_name, sm.full_name) as manager_name,
                p.pond_name, p.area_acres, p.area as pond_area, p.water_source, p.water_type,
                p.salinity as pond_salinity, p.seed_date, p.stocking_quantity_lakhs, p.feed_type, p.dealer_name,
                p.doc, p.abw, p.fcr
         FROM visits v
         JOIN clients c ON v.client_id = c.id
         JOIN users sp ON v.salesperson_id = sp.id
         LEFT JOIN users cm ON cm.id = c.assigned_manager_id AND cm.status = 'active' AND cm.deleted_at IS NULL
         LEFT JOIN users sm ON sm.id = sp.manager_id AND sm.status = 'active' AND sm.deleted_at IS NULL
         LEFT JOIN ponds p ON (v.tank_id = p.id OR (v.client_id = p.client_id AND v.tank_number = p.tank_number))
         WHERE ${baseWhere}
         ORDER BY v.visit_date DESC, v.id DESC LIMIT 200`,
        { replacements }
      );

      let sNo = 1;
      for (const sv of sampleVisits) {
        let wq = sv.water_quality;
        let fd = sv.feeding_details;
        if (typeof wq === 'string') { try { wq = JSON.parse(wq); } catch (e) { } }
        if (typeof fd === 'string') { try { fd = JSON.parse(fd); } catch (e) { } }

        const areaAcres = parseFloat(sv.area_acres || sv.pond_area || 0) || 0;
        let seedStocked = 0;
        if (sv.stocking_quantity_lakhs) {
          const rawQty = parseFloat(sv.stocking_quantity_lakhs);
          seedStocked = rawQty < 1000 ? Math.round(rawQty * 100000) : Math.round(rawQty);
        }
        let density = '';
        if (seedStocked > 0 && areaAcres > 0) {
          density = Math.round(seedStocked / (areaAcres * 4046.86));
        }

        wsSampling.addRow([
          sNo++,
          sv.manager_name || sv.salesperson_name || '',
          sv.company_name || '',
          sv.farmer_mobile || '',
          sv.district || '',
          sv.village || '',
          sv.feed_type || sv.dealer_name || 'Premium',
          sv.water_source || sv.water_type || '',
          wq?.salinity || sv.pond_salinity || '',
          sv.tank_number || sv.pond_name || '',
          areaAcres || '',
          seedStocked || '',
          density || '',
          sv.seed_date ? String(sv.seed_date).slice(0, 10) : '',
          '',
          sv.visit_date || '',
          '',
          '',
          sv.abw || '',
          '',
          '',
          '',
          sv.doc || '',
          fd?.total_feed || fd?.daily_feed || '',
          '',
          '',
          '',
          '',
          sv.fcr || '',
          sv.visit_remarks || ''
        ]);
      }

      // Auto-fit column widths on both worksheets
      [wsHarvest, wsSampling].forEach(sheet => {
        sheet.columns.forEach(column => {
          let maxLength = 0;
          column.eachCell({ includeEmpty: true }, cell => {
            const val = cell.value ? String(cell.value) : '';
            maxLength = Math.max(maxLength, val.length);
          });
          column.width = Math.max(maxLength + 2, 11);
        });
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=harvest-data-report.xlsx`);
      await wb.xlsx.write(res);
      return res.end();
    } else if (type === 'visits') {
      let empHeader = 'EMP NAME';
      let selectedAsmName = '';
      if (technician_id || req.query.salesperson_id) {
        empHeader = 'TECHNICIAN NAME';
      } else if (asm_id) {
        empHeader = 'ASM NAME';
      }

      let filename = 'visits-report.xlsx';
      if (targetFarmerId) {
        const [cNameRow] = await sequelize.query('SELECT company_name FROM clients WHERE id = ?', { replacements: [targetFarmerId] });
        if (cNameRow && cNameRow[0]?.company_name) {
          filename = `${cNameRow[0].company_name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_report.xlsx`;
        }
      } else if (technician_id || req.query.salesperson_id) {
        const [techRow] = await sequelize.query('SELECT full_name FROM users WHERE id = ?', { replacements: [technician_id || req.query.salesperson_id] });
        if (techRow && techRow[0]?.full_name) {
          filename = `${techRow[0].full_name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_technician_report.xlsx`;
        }
      } else if (asm_id) {
        const [asmRow] = await sequelize.query('SELECT full_name FROM users WHERE id = ?', { replacements: [asm_id] });
        if (asmRow && asmRow[0]?.full_name) {
          selectedAsmName = asmRow[0].full_name;
          filename = `${asmRow[0].full_name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_asm_report.xlsx`;
        }
      }

      const [rows] = await sequelize.query(
        `SELECT v.id, v.visit_date, v.tank_number, v.tank_id,
                v.feeding_details, v.water_quality, v.remarks as visit_remarks,
                v.meeting_highlights, v.visit_outcome, v.harvest_details,
                c.id as client_id, c.company_name, c.contact_person, c.mobile as farmer_mobile,
                c.village, c.district, c.area as client_area,
                sp.id as salesperson_id, sp.full_name as salesperson_name, sp.area as tech_area, sp.region as tech_region,
                COALESCE(cm.id, sm.id) as manager_id,
                COALESCE(cm.full_name, sm.full_name) as manager_name,
                COALESCE(cm.region, sm.region) as manager_region,
                p.id as pond_id, p.pond_name, p.area_acres, p.area as pond_area,
                p.water_source, p.water_type, p.salinity as pond_salinity, p.soil_type,
                p.seed_date, p.stocking_quantity_lakhs, p.doc as pond_doc, p.abw as pond_abw,
                p.fcr as pond_fcr, p.remarks as pond_remarks
         FROM visits v
         JOIN clients c ON v.client_id = c.id
         JOIN users sp ON v.salesperson_id = sp.id
         LEFT JOIN users cm ON cm.id = c.assigned_manager_id AND cm.status = 'active' AND cm.deleted_at IS NULL
         LEFT JOIN users sm ON sm.id = sp.manager_id AND sm.status = 'active' AND sm.deleted_at IS NULL
         LEFT JOIN ponds p ON (v.tank_id = p.id OR (v.client_id = p.client_id AND v.tank_number = p.tank_number))
         WHERE ${baseWhere}
         ORDER BY v.visit_date DESC, v.id DESC`,
        { replacements }
      );

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Report');

      // Row 1: empty row
      ws.addRow(new Array(21).fill(''));
      // Row 2: empty row
      ws.addRow(new Array(21).fill(''));

      // Row 3: Standard Headers
      const visitHeaders = [
        '',
        'AREA',
        'DATE',
        empHeader,
        'FAR NAME',
        'VILLAGE',
        'PHONE',
        'POND NO',
        'ACRES',
        'SEED LAKH',
        'DOC',
        'ABW GRM',
        'DAY FEED KG',
        'TCF KGS',
        'CH TR FEED GRM',
        'CH TR HRS',
        'SALINITY',
        'REMARAK',
        'OBSERVATION',
        'OBSERVATIONS',
        '              REMARK'
      ];
      const r3 = ws.addRow(visitHeaders);
      r3.font = { bold: true };

      for (const r of rows) {
        let fd = r.feeding_details;
        let wq = r.water_quality;
        let hd = r.harvest_details;
        try { if (typeof fd === 'string') fd = JSON.parse(fd); } catch (e) { }
        try { if (typeof wq === 'string') wq = JSON.parse(wq); } catch (e) { }
        try { if (typeof hd === 'string') hd = JSON.parse(hd); } catch (e) { }

        const area = (r.client_area || r.tech_area || r.tech_region || r.manager_region || r.district || '').trim();
        const date = r.visit_date ? String(r.visit_date).slice(0, 10) : '';

        let empName = r.salesperson_name || '';
        if (empHeader === 'ASM NAME') {
          empName = selectedAsmName || r.manager_name || r.salesperson_name || '';
        } else if (empHeader === 'TECHNICIAN NAME') {
          empName = r.salesperson_name || '';
        } else {
          // Default / EMP NAME: whoever performed the visit/tests
          empName = r.salesperson_name || '';
        }

        const farName = r.company_name || r.contact_person || '';
        const village = r.village || '';
        const phone = r.farmer_mobile || '';
        const pondNo = r.tank_number || r.pond_name || '';
        const acres = parseFloat(r.area_acres || r.pond_area || 0) || '';
        const seedLakh = parseFloat(r.stocking_quantity_lakhs) || '';
        const doc = r.pond_doc || hd?.doc || (hd?.final_harvest?.doc) || '';
        const abw = r.pond_abw || hd?.abw || (hd?.final_harvest?.abw) || '';
        const dayFeed = fd?.daily_feed || fd?.day_feed || fd?.feed_quantity || '';
        const tcf = fd?.total_feed || fd?.cumulative_feed || hd?.derived?.total_feed || '';
        const chTrFeed = fd?.check_tray_feed || fd?.tray_feed || fd?.check_tray || '';
        const chTrHrs = fd?.check_tray_hours || fd?.tray_hours || fd?.check_tray_time || '';
        const salinity = wq?.salinity || r.pond_salinity || '';

        const remarksText = (r.visit_remarks || hd?.remarks || (hd?.final_harvest?.remarks) || r.pond_remarks || '').trim();
        const obs1 = (r.meeting_highlights || '').trim();
        const obs2 = (r.visit_outcome || '').trim();
        const hasRemark = Boolean(remarksText || obs1 || obs2);
        const remarak = hasRemark ? 'Yes' : 'No';

        ws.addRow([
          '',
          area,
          date,
          empName,
          farName,
          village,
          phone,
          pondNo,
          acres,
          seedLakh,
          doc,
          abw,
          dayFeed,
          tcf,
          chTrFeed,
          chTrHrs,
          salinity,
          remarak,
          obs1,
          obs2,
          remarksText
        ]);
      }

      // Auto-fit column widths
      ws.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, cell => {
          const val = cell.value ? String(cell.value) : '';
          maxLength = Math.max(maxLength, val.length);
        });
        column.width = Math.max(maxLength + 2, 10);
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      await wb.xlsx.write(res);
      return res.end();
    } else {
      headers = [
        'S. No',
        'Due Date',
        'Farmer Name',
        'Phone',
        'Village',
        'District',
        'Followup Title',
        'Technical Executive',
        'Done By',
        'Priority',
        'Status',
        'Remarks / Notes'
      ];
      filename = 'followup-report.xlsx';
      if (targetFarmerId) {
        const [cNameRow] = await sequelize.query('SELECT company_name FROM clients WHERE id = ?', { replacements: [targetFarmerId] });
        if (cNameRow && cNameRow[0]?.company_name) {
          filename = `${cNameRow[0].company_name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_followup_report.xlsx`;
        }
      } else if (targetTechId) {
        const [techRow] = await sequelize.query('SELECT full_name FROM users WHERE id = ?', { replacements: [targetTechId] });
        if (techRow && techRow[0]?.full_name) {
          filename = `${techRow[0].full_name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_tech_followup_report.xlsx`;
        }
      } else if (asm_id) {
        const [asmRow] = await sequelize.query('SELECT full_name FROM users WHERE id = ?', { replacements: [asm_id] });
        if (asmRow && asmRow[0]?.full_name) {
          filename = `${asmRow[0].full_name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_asm_followup_report.xlsx`;
        }
      }

      let where = 'f.deleted_at IS NULL';
      const fuReplacements = [];
      if (from_date) { where += ' AND f.followup_date >= ?'; fuReplacements.push(from_date); }
      if (to_date) { where += ' AND f.followup_date <= ?'; fuReplacements.push(to_date); }
      if (targetFarmerId) { where += ' AND f.client_id = ?'; fuReplacements.push(targetFarmerId); }
      if (targetTechId) { where += ' AND (f.assigned_salesperson_id = ? OR (f.assigned_salesperson_id IS NULL AND f.created_by = ?))'; fuReplacements.push(targetTechId, targetTechId); }
      if (asm_id) {
        where += ` AND (
          sp.manager_id = ?
          OR f.assigned_salesperson_id = ?
          OR c.assigned_manager_id = ?
          OR f.assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id = ? AND deleted_at IS NULL)
        )`;
        fuReplacements.push(asm_id, asm_id, asm_id, asm_id);
      }
      if (region && String(region).trim()) {
        const reg = String(region).trim();
        where += ` AND (
          LOWER(TRIM(COALESCE(sp.region, ''))) = LOWER(TRIM(?))
          OR sp.manager_id IN (SELECT id FROM users WHERE LOWER(TRIM(region)) = LOWER(TRIM(?)) AND deleted_at IS NULL)
          OR LOWER(TRIM(COALESCE(c.district, ''))) = LOWER(TRIM(?))
          OR LOWER(TRIM(COALESCE(c.city, ''))) = LOWER(TRIM(?))
          OR LOWER(TRIM(COALESCE(c.area, ''))) = LOWER(TRIM(?))
        )`;
        fuReplacements.push(reg, reg, reg, reg, reg);
      }

      if (req.user.role === 'sales_executive') {
        where += ' AND (f.assigned_salesperson_id = ? OR (f.assigned_salesperson_id IS NULL AND f.created_by = ?))';
        fuReplacements.push(req.user.id, req.user.id);
      } else if (req.user.role === 'sales_manager') {
        if (targetTechId) {
          where += ' AND (f.assigned_salesperson_id = ? OR (f.assigned_salesperson_id IS NULL AND f.created_by = ?))';
          fuReplacements.push(targetTechId, targetTechId);
        } else {
          where += ' AND (f.assigned_salesperson_id = ? OR f.assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id = ?))';
          fuReplacements.push(req.user.id, req.user.id);
        }
      }

      const [rows] = await sequelize.query(
        `SELECT f.id, f.title, f.followup_date, f.priority, f.status, f.remarks, f.completion_notes,
                COALESCE(c.company_name, c.contact_person, '—') as company_name,
                c.mobile as farmer_mobile, c.village, c.district,
                COALESCE(sp.full_name, '—') as salesperson_name,
                COALESCE(
                  admin_user.full_name,
                  v_sp.full_name,
                  v_cb.full_name,
                  CASE WHEN LOWER(f.status) = 'completed' THEN sp.full_name ELSE NULL END,
                  CASE WHEN LOWER(f.status) = 'completed' THEN cr.full_name ELSE NULL END
                ) as completed_by_name
         FROM followups f
         LEFT JOIN clients c ON f.client_id = c.id
         LEFT JOIN users sp ON f.assigned_salesperson_id = sp.id
         LEFT JOIN users m ON sp.manager_id = m.id
         LEFT JOIN users admin_user ON f.completed_by = admin_user.id
         LEFT JOIN visits v ON f.visit_id = v.id
         LEFT JOIN users v_sp ON v.salesperson_id = v_sp.id
         LEFT JOIN users v_cb ON v.created_by = v_cb.id
         LEFT JOIN users cr ON f.created_by = cr.id
         WHERE ${where}
         ORDER BY f.followup_date DESC, f.id DESC`,
        { replacements: fuReplacements }
      );
      data = rows.map((r, idx) => [
        idx + 1,
        r.followup_date ? String(r.followup_date).slice(0, 10) : '—',
        r.company_name,
        r.farmer_mobile || '—',
        r.village || '—',
        r.district || '—',
        r.title || '—',
        r.salesperson_name,
        r.completed_by_name || (r.status === 'completed' ? r.salesperson_name : '—'),
        (r.priority || 'medium').toUpperCase(),
        (r.status || 'pending').toUpperCase(),
        r.completion_notes || r.remarks || '—'
      ]);
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Report');
    ws.addRow(headers);
    const r1 = ws.getRow(1);
    r1.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    r1.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }
    };
    r1.height = 24;
    data.forEach(row => ws.addRow(row));

    // Auto-fit column widths
    ws.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, cell => {
        const val = cell.value ? String(cell.value) : '';
        maxLength = Math.max(maxLength, val.length);
      });
      column.width = Math.max(maxLength + 3, 12);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    await wb.xlsx.write(res);
    return res.end();
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const brandReport = async (req, res) => {
  const { from_date, to_date, brand_id } = req.query;
  try {
    let where = 'b.deleted_at IS NULL';
    const replacements = [];
    if (brand_id) {
      where += ' AND b.id = ?';
      replacements.push(brand_id);
    }

    let visitWhere = 'v.deleted_at IS NULL';
    if (from_date) {
      visitWhere += ' AND v.visit_date >= ?';
      replacements.push(from_date);
    }
    if (to_date) {
      visitWhere += ' AND v.visit_date <= ?';
      replacements.push(to_date);
    }

    if (req.user.role === 'sales_executive') {
      visitWhere += ' AND v.salesperson_id = ?';
      replacements.push(req.user.id);
    } else if (req.user.role === 'sales_manager') {
      visitWhere += ' AND (v.salesperson_id = ? OR v.salesperson_id IN (SELECT id FROM users WHERE manager_id = ?))';
      replacements.push(req.user.id, req.user.id);
    }

    const [data] = await sequelize.query(
      `SELECT b.id as brand_id, b.name as brand_name,
         COUNT(v.id) as total_visits
       FROM brands b
       LEFT JOIN visit_brands vb ON b.id = vb.brand_id
       LEFT JOIN visits v ON vb.visit_id = v.id AND ${visitWhere}
       WHERE ${where}
       GROUP BY b.id, b.name
       ORDER BY total_visits DESC`,
      { replacements }
    );
    return sendSuccess(res, 'Brand report', data);
  } catch (err) { return sendError(res, err.message, 500); }
};

const momReport = async (req, res) => {
  return sendSuccess(res, 'Month-over-month report', []);
};
const productMovementReport = async (req, res) => {
  return sendSuccess(res, 'Product movement report', { top_products: [], category_movement: [] });
};

module.exports = { salespersonVisitReport, followupReport, billingReport, exportReport, brandReport, momReport, productMovementReport };
