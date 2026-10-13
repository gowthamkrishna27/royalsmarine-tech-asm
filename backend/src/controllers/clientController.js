const { v4: uuidv4 } = require('uuid');
const ExcelJS = require('exceljs');
const sequelize = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { getPagination, buildMeta } = require('../utils/pagination');
const { log } = require('../utils/audit');

const buildClientWhere = (query, userId, role) => {
  let where = 'c.deleted_at IS NULL';
  const replacements = [];

  if (role === 'sales_executive') {
    where += ' AND c.assigned_salesperson_id = ?';
    replacements.push(userId);
  } else if (role === 'sales_manager') {
    where += ' AND (c.assigned_manager_id = ? OR c.assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id = ?))';
    replacements.push(userId, userId);
  }

  if (query.city) { where += ' AND c.city = ?'; replacements.push(query.city); }
  if (query.state) { where += ' AND c.state = ?'; replacements.push(query.state); }
  if (query.client_type) { where += ' AND c.client_type = ?'; replacements.push(query.client_type); }
  if (query.status) { where += ' AND c.status = ?'; replacements.push(query.status); }
  if (query.salesperson_id) { where += ' AND c.assigned_salesperson_id = ?'; replacements.push(query.salesperson_id); }
  if (query.search) {
    where += ' AND (c.company_name LIKE ? OR c.mobile LIKE ? OR c.email LIKE ? OR c.contact_person LIKE ?)';
    const s = `%${query.search}%`;
    replacements.push(s, s, s, s);
  }

  return { where, replacements };
};

