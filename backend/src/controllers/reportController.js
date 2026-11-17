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
    where += ` AND (
      LOWER(u.region) = LOWER(?)
      OR LOWER(m.region) = LOWER(?)
      OR LOWER(c.district) = LOWER(?)
      OR LOWER(c.city) = LOWER(?)
    )`;
    replacements.push(region, region, region, region);
  }
  if (asm_id) {
    where += ' AND (u.manager_id = ? OR v.salesperson_id = ? OR c.assigned_manager_id = ?)';
    replacements.push(asm_id, asm_id, asm_id);
  }
  if (targetTechId) {
    where += ' AND v.salesperson_id = ?';
    replacements.push(targetTechId);
  }

  // Data isolation: Sales executive can only see their assigned farmers' reports
  if (req.user.role === 'sales_executive') {
    where += ' AND v.client_id IN (SELECT id FROM clients WHERE (assigned_salesperson_id = ? OR (assigned_salesperson_id IS NULL AND created_by = ?)) AND deleted_at IS NULL)';
    replacements.push(req.user.id, req.user.id);
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
    where += ` AND (
      LOWER(u.region) = LOWER(?)
      OR LOWER(m.region) = LOWER(?)
      OR LOWER(c.district) = LOWER(?)
      OR LOWER(c.city) = LOWER(?)
    )`;
    replacements.push(region, region, region, region);
  }
  if (asm_id) {
    where += ' AND (u.manager_id = ? OR f.assigned_salesperson_id = ? OR c.assigned_manager_id = ?)';
    replacements.push(asm_id, asm_id, asm_id);
  }
  if (targetTechId) {
    where += ' AND f.assigned_salesperson_id = ?';
    replacements.push(targetTechId);
  }

  // Data isolation: Sales executive can only see their assigned farmers' followups
  if (req.user.role === 'sales_executive') {
    where += ' AND f.client_id IN (SELECT id FROM clients WHERE (assigned_salesperson_id = ? OR (assigned_salesperson_id IS NULL AND created_by = ?)) AND deleted_at IS NULL)';
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
  const { type, from_date, to_date, region, asm_id, technician_id, farmer_id, client_id, meeting_type } = req.query;
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

    if (region && String(region).trim()) {
      baseWhere += ` AND (
        LOWER(sp.region) = LOWER(?)
        OR sp.manager_id IN (SELECT id FROM users WHERE LOWER(region) = LOWER(?))
        OR LOWER(c.district) = LOWER(?)
        OR LOWER(c.city) = LOWER(?)
      )`;
      replacements.push(region, region, region, region);
    }
    if (asm_id) {
      baseWhere += ' AND (sp.manager_id = ? OR v.salesperson_id = ? OR c.assigned_manager_id = ?)';
      replacements.push(asm_id, asm_id, asm_id);
    }
    if (targetTechId) {
      baseWhere += ' AND v.salesperson_id = ?';
      replacements.push(targetTechId);
    }

    if (req.user.role === 'sales_executive') {
      baseWhere += ' AND v.client_id IN (SELECT id FROM clients WHERE (assigned_salesperson_id = ? OR (assigned_salesperson_id IS NULL AND created_by = ?)) AND deleted_at IS NULL)';
      replacements.push(req.user.id, req.user.id);
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
        if (typeof hd === 'string') { try { hd = JSON.parse(hd); } catch(e){} }
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
        if (typeof hd === 'string') { try { hd = JSON.parse(hd); } catch(e){} }
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
        if (typeof hd === 'string') { try { hd = JSON.parse(hd); } catch(e){} }
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
      headers = [
        'Date',
        'Farmer Name',
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
        'Survival',
        'Technical Executive'
      ];
      filename = 'harvest-data-report.xlsx';

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
        if (typeof hd === 'string') { try { hd = JSON.parse(hd); } catch(e){} }
        if (hd && typeof hd === 'object') {
          const partials = Array.isArray(hd.partial_harvests) ? hd.partial_harvests : (hd.partial_harvest ? [hd.partial_harvest] : []);
          for (let i = 0; i < partials.length; i++) {
            const p = partials[i];
            data.push([
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
              data.push([
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
    } else if (type === 'visits') {
      headers = ['Date', 'Technical Executive', 'Farmer', 'City', 'Tank / Pond', 'Meeting Type', 'Outcome', 'Remarks', 'Status'];
      filename = 'visits-report.xlsx';

      const [rows] = await sequelize.query(
        `SELECT v.visit_date, sp.full_name, c.company_name, c.city, v.tank_number, v.meeting_type, v.visit_outcome, v.remarks, v.approval_status
         FROM visits v
         JOIN clients c ON v.client_id = c.id
         JOIN users sp ON v.salesperson_id = sp.id
         WHERE ${baseWhere}
         ORDER BY v.visit_date DESC`,
        { replacements }
      );
      data = rows.map(r => [
        r.visit_date,
        r.full_name,
        r.company_name,
        r.city || '—',
        r.tank_number || '—',
        r.meeting_type ? r.meeting_type.replace(/_/g, ' ') : '—',
        r.visit_outcome || '—',
        r.remarks || '—',
        r.approval_status || '—'
      ]);
    } else {
      headers = ['Followup Title', 'Farmer', 'Technical Executive', 'Date', 'Status'];
      filename = 'followup-report.xlsx';
      let where = 'f.deleted_at IS NULL';
      const fuReplacements = [];
      if (from_date) { where += ' AND f.followup_date >= ?'; fuReplacements.push(from_date); }
      if (to_date) { where += ' AND f.followup_date <= ?'; fuReplacements.push(to_date); }
      if (targetFarmerId) { where += ' AND f.client_id = ?'; fuReplacements.push(targetFarmerId); }

      if (req.user.role === 'sales_executive') {
        where += ' AND f.assigned_salesperson_id = ?';
        fuReplacements.push(req.user.id);
      } else if (req.user.role === 'sales_manager') {
        where += ' AND (f.assigned_salesperson_id = ? OR f.assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id = ?))';
        fuReplacements.push(req.user.id, req.user.id);
      }

      const [rows] = await sequelize.query(
        `SELECT f.title, c.company_name, sp.full_name, f.followup_date, f.status
         FROM followups f JOIN clients c ON f.client_id=c.id JOIN users sp ON f.assigned_salesperson_id=sp.id
         WHERE ${where} ORDER BY f.followup_date DESC`,
        { replacements: fuReplacements }
      );
      data = rows.map(r => [
        r.title,
        r.company_name,
        r.full_name,
        r.followup_date,
        r.status
      ]);
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Report');
    ws.addRow(headers);
    ws.getRow(1).font = { bold: true };
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
    res.end();
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