const listClients = async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const { where, replacements } = buildClientWhere(req.query, req.user.id, req.user.role);

  try {
    const [[{ total }]] = await sequelize.query(
      `SELECT COUNT(*) as total FROM clients c WHERE ${where}`,
      { replacements }
    );

    const [clients] = await sequelize.query(
      `SELECT c.id, c.uuid, c.company_name, c.contact_person, c.mobile, c.email,
              c.city, c.state, c.address, c.latitude, c.longitude, c.gps_address,
              c.area, c.village, c.farm_extent_acres, c.number_of_tanks, c.water_source,
              c.client_type, c.status, c.created_at,
              sp.full_name as salesperson_name, m.full_name as manager_name
       FROM clients c
       LEFT JOIN users sp ON c.assigned_salesperson_id = sp.id
       LEFT JOIN users m ON c.assigned_manager_id = m.id
       WHERE ${where}
       ORDER BY c.company_name ASC LIMIT ? OFFSET ?`,
      { replacements: [...replacements, limit, offset] }
    );

    return sendPaginated(res, 'Clients fetched', clients, buildMeta(total, page, limit));
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const createClient = async (req, res) => {
  const {
    company_name, contact_person, designation, mobile, alternate_mobile, email,
    address, city, state, pincode, latitude, longitude, gps_address,
    industry_type, client_type, assigned_salesperson_id, assigned_manager_id,
    notes, brands, categories, ponds,
  } = req.body;

  const t = await sequelize.transaction();
  try {
    const [existing] = await sequelize.query(
      `SELECT id FROM clients WHERE (company_name = ? OR mobile = ? OR email = ?) AND deleted_at IS NULL LIMIT 1`,
      { replacements: [company_name, mobile || '', email || ''], transaction: t }
    );
    if (existing[0]) {
      await t.rollback();
      return sendError(res, 'Client may already exist (duplicate name, mobile, or email)', 409);
    }

    const uuid = uuidv4();
    const salespersonId = req.user.role === 'sales_executive' ? req.user.id : (assigned_salesperson_id || req.user.id);

    const {
      company_name, contact_person, designation, mobile, alternate_mobile, email,
      address, city, state, pincode, latitude, longitude, gps_address,
      area, village, farm_extent_acres, number_of_tanks, water_source,
      industry_type, client_type, assigned_salesperson_id, assigned_manager_id,
      notes, brands, categories, ponds,
    } = req.body;

    const [result] = await sequelize.query(
      `INSERT INTO clients (uuid, company_name, contact_person, designation, mobile, alternate_mobile, email,
       address, city, state, pincode, latitude, longitude, gps_address,
       area, village, farm_extent_acres, number_of_tanks, water_source,
       industry_type, client_type, assigned_salesperson_id, assigned_manager_id, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      {
        replacements: [
          uuid, company_name, contact_person || null, designation || null,
          mobile || null, alternate_mobile || null, email || null,
          address || null, city || null, state || null, pincode || null,
          latitude || null, longitude || null, gps_address || null,
          area || null, village || null,
          farm_extent_acres ? parseFloat(farm_extent_acres) : null,
          number_of_tanks ? parseInt(number_of_tanks, 10) : (ponds?.length || 0),
          water_source || 'bore',
          industry_type || null, client_type || 'new_prospect',
          salespersonId, assigned_manager_id || null,
          notes || null, req.user.id,
        ],
        transaction: t,
      }
    );

    const clientId = typeof result === 'number' ? result : (result?.insertId || result);

    if (brands && brands.length) {
      for (const brandId of brands) {
        await sequelize.query('INSERT IGNORE INTO client_brands (client_id, brand_id) VALUES (?, ?)', {
          replacements: [clientId, brandId],
          transaction: t,
        });
      }
    }

    if (categories && categories.length) {
      for (const catId of categories) {
        await sequelize.query('INSERT IGNORE INTO client_categories (client_id, category_id) VALUES (?, ?)', {
          replacements: [clientId, catId],
          transaction: t,
        });
      }
    }

    if (ponds && Array.isArray(ponds) && ponds.length) {
      for (const p of ponds) {
        const pondName = p.tank_number || p.pond_name;
        if (!pondName) continue;
        const pondUuid = uuidv4();
        const tankSize = p.tank_size !== undefined && p.tank_size !== '' ? parseFloat(p.tank_size) : (p.area_acres ? parseFloat(p.area_acres) : null);
        await sequelize.query(
          `INSERT INTO ponds (uuid, farmer_id, client_id, pond_name, tank_number, area, area_acres, tank_size,
           salinity, soil_type, hatchery_name, brooder, seed_date, stocking_quantity_lakhs, feed_type,
           culture_type, water_type, latitude, longitude, gps_address, status, remarks, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          {
            replacements: [
              pondUuid, clientId, clientId, pondName, p.tank_number || pondName, tankSize, tankSize, tankSize,
              p.salinity !== undefined && p.salinity !== '' ? parseFloat(p.salinity) : null,
              p.soil_type || null,
              p.hatchery_name || null,
              p.brooder || null,
              p.seed_date || null,
              p.stocking_quantity_lakhs !== undefined && p.stocking_quantity_lakhs !== '' ? parseFloat(p.stocking_quantity_lakhs) : null,
              p.feed_type || null,
              p.culture_type || null, p.water_type || null,
              p.latitude || null, p.longitude || null, p.gps_address || null,
              p.status || 'active', p.remarks || null, req.user.id
            ],
            transaction: t,
          }
        );
      }
    }

    await t.commit();

    await log({ action: 'CLIENT_CREATED', module: 'clients', recordId: clientId, newValue: { company_name }, performedBy: req.user.id, req });

    return sendSuccess(res, 'Client created successfully', { id: clientId, uuid }, 201);
  } catch (err) {
    await t.rollback();
    return sendError(res, err.message, 500);
  }
};

const getClient = async (req, res) => {
  try {
    const [clients] = await sequelize.query(
      `SELECT c.*, sp.full_name as salesperson_name, m.full_name as manager_name
       FROM clients c
       LEFT JOIN users sp ON c.assigned_salesperson_id = sp.id
       LEFT JOIN users m ON c.assigned_manager_id = m.id
       WHERE c.id = ? AND c.deleted_at IS NULL LIMIT 1`,
      { replacements: [req.params.id] }
    );
    if (!clients[0]) return sendError(res, 'Client not found', 404);

    const client = clients[0];

    // Data isolation
    if (req.user.role === 'sales_executive' && client.assigned_salesperson_id && client.assigned_salesperson_id !== req.user.id) {
      return sendError(res, 'Access denied: not your client', 403);
    }

    const [brands] = await sequelize.query(
      'SELECT b.id, b.name FROM brands b JOIN client_brands cb ON b.id = cb.brand_id WHERE cb.client_id = ?',
      { replacements: [req.params.id] }
    );
    const [cats] = await sequelize.query(
      'SELECT c.id, c.name FROM categories c JOIN client_categories cc ON c.id = cc.category_id WHERE cc.client_id = ?',
      { replacements: [req.params.id] }
    );
    const [ponds] = await sequelize.query(
      'SELECT *, COALESCE(area_acres, area) as area_acres FROM ponds WHERE (client_id = ? OR farmer_id = ?) AND deleted_at IS NULL ORDER BY id ASC',
      { replacements: [req.params.id, req.params.id] }
    );

    return sendSuccess(res, 'Client fetched', { ...client, brands, categories: cats, ponds });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const updateClient = async (req, res) => {
  const {
    company_name, contact_person, designation, mobile, alternate_mobile, email,
    address, city, state, pincode, latitude, longitude, gps_address,
    area, village, farm_extent_acres, number_of_tanks, water_source,
    industry_type, client_type, assigned_salesperson_id, assigned_manager_id,
    status, notes, brands, categories, ponds,
  } = req.body;

  const t = await sequelize.transaction();
  try {
    const [existing] = await sequelize.query(
      'SELECT id, assigned_salesperson_id FROM clients WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      { replacements: [req.params.id], transaction: t }
    );
    if (!existing[0]) {
      await t.rollback();
      return sendError(res, 'Client not found', 404);
    }

    if (req.user.role === 'sales_executive' && existing[0].assigned_salesperson_id && existing[0].assigned_salesperson_id !== req.user.id) {
      await t.rollback();
      return sendError(res, 'Access denied: not your client', 403);
    }

    const salespersonId = req.user.role === 'sales_executive' ? existing[0].assigned_salesperson_id : (assigned_salesperson_id || null);

    await sequelize.query(
      `UPDATE clients SET company_name=?, contact_person=?, designation=?, mobile=?, alternate_mobile=?,
       email=?, address=?, city=?, state=?, pincode=?, latitude=?, longitude=?, gps_address=?,
       area=?, village=?, farm_extent_acres=?, number_of_tanks=?, water_source=?,
       industry_type=?, client_type=?, assigned_salesperson_id=?, assigned_manager_id=?,
       status=?, notes=?, updated_at=NOW() WHERE id = ? AND deleted_at IS NULL`,
      {
        replacements: [
          company_name, contact_person || null, designation || null, mobile || null,
          alternate_mobile || null, email || null, address || null, city || null,
          state || null, pincode || null, latitude || null, longitude || null, gps_address || null,
          area || null, village || null,
          farm_extent_acres ? parseFloat(farm_extent_acres) : null,
          number_of_tanks ? parseInt(number_of_tanks, 10) : (ponds?.length || 0),
          water_source || 'bore',
          industry_type || null, client_type, salespersonId,
          assigned_manager_id || null, status, notes || null, req.params.id,
        ],
        transaction: t,
      }
    );

    if (brands !== undefined) {
      await sequelize.query('DELETE FROM client_brands WHERE client_id = ?', { replacements: [req.params.id], transaction: t });
      for (const brandId of (brands || [])) {
        await sequelize.query('INSERT IGNORE INTO client_brands (client_id, brand_id) VALUES (?, ?)', {
          replacements: [req.params.id, brandId],
          transaction: t,
        });
      }
    }

    if (categories !== undefined) {
      await sequelize.query('DELETE FROM client_categories WHERE client_id = ?', { replacements: [req.params.id], transaction: t });
      for (const catId of (categories || [])) {
        await sequelize.query('INSERT IGNORE INTO client_categories (client_id, category_id) VALUES (?, ?)', {
          replacements: [req.params.id, catId],
          transaction: t,
        });
      }
    }

    if (ponds !== undefined && Array.isArray(ponds)) {
      const activePondIds = [];
      for (const p of ponds) {
        const pondName = p.tank_number || p.pond_name;
        if (!pondName) continue;
        const tankSize = p.tank_size !== undefined && p.tank_size !== '' ? parseFloat(p.tank_size) : (p.area_acres ? parseFloat(p.area_acres) : null);

        if (p.id) {
          activePondIds.push(p.id);
          await sequelize.query(
            `UPDATE ponds SET pond_name=?, tank_number=?, area=?, area_acres=?, tank_size=?,
             salinity=?, soil_type=?, hatchery_name=?, brooder=?, seed_date=?,
             stocking_quantity_lakhs=?, feed_type=?, culture_type=?, water_type=?,
             latitude=?, longitude=?, gps_address=?, status=?, remarks=?, updated_at=NOW()
             WHERE id=? AND (client_id=? OR farmer_id=?) AND deleted_at IS NULL`,
            {
              replacements: [
                pondName, p.tank_number || pondName, tankSize, tankSize, tankSize,
                p.salinity !== undefined && p.salinity !== '' ? parseFloat(p.salinity) : null,
                p.soil_type || null,
                p.hatchery_name || null,
                p.brooder || null,
                p.seed_date || null,
                p.stocking_quantity_lakhs !== undefined && p.stocking_quantity_lakhs !== '' ? parseFloat(p.stocking_quantity_lakhs) : null,
                p.feed_type || null,
                p.culture_type || null, p.water_type || null,
                p.latitude || null, p.longitude || null, p.gps_address || null,
                p.status || 'active', p.remarks || null, p.id, req.params.id, req.params.id
              ],
              transaction: t,
            }
          );
        } else {
          const pondUuid = uuidv4();
          const [insertRes] = await sequelize.query(
            `INSERT INTO ponds (uuid, farmer_id, client_id, pond_name, tank_number, area, area_acres, tank_size,
             salinity, soil_type, hatchery_name, brooder, seed_date, stocking_quantity_lakhs, feed_type,
             culture_type, water_type, latitude, longitude, gps_address, status, remarks, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            {
              replacements: [
                pondUuid, req.params.id, req.params.id, pondName, p.tank_number || pondName, tankSize, tankSize, tankSize,
                p.salinity !== undefined && p.salinity !== '' ? parseFloat(p.salinity) : null,
                p.soil_type || null,
                p.hatchery_name || null,
                p.brooder || null,
                p.seed_date || null,
                p.stocking_quantity_lakhs !== undefined && p.stocking_quantity_lakhs !== '' ? parseFloat(p.stocking_quantity_lakhs) : null,
                p.feed_type || null,
                p.culture_type || null, p.water_type || null,
                p.latitude || null, p.longitude || null, p.gps_address || null,
                p.status || 'active', p.remarks || null, req.user.id
              ],
              transaction: t,
            }
          );
          const newId = typeof insertRes === 'number' ? insertRes : (insertRes?.insertId || insertRes);
          if (newId) activePondIds.push(newId);
        }
      }

      if (activePondIds.length > 0) {
        await sequelize.query(
          `UPDATE ponds SET deleted_at=NOW() WHERE (client_id=? OR farmer_id=?) AND id NOT IN (${activePondIds.map(() => '?').join(',')}) AND deleted_at IS NULL`,
          { replacements: [req.params.id, req.params.id, ...activePondIds], transaction: t }
        );
      } else {
        await sequelize.query(
          `UPDATE ponds SET deleted_at=NOW() WHERE (client_id=? OR farmer_id=?) AND deleted_at IS NULL`,
          { replacements: [req.params.id, req.params.id], transaction: t }
        );
      }
    }

    await t.commit();

    await log({ action: 'CLIENT_UPDATED', module: 'clients', recordId: req.params.id, performedBy: req.user.id, req });
    return sendSuccess(res, 'Client updated successfully');
  } catch (err) {
    await t.rollback();
    return sendError(res, err.message, 500);
  }
};

const getClientProfile = async (req, res) => {
  const clientId = req.params.id;
  try {
    const [clients] = await sequelize.query(
      `SELECT c.*, sp.full_name as salesperson_name, m.full_name as manager_name
       FROM clients c
       LEFT JOIN users sp ON c.assigned_salesperson_id = sp.id
       LEFT JOIN users m ON c.assigned_manager_id = m.id
       WHERE c.id = ? AND c.deleted_at IS NULL LIMIT 1`,
      { replacements: [clientId] }
    );
    if (!clients[0]) return sendError(res, 'Client not found', 404);

    const [[{ visit_count }]] = await sequelize.query(
      'SELECT COUNT(*) as visit_count FROM visits WHERE client_id = ? AND deleted_at IS NULL',
      { replacements: [clientId] }
    );
    const [[{ opp_count }]] = await sequelize.query(
      'SELECT COUNT(*) as opp_count FROM opportunities WHERE client_id = ? AND deleted_at IS NULL',
      { replacements: [clientId] }
    );
    const [[{ pending_followups }]] = await sequelize.query(
      "SELECT COUNT(*) as pending_followups FROM followups WHERE client_id = ? AND status IN ('pending','overdue') AND deleted_at IS NULL",
      { replacements: [clientId] }
    );

    const [ponds] = await sequelize.query(
      'SELECT *, COALESCE(area_acres, area) as area_acres FROM ponds WHERE (client_id = ? OR farmer_id = ?) AND deleted_at IS NULL ORDER BY id ASC',
      { replacements: [clientId, clientId] }
    );
    const total_acres = ponds.reduce((acc, p) => acc + (parseFloat(p.area_acres) || 0), 0);
    const active_ponds = ponds.filter(p => p.status === 'active').length;

    return sendSuccess(res, 'Client profile fetched', {
      ...clients[0],
      ponds,
      stats: {
        visit_count,
        opp_count,
        pending_followups,
        pond_count: ponds.length,
        total_acres: Number(total_acres.toFixed(2)),
        active_ponds,
      },
    });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const exportClients = async (req, res) => {
  const { where, replacements } = buildClientWhere(req.query, req.user.id, req.user.role);
  try {
    const [clients] = await sequelize.query(
      `SELECT c.company_name, c.contact_person, c.designation, c.mobile, c.alternate_mobile,
              c.email, c.address, c.city, c.state, c.pincode, c.industry_type, c.client_type,
              c.status, sp.full_name as salesperson, m.full_name as manager, c.created_at
       FROM clients c
       LEFT JOIN users sp ON c.assigned_salesperson_id = sp.id
       LEFT JOIN users m ON c.assigned_manager_id = m.id
       WHERE ${where} ORDER BY c.company_name`,
      { replacements }
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Clients');
    ws.addRow(['Company', 'Contact Person', 'Designation', 'Mobile', 'Alt Mobile', 'Email',
      'Address', 'City', 'State', 'Pincode', 'Industry', 'Type', 'Status', 'Salesperson', 'Manager', 'Created']);
    clients.forEach(c => ws.addRow(Object.values(c)));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=clients.xlsx');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const importClients = async (req, res) => {
  if (!req.file) return sendError(res, 'No file uploaded', 400);
  const summary = { total: 0, imported: 0, skipped: 0, errors: [] };
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(req.file.buffer);
    const ws = wb.worksheets[0];
    if (!ws) return sendError(res, 'Excel file has no worksheets', 400);

    const rows = [];
    ws.eachRow((row, rowNumber) => { if (rowNumber > 1) rows.push({ rowNumber, values: row.values }); });
    summary.total = rows.length;

    for (const { rowNumber, values } of rows) {
      // Cols: Company Name | Contact Person | Mobile | Email | City | State | Pincode | Client Type | Industry | Salesperson Email
      const company_name      = (values[1] || '').toString().trim();
      const contact_person    = (values[2] || '').toString().trim() || null;
      const mobile            = (values[3] || '').toString().trim() || null;
      const email             = (values[4] || '').toString().trim() || null;
      const city              = (values[5] || '').toString().trim() || null;
      const state             = (values[6] || '').toString().trim() || null;
      const pincode           = (values[7] || '').toString().trim() || null;
      const client_type       = (values[8] || '').toString().trim() || 'new_prospect';
      const industry_type     = (values[9] || '').toString().trim() || null;
      const salesperson_email = (values[10] || '').toString().trim() || null;

      if (!company_name) { summary.errors.push({ row: rowNumber, error: 'Company Name required' }); summary.skipped++; continue; }

      try {
        let assigned_salesperson_id = req.user.id;
        if (salesperson_email) {
          const [spRows] = await sequelize.query('SELECT id FROM users WHERE email=? AND deleted_at IS NULL LIMIT 1', { replacements: [salesperson_email] });
          if (spRows[0]) assigned_salesperson_id = spRows[0].id;
        }
        const [result] = await sequelize.query(
          `INSERT IGNORE INTO clients (uuid, company_name, contact_person, mobile, email, city, state, pincode, client_type, industry_type, assigned_salesperson_id, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          { replacements: [uuidv4(), company_name, contact_person, mobile, email, city, state, pincode, client_type, industry_type, assigned_salesperson_id, req.user.id] }
        );
        result.affectedRows === 0 ? summary.skipped++ : summary.imported++;
      } catch (rowErr) { summary.errors.push({ row: rowNumber, error: rowErr.message }); summary.skipped++; }
    }
    return sendSuccess(res, 'Import complete', summary);
  } catch (err) { return sendError(res, err.message, 500); }
};

const listPonds = async (req, res) => {
  try {
    const [ponds] = await sequelize.query(
      'SELECT *, COALESCE(area_acres, area) as area_acres FROM ponds WHERE (client_id = ? OR farmer_id = ?) AND deleted_at IS NULL ORDER BY id ASC',
      { replacements: [req.params.id, req.params.id] }
    );
    return sendSuccess(res, 'Ponds fetched', ponds);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const createPond = async (req, res) => {
  const {
    pond_name, tank_number, area_acres, tank_size, salinity, soil_type,
    hatchery_name, brooder, seed_date, stocking_quantity_lakhs, feed_type,
    culture_type, water_type, latitude, longitude, gps_address, status, remarks
  } = req.body;
  const finalName = tank_number || pond_name;
  if (!finalName) return sendError(res, 'Tank number or name is required', 400);

  try {
    const [clientRows] = await sequelize.query(
      'SELECT id, assigned_salesperson_id FROM clients WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      { replacements: [req.params.id] }
    );
    if (!clientRows[0]) return sendError(res, 'Farmer not found', 404);

    if (req.user.role === 'sales_executive' && clientRows[0].assigned_salesperson_id && clientRows[0].assigned_salesperson_id !== req.user.id) {
      return sendError(res, 'Access denied: not your client', 403);
    }

    const uuid = uuidv4();
    const finalSize = tank_size !== undefined && tank_size !== '' ? parseFloat(tank_size) : (area_acres ? parseFloat(area_acres) : null);
    const [result] = await sequelize.query(
      `INSERT INTO ponds (uuid, farmer_id, client_id, pond_name, tank_number, area, area_acres, tank_size,
       salinity, soil_type, hatchery_name, brooder, seed_date, stocking_quantity_lakhs, feed_type,
       culture_type, water_type, latitude, longitude, gps_address, status, remarks, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      {
        replacements: [
          uuid, req.params.id, req.params.id, finalName, tank_number || finalName, finalSize, finalSize, finalSize,
          salinity !== undefined && salinity !== '' ? parseFloat(salinity) : null,
          soil_type || null,
          hatchery_name || null,
          brooder || null,
          seed_date || null,
          stocking_quantity_lakhs !== undefined && stocking_quantity_lakhs !== '' ? parseFloat(stocking_quantity_lakhs) : null,
          feed_type || null,
          culture_type || null, water_type || null,
          latitude || null, longitude || null, gps_address || null, status || 'active', remarks || null, req.user.id
        ]
      }
    );
    const id = typeof result === 'number' ? result : (result?.insertId || result);
    return sendSuccess(res, 'Tank created successfully', { id, uuid, pond_name: finalName }, 201);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const updatePond = async (req, res) => {
  const {
    pond_name, tank_number, area_acres, tank_size, salinity, soil_type,
    hatchery_name, brooder, seed_date, stocking_quantity_lakhs, feed_type,
    culture_type, water_type, latitude, longitude, gps_address, status, remarks
  } = req.body;
  try {
    const [clientRows] = await sequelize.query(
      'SELECT id, assigned_salesperson_id FROM clients WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      { replacements: [req.params.id] }
    );
    if (!clientRows[0]) return sendError(res, 'Farmer not found', 404);

    if (req.user.role === 'sales_executive' && clientRows[0].assigned_salesperson_id && clientRows[0].assigned_salesperson_id !== req.user.id) {
      return sendError(res, 'Access denied: not your client', 403);
    }

    const [existing] = await sequelize.query(
      'SELECT id FROM ponds WHERE id = ? AND (client_id = ? OR farmer_id = ?) AND deleted_at IS NULL LIMIT 1',
      { replacements: [req.params.pondId, req.params.id, req.params.id] }
    );
    if (!existing[0]) return sendError(res, 'Tank not found', 404);

    const finalName = tank_number || pond_name || existing[0].pond_name;
    const finalSize = tank_size !== undefined && tank_size !== '' ? parseFloat(tank_size) : (area_acres ? parseFloat(area_acres) : null);

    await sequelize.query(
      `UPDATE ponds SET pond_name=?, tank_number=?, area=?, area_acres=?, tank_size=?,
       salinity=?, soil_type=?, hatchery_name=?, brooder=?, seed_date=?,
       stocking_quantity_lakhs=?, feed_type=?, culture_type=?, water_type=?,
       latitude=?, longitude=?, gps_address=?, status=?, remarks=?, updated_at=NOW()
       WHERE id=? AND (client_id=? OR farmer_id=?) AND deleted_at IS NULL`,
      {
        replacements: [
          finalName, tank_number || finalName, finalSize, finalSize, finalSize,
          salinity !== undefined && salinity !== '' ? parseFloat(salinity) : null,
          soil_type || null,
          hatchery_name || null,
          brooder || null,
          seed_date || null,
          stocking_quantity_lakhs !== undefined && stocking_quantity_lakhs !== '' ? parseFloat(stocking_quantity_lakhs) : null,
          feed_type || null,
          culture_type || null, water_type || null,
          latitude || null, longitude || null, gps_address || null, status || 'active',
          remarks || null, req.params.pondId, req.params.id, req.params.id
        ]
      }
    );
    return sendSuccess(res, 'Tank updated successfully');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const deletePond = async (req, res) => {
  try {
    const [clientRows] = await sequelize.query(
      'SELECT id, assigned_salesperson_id FROM clients WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      { replacements: [req.params.id] }
    );
    if (!clientRows[0]) return sendError(res, 'Farmer not found', 404);

    if (req.user.role === 'sales_executive' && clientRows[0].assigned_salesperson_id && clientRows[0].assigned_salesperson_id !== req.user.id) {
      return sendError(res, 'Access denied: not your client', 403);
    }

    await sequelize.query(
      'UPDATE ponds SET deleted_at = NOW() WHERE id = ? AND (client_id = ? OR farmer_id = ?) AND deleted_at IS NULL',
      { replacements: [req.params.pondId, req.params.id, req.params.id] }
    );
    return sendSuccess(res, 'Pond deleted successfully');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const getMapLocations = async (req, res) => {
  const { where, replacements } = buildClientWhere(req.query, req.user.id, req.user.role);

  try {
    const [clients] = await sequelize.query(
      `SELECT c.id, c.uuid, c.company_name, c.contact_person, c.mobile, c.email,
              c.city, c.state, c.address, c.pincode, c.latitude, c.longitude, c.gps_address,
              c.area, c.village, c.farm_extent_acres, c.number_of_tanks, c.water_source,
              c.client_type, c.status,
              sp.full_name as salesperson_name
       FROM clients c
       LEFT JOIN users sp ON c.assigned_salesperson_id = sp.id
       WHERE ${where}
       ORDER BY c.company_name ASC`,
      { replacements }
    );

    let ponds = [];
    if (clients.length > 0) {
      const clientIds = clients.map(c => c.id);
      const [pondRows] = await sequelize.query(
        `SELECT p.id, p.uuid, COALESCE(p.client_id, p.farmer_id) as client_id,
                p.pond_name, p.tank_number, p.area, p.area_acres, p.tank_size,
                p.salinity, p.soil_type, p.hatchery_name, p.brooder, p.seed_date,
                p.stocking_quantity_lakhs, p.feed_type, p.culture_type, p.water_type,
                p.latitude, p.longitude, p.gps_address, p.status, p.remarks
         FROM ponds p
         WHERE (p.client_id IN (?) OR p.farmer_id IN (?)) AND p.deleted_at IS NULL
         ORDER BY p.pond_name ASC`,
        { replacements: [clientIds, clientIds] }
      );
      ponds = pondRows;
    }

    return sendSuccess(res, 'Map locations fetched', { clients, ponds });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

module.exports = {
  listClients,
  createClient,
  getClient,
  updateClient,
  getClientProfile,
  exportClients,
  importClients,
  listPonds,
  createPond,
  updatePond,
  deletePond,
  getMapLocations,
};
