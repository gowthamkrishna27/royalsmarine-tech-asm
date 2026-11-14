const { v4: uuidv4 } = require('uuid');
const ExcelJS = require('exceljs');
const sequelize = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { getPagination, buildMeta } = require('../utils/pagination');
const { log } = require('../utils/audit');

let pondDocCols = null;
let clientCols = null;
const getClientCols = async () => {
  if (clientCols) return clientCols;
  try {
    const [cols] = await sequelize.query('DESCRIBE clients');
    clientCols = new Set((cols || []).map(c => String(c.Field || '').toLowerCase()));
  } catch {
    clientCols = new Set();
  }
  return clientCols;
};
const getPondDocCols = async () => {
  if (pondDocCols) return pondDocCols;
  try {
    const [cols] = await sequelize.query('DESCRIBE ponds');
    const set = new Set((cols || []).map(c => String(c.Field || '').toLowerCase()));
    pondDocCols = {
      hasDoc: set.has('doc'),
      hasDocDate: set.has('doc_date'),
      hasArea: set.has('area'),
      hasAreaAcres: set.has('area_acres'),
    };
  } catch {
    pondDocCols = { hasDoc: false, hasDocDate: false, hasArea: false, hasAreaAcres: false };
  }
  return pondDocCols;
};
const pondAreaExpr = ({ hasArea, hasAreaAcres }, alias = '') => {
  const a = alias ? `${alias}.` : '';
  if (hasAreaAcres && hasArea) return `COALESCE(${a}area_acres, ${a}area) as area_acres`;
  if (hasAreaAcres) return `${a}area_acres as area_acres`;
  if (hasArea) return `${a}area as area_acres`;
  return `NULL as area_acres`;
};

const pondCurrentDocExpr = ({ hasDoc, hasDocDate }, alias = 'p', as = 'current_doc') => {
  if (hasDoc && hasDocDate) {
    return `CASE
          WHEN ${alias}.seed_date IS NOT NULL THEN GREATEST(0, DATEDIFF(CURDATE(), ${alias}.seed_date))
          WHEN ${alias}.doc IS NOT NULL AND ${alias}.doc_date IS NOT NULL THEN GREATEST(0, ${alias}.doc + DATEDIFF(CURDATE(), ${alias}.doc_date))
          WHEN ${alias}.doc IS NOT NULL THEN GREATEST(0, ${alias}.doc)
          ELSE ${as === 'current_doc' ? '0' : 'NULL'}
        END as ${as}`;
  }
  if (hasDoc) {
    return `CASE
          WHEN ${alias}.seed_date IS NOT NULL THEN GREATEST(0, DATEDIFF(CURDATE(), ${alias}.seed_date))
          WHEN ${alias}.doc IS NOT NULL THEN GREATEST(0, ${alias}.doc)
          ELSE ${as === 'current_doc' ? '0' : 'NULL'}
        END as ${as}`;
  }
  return `CASE
          WHEN ${alias}.seed_date IS NOT NULL THEN GREATEST(0, DATEDIFF(CURDATE(), ${alias}.seed_date))
          ELSE ${as === 'current_doc' ? '0' : 'NULL'}
        END as ${as}`;
};

const pondDocParts = (hasDoc, hasDocDate, docVal, docDateVal) => {
  const cols = [];
  const vals = [];
  if (hasDoc) { cols.push('doc'); vals.push(docVal); }
  if (hasDocDate) { cols.push('doc_date'); vals.push(docDateVal); }
  return { cols, vals };
};

const buildClientWhere = (query, userId, role) => {
  let where = 'c.deleted_at IS NULL';
  const replacements = [];

  if (role === 'sales_executive') {
    where += ' AND (c.assigned_salesperson_id = ? OR c.created_by = ?)';
    replacements.push(userId, userId);
  } else if (role === 'sales_manager') {
    if (query.scope === 'my_farmers') {
      where += ' AND (c.assigned_salesperson_id = ? OR (c.created_by = ? AND (c.assigned_salesperson_id IS NULL OR c.assigned_salesperson_id = ?)))';
      replacements.push(userId, userId, userId);
    } else if (query.scope === 'tech_exec_farmers' || query.scope === 'farmers') {
      where += " AND c.assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id = ? AND status = 'active' AND deleted_at IS NULL)";
      replacements.push(userId);
    } else {
      where += " AND (c.assigned_manager_id = ? OR c.assigned_salesperson_id = ? OR c.created_by = ? OR c.assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id = ? AND status = 'active' AND deleted_at IS NULL) OR c.created_by IN (SELECT id FROM users WHERE manager_id = ? AND status = 'active' AND deleted_at IS NULL))";
      replacements.push(userId, userId, userId, userId, userId);
    }
  }

  // Filter by Region
  if (query.region && String(query.region).trim()) {
    const reg = String(query.region).trim();
    where += ` AND (
      c.assigned_salesperson_id IN (
        SELECT u.id FROM users u
        LEFT JOIN users m ON u.manager_id = m.id
        WHERE (LOWER(TRIM(u.region)) = LOWER(TRIM(?)) OR LOWER(TRIM(m.region)) = LOWER(TRIM(?))) AND u.deleted_at IS NULL AND u.status = 'active'
      )
      OR c.assigned_manager_id IN (
        SELECT id FROM users WHERE LOWER(TRIM(region)) = LOWER(TRIM(?)) AND deleted_at IS NULL AND status = 'active'
      )
      OR LOWER(TRIM(c.district)) = LOWER(TRIM(?))
      OR LOWER(TRIM(c.city)) = LOWER(TRIM(?))
    )`;
    replacements.push(reg, reg, reg, reg, reg);
  }

  // Filter by ASM (Sales Manager)
  const asmId = query.asm_id || query.manager_id;
  if (asmId) {
    where += ` AND (
      c.assigned_manager_id = ?
      OR c.assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id = ? AND status = 'active' AND deleted_at IS NULL)
    )`;
    replacements.push(asmId, asmId);
  }

  // Filter by Tech (Sales Executive)
  const techId = query.tech_id || query.salesperson_id;
  if (techId) {
    where += ' AND c.assigned_salesperson_id = ?';
    replacements.push(techId);
  }

  if (query.city) { where += ' AND c.city = ?'; replacements.push(query.city); }
  if (query.state) { where += ' AND c.state = ?'; replacements.push(query.state); }
  if (query.client_type) { where += ' AND c.client_type = ?'; replacements.push(query.client_type); }
  if (query.status) { where += ' AND c.status = ?'; replacements.push(query.status); }
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
              c.assigned_salesperson_id, c.assigned_manager_id, c.created_by,
              sp.full_name as salesperson_name, m.full_name as manager_name
       FROM clients c
       LEFT JOIN users sp ON c.assigned_salesperson_id = sp.id AND sp.status = 'active'
       LEFT JOIN users m ON c.assigned_manager_id = m.id AND m.status = 'active'
       WHERE ${where}
       ORDER BY c.created_at DESC, c.id DESC LIMIT ? OFFSET ?`,
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
    address, city, district, state, pincode, latitude, longitude, gps_address,
    area, mandal, village, farm_extent_acres, number_of_tanks, water_source,
    industry_type, client_type, assigned_salesperson_id, assigned_manager_id,
    notes, brands, categories, ponds, status,
  } = req.body;

  const t = await sequelize.transaction();
  try {
    const [existing] = await sequelize.query(
      `SELECT id FROM clients WHERE (company_name = ? OR (mobile = ? AND mobile != '') OR (email = ? AND email != '')) AND deleted_at IS NULL LIMIT 1`,
      { replacements: [company_name, mobile || '', email || ''], transaction: t }
    );
    if (existing[0]) {
      await t.rollback();
      return sendError(res, 'Client may already exist (duplicate name, mobile, or email)', 409);
    }

    const uuid = uuidv4();
    let salespersonId = assigned_salesperson_id ? parseInt(assigned_salesperson_id, 10) : null;
    let managerId = assigned_manager_id ? parseInt(assigned_manager_id, 10) : null;

    if (!salespersonId) {
      salespersonId = req.user.id;
    }

    if (!managerId) {
      if (req.user.role === 'sales_manager') {
        managerId = req.user.id;
      } else {
        const [u] = await sequelize.query('SELECT manager_id FROM users WHERE id = ?', {
          replacements: [salespersonId || req.user.id],
          transaction: t
        });
        if (u[0]?.manager_id) {
          managerId = u[0].manager_id;
        }
      }
    }

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
          salespersonId, managerId,
          notes || null, req.user.id,
        ],
        transaction: t,
      }
    );

    const clientId = typeof result === 'number' ? result : (result?.insertId || result);

    if (ponds && Array.isArray(ponds) && ponds.length) {
      const pondCols = await getPondDocCols();
      for (const p of ponds) {
        const pondName = p.tank_number || p.pond_name;
        if (!pondName) continue;
        const pondUuid = uuidv4();
        const tankSize = (p.tank_size !== undefined && p.tank_size !== '' && !isNaN(p.tank_size)) ? parseFloat(p.tank_size) : ((p.area_acres && !isNaN(p.area_acres)) ? parseFloat(p.area_acres) : null);
        const seedDate = (p.seed_date && String(p.seed_date).trim()) ? String(p.seed_date).trim().substring(0, 10) : null;
        const salinityVal = (p.salinity !== undefined && p.salinity !== '' && !isNaN(p.salinity)) ? parseFloat(p.salinity) : null;
        const stockQty = (p.stocking_quantity_lakhs !== undefined && p.stocking_quantity_lakhs !== '' && !isNaN(p.stocking_quantity_lakhs)) ? parseFloat(p.stocking_quantity_lakhs) : null;
        const latVal = (p.latitude !== undefined && p.latitude !== '' && !isNaN(p.latitude)) ? parseFloat(p.latitude) : null;
        const lngVal = (p.longitude !== undefined && p.longitude !== '' && !isNaN(p.longitude)) ? parseFloat(p.longitude) : null;
        const polyCoords = p.polygon_coordinates ? (typeof p.polygon_coordinates === 'string' ? p.polygon_coordinates : JSON.stringify(p.polygon_coordinates)) : null;

        const docVal = (p.doc !== undefined && p.doc !== '' && p.doc !== null && !isNaN(p.doc)) ? Math.max(0, parseInt(p.doc, 10)) : null;
        const docDateVal = docVal !== null ? (p.doc_date && String(p.doc_date).trim() ? String(p.doc_date).trim().substring(0, 10) : new Date().toISOString().slice(0, 10)) : null;
        const docParts = pondDocParts(pondCols.hasDoc, pondCols.hasDocDate, docVal, docDateVal);

        await sequelize.query(
          `INSERT INTO ponds (uuid, farmer_id, client_id, pond_name, tank_number, area, area_acres, tank_size,
           salinity, soil_type, hatchery_name, brooder, dealer_name, seed_date, stocking_quantity_lakhs, feed_type,
           culture_type, water_type, water_source, latitude, longitude, polygon_coordinates, gps_address, status, remarks, created_by${docParts.cols.length ? ', ' + docParts.cols.join(', ') : ''})
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${docParts.cols.length ? ', ' + docParts.cols.map(() => '?').join(', ') : ''})`,
          {
            replacements: [
              pondUuid, clientId, clientId, pondName, p.tank_number || pondName, tankSize, tankSize, tankSize,
              salinityVal,
              p.soil_type || null,
              p.hatchery_name || null,
              p.brooder || null,
              p.dealer_name || null,
              seedDate,
              stockQty,
              p.feed_type || null,
              p.culture_type || null, p.water_type || p.water_source || null, p.water_source || p.water_type || null,
              latVal, lngVal, polyCoords, p.gps_address || null,
              p.status || 'active', p.remarks || null, req.user.id,
              ...docParts.vals
            ],
            transaction: t,
          }
        );
      }
    }

    // Save in farmers table as well
    try {
      await sequelize.query(
        `INSERT INTO farmers (
          id, farmer_code, name, phone, alternate_phone, address, village, mandal, district, state,
          location, latitude, longitude, acres, total_acres, water_source, assigned_to, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          name = VALUES(name), phone = VALUES(phone), alternate_phone = VALUES(alternate_phone),
          address = VALUES(address), village = VALUES(village), mandal = VALUES(mandal),
          district = VALUES(district), state = VALUES(state), location = VALUES(location),
          latitude = VALUES(latitude), longitude = VALUES(longitude), acres = VALUES(acres),
          total_acres = VALUES(total_acres), water_source = VALUES(water_source),
          assigned_to = VALUES(assigned_to), status = VALUES(status), updated_at = NOW()`,
        {
          replacements: [
            String(clientId),
            `FARM-${clientId}`,
            company_name,
            mobile || null,
            alternate_mobile || null,
            address || null,
            village || null,
            mandal || area || null,
            district || city || null,
            state || null,
            gps_address || city || village || null,
            latitude ? parseFloat(latitude) : null,
            longitude ? parseFloat(longitude) : null,
            farm_extent_acres ? parseFloat(farm_extent_acres) : null,
            farm_extent_acres ? parseFloat(farm_extent_acres) : null,
            water_source || 'bore',
            salespersonId ? String(salespersonId) : null,
            status || 'active',
          ],
          transaction: t,
        }
      );
    } catch (farmerErr) {
      console.warn('Warning saving to farmers table:', farmerErr.message);
    }

    
    // Link to dealer_farmers if user is a dealer
    if (req.user && req.user.role === 'dealer') {
      try {
        const [d] = await sequelize.query('SELECT id FROM dealers WHERE user_id = ? AND deleted_at IS NULL LIMIT 1', {
          replacements: [req.user.id],
          transaction: t
        });
        if (d[0]?.id) {
          const connDate = req.body.connected_date || req.body.connection_date || new Date().toISOString().slice(0, 10);
          await sequelize.query(
            `INSERT INTO dealer_farmers (dealer_id, farmer_id, connection_date, status, created_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, NOW(), NOW())
             ON DUPLICATE KEY UPDATE connection_date = VALUES(connection_date), status = VALUES(status), updated_at = NOW()`,
            {
              replacements: [d[0].id, clientId, connDate, status || 'active', req.user.id],
              transaction: t
            }
          );
        }
      } catch (dfErr) {
        console.warn('Warning linking dealer_farmers in createClient:', dfErr.message);
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
    if (req.user.role === 'sales_executive' && client.assigned_salesperson_id && client.assigned_salesperson_id !== req.user.id && client.created_by !== req.user.id) {
      return sendError(res, 'Access denied: not your client', 403);
    }

  try {
    const docCols = await getPondDocCols();
    const [ponds] = await sequelize.query(
      `SELECT *, ${pondAreaExpr(docCols)}, ${pondCurrentDocExpr(docCols, 'ponds', 'current_doc').replace(/\bponds\./g, '')}
       FROM ponds WHERE (client_id = ? OR farmer_id = ?) AND deleted_at IS NULL ORDER BY id ASC`,
      { replacements: [req.params.id, req.params.id] }
    );

    return sendSuccess(res, 'Client fetched', { ...client, brands: [], categories: [], ponds: ponds || [] });
  } catch (pondErr) {
    console.error('getClient ponds lookup failed:', pondErr);
    return sendSuccess(res, 'Client fetched', { ...client, brands: [], categories: [], ponds: [] });
  }
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const updateClient = async (req, res) => {
  const {
    company_name, contact_person, designation, mobile, alternate_mobile, email,
    address, city, district, state, pincode, latitude, longitude, gps_address,
    area, mandal, village, farm_extent_acres, number_of_tanks, water_source,
    industry_type, client_type, assigned_salesperson_id, assigned_manager_id,
    status, notes, close_reason, brands, categories, ponds,
  } = req.body;

  const t = await sequelize.transaction();
  try {
    const [existing] = await sequelize.query(
      'SELECT * FROM clients WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      { replacements: [req.params.id], transaction: t }
    );
    if (!existing[0]) {
      await t.rollback();
      return sendError(res, 'Client not found', 404);
    }
    const cur = existing[0];

    if (req.user.role === 'sales_executive' && cur.assigned_salesperson_id && cur.assigned_salesperson_id !== req.user.id && cur.created_by !== req.user.id) {
      await t.rollback();
      return sendError(res, 'Access denied: not your client', 403);
    }

    const cols = await getClientCols();
    const hasCloseReason = cols.has('close_reason');
    const isAdmin = ['super_admin', 'admin'].includes(req.user.role);
    const curClosed = ['forcely_closed', 'forced_closed', 'closed'].includes(cur.status);
    if (!isAdmin && curClosed && status !== undefined && !['forcely_closed', 'forced_closed', 'closed'].includes(status || '')) {
      await t.rollback();
      return sendError(res, 'Only administrators can reactivate a forcibly closed farmer', 403);
    }

    // Preserve existing values/assignments when not explicitly passed (supports status-only close)
    const salespersonId = (assigned_salesperson_id !== undefined && assigned_salesperson_id !== null && assigned_salesperson_id !== '')
      ? parseInt(assigned_salesperson_id, 10)
      : cur.assigned_salesperson_id;

    let managerId = (assigned_manager_id !== undefined && assigned_manager_id !== null && assigned_manager_id !== '')
      ? parseInt(assigned_manager_id, 10)
      : cur.assigned_manager_id;

    if (!managerId && salespersonId) {
      const [u] = await sequelize.query('SELECT manager_id FROM users WHERE id = ?', {
        replacements: [salespersonId],
        transaction: t,
      });
      if (u[0]?.manager_id) {
        managerId = u[0].manager_id;
      }
    }

    const setParts = [
      'company_name=?', 'contact_person=?', 'designation=?', 'mobile=?', 'alternate_mobile=?',
      'email=?', 'address=?', 'city=?', 'state=?', 'pincode=?', 'latitude=?', 'longitude=?', 'gps_address=?',
      'area=?', 'village=?', 'farm_extent_acres=?', 'number_of_tanks=?', 'water_source=?',
      'industry_type=?', 'client_type=?', 'assigned_salesperson_id=?', 'assigned_manager_id=?',
      'status=?', 'notes=?',
    ];
    const updateReplacements = [
      company_name !== undefined ? company_name : cur.company_name,
      contact_person !== undefined ? (contact_person || null) : (cur.contact_person ?? null),
      designation !== undefined ? (designation || null) : (cur.designation ?? null),
      mobile !== undefined ? (mobile || null) : (cur.mobile ?? null),
      alternate_mobile !== undefined ? (alternate_mobile || null) : (cur.alternate_mobile ?? null),
      email !== undefined ? (email || null) : (cur.email ?? null),
      address !== undefined ? (address || null) : (cur.address ?? null),
      city !== undefined ? (city || null) : (cur.city ?? null),
      state !== undefined ? (state || null) : (cur.state ?? null),
      pincode !== undefined ? (pincode || null) : (cur.pincode ?? null),
      latitude !== undefined ? (latitude || null) : (cur.latitude ?? null),
      longitude !== undefined ? (longitude || null) : (cur.longitude ?? null),
      gps_address !== undefined ? (gps_address || null) : (cur.gps_address ?? null),
      area !== undefined ? (area || null) : (cur.area ?? null),
      village !== undefined ? (village || null) : (cur.village ?? null),
      farm_extent_acres !== undefined ? (farm_extent_acres ? parseFloat(farm_extent_acres) : null) : (cur.farm_extent_acres ?? null),
      number_of_tanks !== undefined ? (number_of_tanks ? parseInt(number_of_tanks, 10) : (ponds?.length || 0)) : (cur.number_of_tanks ?? 0),
      water_source !== undefined ? (water_source || 'bore') : (cur.water_source || 'bore'),
      industry_type !== undefined ? (industry_type || null) : (cur.industry_type ?? null),
      client_type !== undefined ? client_type : cur.client_type,
      salespersonId,
      managerId,
      status !== undefined ? (status || 'active') : (cur.status || 'active'),
      notes !== undefined ? (notes || null) : (cur.notes ?? null),
    ];
    if (hasCloseReason) {
      setParts.push('close_reason=?');
      const nextStatus = status !== undefined ? (status || 'active') : (cur.status || 'active');
      const nextClosed = ['forcely_closed', 'forced_closed', 'closed'].includes(nextStatus);
      if (close_reason !== undefined) updateReplacements.push(close_reason || null);
      else if (nextClosed) updateReplacements.push(cur.close_reason ?? null);
      else updateReplacements.push(isAdmin ? null : (cur.close_reason ?? null));
    }
    setParts.push('updated_at=NOW()');
    updateReplacements.push(req.params.id);

    await sequelize.query(
      `UPDATE clients SET ${setParts.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      { replacements: updateReplacements, transaction: t }
    );

    if (ponds !== undefined && Array.isArray(ponds)) {
      const pondCols = await getPondDocCols();
      const activePondIds = [];
      for (const p of ponds) {
        const pondName = p.tank_number || p.pond_name;
        if (!pondName) continue;
        const tankSize = (p.tank_size !== undefined && p.tank_size !== '' && !isNaN(p.tank_size)) ? parseFloat(p.tank_size) : ((p.area_acres && !isNaN(p.area_acres)) ? parseFloat(p.area_acres) : null);
        const seedDate = (p.seed_date && String(p.seed_date).trim()) ? String(p.seed_date).trim().substring(0, 10) : null;
        const salinityVal = (p.salinity !== undefined && p.salinity !== '' && !isNaN(p.salinity)) ? parseFloat(p.salinity) : null;
        const stockQty = (p.stocking_quantity_lakhs !== undefined && p.stocking_quantity_lakhs !== '' && !isNaN(p.stocking_quantity_lakhs)) ? parseFloat(p.stocking_quantity_lakhs) : null;
        const latVal = (p.latitude !== undefined && p.latitude !== '' && !isNaN(p.latitude)) ? parseFloat(p.latitude) : null;
        const lngVal = (p.longitude !== undefined && p.longitude !== '' && !isNaN(p.longitude)) ? parseFloat(p.longitude) : null;

        const polyCoords = p.polygon_coordinates ? (typeof p.polygon_coordinates === 'string' ? p.polygon_coordinates : JSON.stringify(p.polygon_coordinates)) : null;

        const docVal = (p.doc !== undefined && p.doc !== '' && p.doc !== null && !isNaN(p.doc)) ? Math.max(0, parseInt(p.doc, 10)) : null;
        const docDateVal = docVal !== null ? new Date().toISOString().slice(0, 10) : null;
        const docParts = pondDocParts(pondCols.hasDoc, pondCols.hasDocDate, docVal, docDateVal);
        let docSet = '';
        let docRepls = [];
        if (pondCols.hasDoc) {
          docSet += ', doc=?';
          docRepls.push(docVal);
          if (pondCols.hasDocDate) {
            docSet += ', doc_date=CASE WHEN ? IS NULL THEN NULL WHEN doc = ? AND doc_date IS NOT NULL THEN doc_date ELSE ? END';
            docRepls.push(docVal, docVal, docVal, docDateVal);
          }
        }

        if (p.id) {
          activePondIds.push(p.id);
          await sequelize.query(
            `UPDATE ponds SET pond_name=?, tank_number=?, area=?, area_acres=?, tank_size=?,
             salinity=?, soil_type=?, hatchery_name=?, brooder=?, dealer_name=?, seed_date=?,
             stocking_quantity_lakhs=?, feed_type=?, culture_type=?, water_type=?, water_source=?,
             latitude=?, longitude=?, polygon_coordinates=?, gps_address=?, status=?, remarks=?${docSet},
             updated_at=NOW()
             WHERE id=? AND (client_id=? OR farmer_id=?) AND deleted_at IS NULL`,
            {
              replacements: [
                pondName, p.tank_number || pondName, tankSize, tankSize, tankSize,
                salinityVal,
                p.soil_type || null,
                p.hatchery_name || null,
                p.brooder || null,
                p.dealer_name || null,
                seedDate,
                stockQty,
                p.feed_type || null,
                p.culture_type || null, p.water_type || p.water_source || null, p.water_source || p.water_type || null,
                latVal, lngVal, polyCoords, p.gps_address || null,
                p.status || 'active', p.remarks || null,
                ...docRepls,
                p.id, req.params.id, req.params.id
              ],
              transaction: t,
            }
          );
        } else {
          const pondUuid = uuidv4();
          const [insertRes] = await sequelize.query(
            `INSERT INTO ponds (uuid, farmer_id, client_id, pond_name, tank_number, area, area_acres, tank_size,
             salinity, soil_type, hatchery_name, brooder, dealer_name, seed_date, stocking_quantity_lakhs, feed_type,
             culture_type, water_type, water_source, latitude, longitude, polygon_coordinates, gps_address, status, remarks, created_by${docParts.cols.length ? ', ' + docParts.cols.join(', ') : ''})
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${docParts.cols.length ? ', ' + docParts.cols.map(() => '?').join(', ') : ''})`,
            {
              replacements: [
                pondUuid, req.params.id, req.params.id, pondName, p.tank_number || pondName, tankSize, tankSize, tankSize,
                salinityVal,
                p.soil_type || null,
                p.hatchery_name || null,
                p.brooder || null,
                p.dealer_name || null,
                seedDate,
                stockQty,
                p.feed_type || null,
                p.culture_type || null, p.water_type || p.water_source || null, p.water_source || p.water_type || null,
                latVal, lngVal, polyCoords, p.gps_address || null,
                p.status || 'active', p.remarks || null, req.user.id,
                ...docParts.vals
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

    // Update in farmers table as well
    try {
      await sequelize.query(
        `INSERT INTO farmers (
          id, farmer_code, name, phone, alternate_phone, address, village, mandal, district, state,
          location, latitude, longitude, acres, total_acres, water_source, assigned_to, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          name = VALUES(name), phone = VALUES(phone), alternate_phone = VALUES(alternate_phone),
          address = VALUES(address), village = VALUES(village), mandal = VALUES(mandal),
          district = VALUES(district), state = VALUES(state), location = VALUES(location),
          latitude = VALUES(latitude), longitude = VALUES(longitude), acres = VALUES(acres),
          total_acres = VALUES(total_acres), water_source = VALUES(water_source),
          assigned_to = VALUES(assigned_to), status = VALUES(status), updated_at = NOW()`,
        {
          replacements: [
            String(req.params.id),
            `FARM-${req.params.id}`,
            company_name,
            mobile || null,
            alternate_mobile || null,
            address || null,
            village || null,
            mandal || area || null,
            district || city || null,
            state || null,
            gps_address || city || village || null,
            latitude ? parseFloat(latitude) : null,
            longitude ? parseFloat(longitude) : null,
            farm_extent_acres ? parseFloat(farm_extent_acres) : null,
            farm_extent_acres ? parseFloat(farm_extent_acres) : null,
            water_source || 'bore',
            salespersonId ? String(salespersonId) : null,
            status || 'active',
          ],
          transaction: t,
        }
      );
    } catch (farmerErr) {
      console.warn('Warning updating farmers table:', farmerErr.message);
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
    const opp_count = 0;
    const [[{ pending_followups }]] = await sequelize.query(
      "SELECT COUNT(*) as pending_followups FROM followups WHERE client_id = ? AND status IN ('pending','overdue') AND deleted_at IS NULL",
      { replacements: [clientId] }
    );

    let ponds = [];
    try {
      const docCols = await getPondDocCols();
      [ponds] = await sequelize.query(
        `SELECT *, ${pondAreaExpr(docCols)}, ${pondCurrentDocExpr(docCols, 'ponds', 'current_doc').replace(/\bponds\./g, '')}
         FROM ponds WHERE (client_id = ? OR farmer_id = ?) AND deleted_at IS NULL ORDER BY id ASC`,
        { replacements: [req.params.id, req.params.id] }
      );
    } catch (pondErr) {
      console.error('getClientProfile ponds lookup failed:', pondErr);
      ponds = [];
    }
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
    const docCols = await getPondDocCols();
    const [ponds] = await sequelize.query(
      `SELECT *, ${pondAreaExpr(docCols)}, ${pondCurrentDocExpr(docCols, 'ponds', 'current_doc').replace(/\bponds\./g, '')}
       FROM ponds WHERE (client_id = ? OR farmer_id = ?) AND deleted_at IS NULL ORDER BY id ASC`,
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
    hatchery_name, brooder, dealer_name, seed_date, stocking_quantity_lakhs, feed_type,
    culture_type, water_type, latitude, longitude, gps_address, status, remarks, doc, doc_date
  } = req.body;
  const finalName = tank_number || pond_name;
  if (!finalName) return sendError(res, 'Tank number or name is required', 400);

  try {
    const [clientRows] = await sequelize.query(
      'SELECT id, assigned_salesperson_id, created_by FROM clients WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      { replacements: [req.params.id] }
    );
    if (!clientRows[0]) return sendError(res, 'Farmer not found', 404);

    if (req.user.role === 'sales_executive' && clientRows[0].assigned_salesperson_id && clientRows[0].assigned_salesperson_id !== req.user.id && clientRows[0].created_by !== req.user.id) {
      return sendError(res, 'Access denied: not your client', 403);
    }

    const uuid = uuidv4();
    const finalSize = (tank_size !== undefined && tank_size !== '' && !isNaN(tank_size)) ? parseFloat(tank_size) : ((area_acres && !isNaN(area_acres)) ? parseFloat(area_acres) : null);
    const seedDate = (seed_date && String(seed_date).trim()) ? String(seed_date).trim().substring(0, 10) : null;
    const salinityVal = (salinity !== undefined && salinity !== '' && !isNaN(salinity)) ? parseFloat(salinity) : null;
    const stockQty = (stocking_quantity_lakhs !== undefined && stocking_quantity_lakhs !== '' && !isNaN(stocking_quantity_lakhs)) ? parseFloat(stocking_quantity_lakhs) : null;
    const latVal = (latitude !== undefined && latitude !== '' && !isNaN(latitude)) ? parseFloat(latitude) : null;
    const lngVal = (longitude !== undefined && longitude !== '' && !isNaN(longitude)) ? parseFloat(longitude) : null;
    const polyCoords = req.body.polygon_coordinates ? (typeof req.body.polygon_coordinates === 'string' ? req.body.polygon_coordinates : JSON.stringify(req.body.polygon_coordinates)) : null;
    const docVal = (doc !== undefined && doc !== '' && doc !== null && !isNaN(doc)) ? Math.max(0, parseInt(doc, 10)) : null;
    const docDateVal = docVal !== null ? (doc_date && String(doc_date).trim() ? String(doc_date).trim().substring(0, 10) : new Date().toISOString().slice(0, 10)) : null;
    const pondCols = await getPondDocCols();
    const docParts = pondDocParts(pondCols.hasDoc, pondCols.hasDocDate, docVal, docDateVal);

    const [result] = await sequelize.query(
      `INSERT INTO ponds (uuid, farmer_id, client_id, pond_name, tank_number, area, area_acres, tank_size,
       salinity, soil_type, hatchery_name, brooder, dealer_name, seed_date, stocking_quantity_lakhs, feed_type,
       culture_type, water_type, water_source, latitude, longitude, polygon_coordinates, gps_address, status, remarks, created_by${docParts.cols.length ? ', ' + docParts.cols.join(', ') : ''})
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${docParts.cols.length ? ', ' + docParts.cols.map(() => '?').join(', ') : ''})`,
      {
        replacements: [
          uuid, req.params.id, req.params.id, finalName, tank_number || finalName, finalSize, finalSize, finalSize,
          salinityVal,
          soil_type || null,
          hatchery_name || null,
          brooder || null,
          dealer_name || null,
          seedDate,
          stockQty,
          feed_type || null,
          culture_type || null, water_type || null, water_type || null,
          latVal, lngVal, polyCoords, gps_address || null, status || 'active', remarks || null, req.user.id,
          ...docParts.vals
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
    hatchery_name, brooder, dealer_name, seed_date, stocking_quantity_lakhs, feed_type,
    culture_type, water_type, latitude, longitude, gps_address, status, remarks, doc, doc_date
  } = req.body;
  try {
    const [clientRows] = await sequelize.query(
      'SELECT id, assigned_salesperson_id, created_by FROM clients WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      { replacements: [req.params.id] }
    );
    if (!clientRows[0]) return sendError(res, 'Farmer not found', 404);

    if (req.user.role === 'sales_executive' && clientRows[0].assigned_salesperson_id && clientRows[0].assigned_salesperson_id !== req.user.id && clientRows[0].created_by !== req.user.id) {
      return sendError(res, 'Access denied: not your client', 403);
    }

    const [existing] = await sequelize.query(
      'SELECT id FROM ponds WHERE id = ? AND (client_id = ? OR farmer_id = ?) AND deleted_at IS NULL LIMIT 1',
      { replacements: [req.params.pondId, req.params.id, req.params.id] }
    );
    if (!existing[0]) return sendError(res, 'Tank not found', 404);

    const finalName = tank_number || pond_name || existing[0].pond_name;
    const finalSize = (tank_size !== undefined && tank_size !== '' && !isNaN(tank_size)) ? parseFloat(tank_size) : ((area_acres && !isNaN(area_acres)) ? parseFloat(area_acres) : null);
    const seedDate = (seed_date && String(seed_date).trim()) ? String(seed_date).trim().substring(0, 10) : null;
    const salinityVal = (salinity !== undefined && salinity !== '' && !isNaN(salinity)) ? parseFloat(salinity) : null;
    const stockQty = (stocking_quantity_lakhs !== undefined && stocking_quantity_lakhs !== '' && !isNaN(stocking_quantity_lakhs)) ? parseFloat(stocking_quantity_lakhs) : null;
    const latVal = (latitude !== undefined && latitude !== '' && !isNaN(latitude)) ? parseFloat(latitude) : null;
    const lngVal = (longitude !== undefined && longitude !== '' && !isNaN(longitude)) ? parseFloat(longitude) : null;

    const docVal = (doc !== undefined && doc !== '' && doc !== null && !isNaN(doc)) ? Math.max(0, parseInt(doc, 10)) : null;
    const docDateVal = docVal !== null ? (doc_date && String(doc_date).trim() ? String(doc_date).trim().substring(0, 10) : new Date().toISOString().slice(0, 10)) : null;
    const pondCols = await getPondDocCols();
    let docSet = '';
    let docRepls = [];
    if (pondCols.hasDoc) {
      docSet += ', doc=?';
      docRepls.push(docVal);
      if (pondCols.hasDocDate) {
        docSet += ', doc_date=CASE WHEN ? IS NULL THEN NULL WHEN doc = ? AND doc_date IS NOT NULL THEN doc_date ELSE ? END';
        docRepls.push(docVal, docVal, docVal, docDateVal);
      }
    }

    await sequelize.query(
      `UPDATE ponds SET pond_name=?, tank_number=?, area=?, area_acres=?, tank_size=?,
       salinity=?, soil_type=?, hatchery_name=?, brooder=?, dealer_name=?, seed_date=?,
       stocking_quantity_lakhs=?, feed_type=?, culture_type=?, water_type=?, water_source=?,
       latitude=?, longitude=?, gps_address=?, status=?, remarks=?${docSet},
       updated_at=NOW()
       WHERE id=? AND (client_id=? OR farmer_id=?) AND deleted_at IS NULL`,
      {
        replacements: [
          finalName, tank_number || finalName, finalSize, finalSize, finalSize,
          salinityVal,
          soil_type || null,
          hatchery_name || null,
          brooder || null,
          dealer_name || null,
          seedDate,
          stockQty,
          feed_type || null,
          culture_type || null, water_type || null, water_type || null,
          latVal, lngVal, gps_address || null, status || 'active',
          remarks || null,
          ...docRepls,
          req.params.pondId, req.params.id, req.params.id
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
      'SELECT id, assigned_salesperson_id, created_by FROM clients WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      { replacements: [req.params.id] }
    );
    if (!clientRows[0]) return sendError(res, 'Farmer not found', 404);

    if (req.user.role === 'sales_executive' && clientRows[0].assigned_salesperson_id && clientRows[0].assigned_salesperson_id !== req.user.id && clientRows[0].created_by !== req.user.id) {
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

const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);
  if (isNaN(nLat1) || isNaN(nLon1) || isNaN(nLat2) || isNaN(nLon2)) return null;
  if (nLat1 === 0 && nLon1 === 0) return null;
  if (nLat2 === 0 && nLon2 === 0) return null;

  const R = 6371000;
  const dLat = ((nLat2 - nLat1) * Math.PI) / 180;
  const dLon = ((nLon2 - nLon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((nLat1 * Math.PI) / 180) *
      Math.cos((nLat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10;
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
                p.latitude, p.longitude, p.gps_address, p.status, p.remarks,
                v.id as latest_visit_id,
                v.visit_date as test_date,
                v.visit_time as test_time,
                v.latitude as test_latitude,
                v.longitude as test_longitude,
                v.water_quality,
                u.full_name as tested_by_name,
                r.name as tested_by_role,
                r.display_name as tested_by_role_name
         FROM ponds p
         LEFT JOIN (
           SELECT v1.*
           FROM visits v1
           INNER JOIN (
             SELECT MAX(id) as max_id
             FROM visits
             WHERE deleted_at IS NULL AND latitude IS NOT NULL AND (tank_id IS NOT NULL OR tank_number IS NOT NULL)
             GROUP BY client_id, COALESCE(tank_id, tank_number)
           ) v2 ON v1.id = v2.max_id
         ) v ON (v.tank_id = p.id OR (v.tank_number = p.pond_name AND v.client_id = p.client_id))
         LEFT JOIN users u ON v.salesperson_id = u.id
         LEFT JOIN roles r ON u.role_id = r.id
         WHERE (p.client_id IN (?) OR p.farmer_id IN (?)) AND p.deleted_at IS NULL
         ORDER BY p.pond_name ASC`,
        { replacements: [clientIds, clientIds] }
      );
      ponds = pondRows.map(p => {
        const dist = calculateDistanceMeters(p.latitude, p.longitude, p.test_latitude, p.test_longitude);
        return {
          ...p,
          test_distance_meters: dist,
          has_test: Boolean(p.latest_visit_id || dist != null),
        };
      });
    }

    return sendSuccess(res, 'Map locations fetched', { clients, ponds });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};


const listHarvestedTanks = async (req, res) => {
  try {
    const { search, district, culture_type, harvest_type } = req.query;

    let scopingClause = '';
    const replacements = [];

    if (req.user.role === 'sales_executive') {
      scopingClause = 'AND (c.assigned_salesperson_id = ? OR c.created_by = ? OR p.created_by = ?)';
      replacements.push(req.user.id, req.user.id, req.user.id);
    } else if (req.user.role === 'sales_manager') {
      scopingClause = 'AND (c.assigned_manager_id = ? OR c.assigned_salesperson_id = ? OR c.created_by = ? OR p.created_by = ? OR c.assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id = ?))';
      replacements.push(req.user.id, req.user.id, req.user.id, req.user.id, req.user.id);
    }

    let filterClause = '';
    if (search) {
      filterClause += ` AND (
        p.pond_name LIKE ? OR 
        p.tank_number LIKE ? OR 
        c.company_name LIKE ? OR 
        c.contact_person LIKE ? OR 
        c.mobile LIKE ? OR 
        c.village LIKE ? OR 
        c.district LIKE ?
      )`;
      const s = `%${search.trim()}%`;
      replacements.push(s, s, s, s, s, s, s);
    }

    if (district) {
      filterClause += ' AND c.district = ?';
      replacements.push(district);
    }

    if (culture_type) {
      filterClause += ' AND p.culture_type = ?';
      replacements.push(culture_type);
    }

    const docCols = await getPondDocCols();
    const [tanks] = await sequelize.query(`
      SELECT 
        p.*,
        ${pondAreaExpr(docCols, 'p')},
        c.id as client_id,
        c.company_name,
        c.contact_person,
        c.mobile as farmer_phone,
        c.village,
        c.mandal,
        c.district,
        c.city,
        c.state,
        c.pincode,
        c.address as farmer_address,
        u.full_name as salesperson_name,
        u.mobile as salesperson_phone
      FROM ponds p
      JOIN clients c ON (p.client_id = c.id OR p.farmer_id = c.id)
      LEFT JOIN users u ON (c.assigned_salesperson_id = u.id OR p.created_by = u.id)
      WHERE p.deleted_at IS NULL AND c.deleted_at IS NULL
        AND (
          p.status = 'harvested'
          OR p.status = 'inactive'
          OR EXISTS (
            SELECT 1 FROM visits v
            WHERE (v.tank_id = p.id OR (v.client_id = p.client_id AND v.tank_number = p.tank_number))
              AND v.deleted_at IS NULL
              AND v.harvest_details IS NOT NULL
              AND v.harvest_details != ''
              AND v.harvest_details != '{}'
              AND v.harvest_details != 'null'
          )
        )
        ${scopingClause}
        ${filterClause}
      ORDER BY p.updated_at DESC
    `, { replacements });

    for (const tank of tanks) {
      const [visits] = await sequelize.query(`
        SELECT 
          v.id, v.visit_date, v.visit_time, v.meeting_type, v.meeting_highlights, v.remarks,
          v.water_quality, v.feeding_details, v.medication_details, v.harvest_details,
          sp.full_name as salesperson_name, sp.mobile as salesperson_phone
        FROM visits v
        LEFT JOIN users sp ON v.salesperson_id = sp.id
        WHERE (v.tank_id = ? OR (v.client_id = ? AND v.tank_number = ?))
          AND v.deleted_at IS NULL
        ORDER BY v.visit_date DESC, v.created_at DESC
      `, {
        replacements: [tank.id, tank.client_id, tank.tank_number || tank.pond_name]
      });

      const parsedVisits = visits.map(v => {
        let wq = v.water_quality;
        let fd = v.feeding_details;
        let md = v.medication_details;
        let hd = v.harvest_details;
        try { if (typeof wq === 'string') wq = JSON.parse(wq); } catch(e){}
        try { if (typeof fd === 'string') fd = JSON.parse(fd); } catch(e){}
        try { if (typeof md === 'string') md = JSON.parse(md); } catch(e){}
        try { if (typeof hd === 'string') hd = JSON.parse(hd); } catch(e){}
        return { ...v, water_quality: wq, feeding_details: fd, medication_details: md, harvest_details: hd };
      });

      let finalHarvest = null;
      const allPartialHarvests = [];

      for (const v of parsedVisits) {
        const hd = v.harvest_details;
        if (hd) {
          if (!finalHarvest && hd.final_harvest && typeof hd.final_harvest === 'object') {
            const hasFinalData = Object.values(hd.final_harvest).some(val => val !== null && val !== undefined && val !== '');
            if (hasFinalData) {
              finalHarvest = {
                ...hd.final_harvest,
                date: hd.final_harvest.date || v.visit_date,
                visit_id: v.id,
              };
            }
          }

          if (Array.isArray(hd.partial_harvests) && hd.partial_harvests.length) {
            for (const p of hd.partial_harvests) {
              allPartialHarvests.push({
                ...p,
                date: p.date || v.visit_date,
                visit_id: v.id,
              });
            }
          } else if (hd.partial_harvest && typeof hd.partial_harvest === 'object') {
            const hasPartialData = Object.values(hd.partial_harvest).some(val => val !== null && val !== undefined && val !== '');
            if (hasPartialData) {
              allPartialHarvests.push({
                ...hd.partial_harvest,
                date: hd.partial_harvest.date || v.visit_date,
                visit_id: v.id,
              });
            }
          }
        }
      }

      // If tank status is marked harvested or inactive, but no visit recorded final_harvest, create fallback
      if (!finalHarvest && (tank.status === 'harvested' || tank.status === 'inactive')) {
        finalHarvest = {
          doc: tank.doc || '',
          abw: tank.abw || '',
          total_biomass: tank.total_biomass || '',
          count: tank.count || '',
          fcr: tank.fcr || '',
          survival_rate: tank.survival_rate || '',
          remarks: tank.remarks || 'Pond status set to harvested',
          date: tank.updated_at ? String(tank.updated_at).substring(0, 10) : ''
        };
      }

      const hasPartial = allPartialHarvests.length > 0;
      const hasFinal = !!finalHarvest || tank.status === 'harvested';

      tank.harvest_info = {
        final_harvest: finalHarvest,
        partial_harvests: allPartialHarvests,
      };
      tank.has_partial_harvest = hasPartial;
      tank.has_final_harvest = hasFinal;
      tank.visits_history = parsedVisits;
    }

    let resultTanks = tanks;
    if (harvest_type === 'partial') {
      resultTanks = tanks.filter(t => t.has_partial_harvest);
    } else if (harvest_type === 'final') {
      resultTanks = tanks.filter(t => t.has_final_harvest);
    }

    return sendSuccess(res, 'Harvested tanks fetched successfully', resultTanks);
  } catch (err) {
    console.error('Error fetching harvested tanks:', err);
    return sendError(res, err.message, 500);
  }
};


const getHarvestedFcrTanksData = async (query = {}, user = {}) => {
  const { doc, search, feed_type, status, match_mode } = query;

  let scopingClause = '';
  const replacements = [];

  if (user.role === 'sales_executive') {
    scopingClause = 'AND (c.assigned_salesperson_id = ? OR c.created_by = ? OR p.created_by = ?)';
    replacements.push(user.id, user.id, user.id);
  } else if (user.role === 'sales_manager') {
    scopingClause = 'AND (c.assigned_manager_id = ? OR c.assigned_salesperson_id = ? OR c.created_by = ? OR p.created_by = ? OR c.assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id = ?))';
    replacements.push(user.id, user.id, user.id, user.id, user.id);
  }

  let filterClause = '';
  if (search) {
    filterClause += ` AND (
      p.pond_name LIKE ? OR 
      p.tank_number LIKE ? OR 
      c.company_name LIKE ? OR 
      c.contact_person LIKE ? OR 
      c.mobile LIKE ? OR 
      c.village LIKE ? OR 
      c.district LIKE ?
    )`;
    const s = `%${search.trim()}%`;
    replacements.push(s, s, s, s, s, s, s);
  }

  if (feed_type) {
    filterClause += ' AND p.feed_type LIKE ?';
    replacements.push(`%${feed_type}%`);
  }

  if (status) {
    filterClause += ' AND p.status = ?';
    replacements.push(status);
  }

  const docCols = await getPondDocCols();
  // Only fetch candidate ponds that have been marked harvested or have visits with harvest details
  const [tanks] = await sequelize.query(`
    SELECT
      p.*,
      ${pondAreaExpr(docCols, 'p')},
      c.id as client_id,
      c.company_name,
      c.contact_person,
      c.mobile as farmer_phone,
      c.village,
      c.mandal,
      c.district,
      c.city,
      c.state,
      c.pincode,
      c.address as farmer_address,
      u.full_name as salesperson_name,
      u.mobile as salesperson_phone,
      ${pondCurrentDocExpr(docCols, 'p', 'current_doc')}
    FROM ponds p
    JOIN clients c ON (p.client_id = c.id OR p.farmer_id = c.id)
    LEFT JOIN users u ON (c.assigned_salesperson_id = u.id OR p.created_by = u.id)
    WHERE p.deleted_at IS NULL AND c.deleted_at IS NULL
      AND (
        p.status = 'harvested'
        OR p.status = 'inactive'
        OR EXISTS (
          SELECT 1 FROM visits v
          WHERE (v.tank_id = p.id OR (v.client_id = p.client_id AND v.tank_number = p.tank_number))
            AND v.deleted_at IS NULL
            AND v.harvest_details IS NOT NULL
            AND v.harvest_details != ''
            AND v.harvest_details != '{}'
            AND v.harvest_details != 'null'
        )
      )
      ${scopingClause}
      ${filterClause}
    ORDER BY p.updated_at DESC
  `, { replacements });

  const harvestedTanks = [];

  for (const tank of tanks) {
    const [visits] = await sequelize.query(`
      SELECT 
        v.id, v.visit_date, v.visit_time, v.meeting_highlights, v.remarks,
        v.water_quality, v.feeding_details, v.medication_details, v.harvest_details,
        sp.full_name as salesperson_name
      FROM visits v
      LEFT JOIN users sp ON v.salesperson_id = sp.id
      WHERE (v.tank_id = ? OR (v.client_id = ? AND v.tank_number = ?))
        AND v.deleted_at IS NULL
      ORDER BY v.visit_date DESC, v.created_at DESC
    `, {
      replacements: [tank.id, tank.client_id, tank.tank_number || tank.pond_name]
    });

    const parsedVisits = visits.map(v => {
      let wq = v.water_quality;
      let fd = v.feeding_details;
      let md = v.medication_details;
      let hd = v.harvest_details;
      try { if (typeof wq === 'string') wq = JSON.parse(wq); } catch(e){}
      try { if (typeof fd === 'string') fd = JSON.parse(fd); } catch(e){}
      try { if (typeof md === 'string') md = JSON.parse(md); } catch(e){}
      try { if (typeof hd === 'string') hd = JSON.parse(hd); } catch(e){}
      return { ...v, water_quality: wq, feeding_details: fd, medication_details: md, harvest_details: hd };
    });

    let finalHarvest = null;
    let latestFeeding = null;
    const recordedDocs = [];

    for (const v of parsedVisits) {
      const hd = v.harvest_details;
      if (hd) {
        if (!finalHarvest && hd.final_harvest && typeof hd.final_harvest === 'object') {
          const hasFinalData = Object.values(hd.final_harvest).some(val => val !== null && val !== undefined && val !== '');
          if (hasFinalData) {
            finalHarvest = {
              ...hd.final_harvest,
              fcr: hd.final_harvest.fcr || hd.derived?.fcr || '',
              total_biomass: hd.final_harvest.harvested_biomass || hd.final_harvest.total_biomass || hd.derived?.total_biomass || '',
              survival_rate: hd.final_harvest.survival_rate || hd.derived?.survival_percentage || '',
              date: hd.final_harvest.date || v.visit_date,
              visit_id: v.id,
            };
          }
        }
      }

      if (v.feeding_details) {
        if (!latestFeeding) latestFeeding = v.feeding_details;
        if (v.feeding_details.doc !== undefined && v.feeding_details.doc !== null) {
          recordedDocs.push(parseInt(v.feeding_details.doc, 10));
        }
      }
      if (v.water_quality && v.water_quality.doc !== undefined && v.water_quality.doc !== null) {
        recordedDocs.push(parseInt(v.water_quality.doc, 10));
      }
      if (hd?.final_harvest?.doc !== undefined && hd?.final_harvest?.doc !== null) {
        recordedDocs.push(parseInt(hd.final_harvest.doc, 10));
      }
    }

    // If tank status is marked harvested or inactive, but no visit recorded final_harvest, create fallback
    if (!finalHarvest && (tank.status === 'harvested' || tank.status === 'inactive')) {
      finalHarvest = {
        doc: tank.doc || '',
        abw: tank.abw || '',
        total_biomass: tank.total_biomass || '',
        count: tank.count || '',
        fcr: tank.fcr || '',
        survival_rate: tank.survival_rate || '',
        remarks: tank.remarks || 'Pond status set to harvested',
        date: tank.updated_at ? String(tank.updated_at).substring(0, 10) : ''
      };
    }

    // Must have completed final harvest to appear in FCR tracker
    const hasFinal = Boolean(
      (finalHarvest && Object.values(finalHarvest).some(val => val !== null && val !== undefined && val !== '')) ||
      tank.status === 'harvested'
    );

    if (!hasFinal) {
      continue;
    }

    tank.final_harvest = finalHarvest;
    tank.harvest_info = {
      final_harvest: finalHarvest,
    };
    tank.has_final_harvest = true;
    tank.latest_feeding = latestFeeding;
    tank.recorded_docs = Array.from(new Set(recordedDocs.filter(d => !isNaN(d))));
    tank.visits = parsedVisits;

    // Normalized metrics at final harvest
    tank.fcr = finalHarvest?.fcr || tank.fcr || latestFeeding?.fcr || null;
    tank.harvest_doc = finalHarvest?.doc || tank.doc || tank.current_doc;
    tank.abw = finalHarvest?.abw || tank.abw || latestFeeding?.abw || null;
    tank.total_biomass = finalHarvest?.total_biomass || finalHarvest?.harvested_biomass || tank.total_biomass || null;
    tank.harvest_date = finalHarvest?.date || null;
    tank.survival_rate = finalHarvest?.survival_rate || tank.survival_rate || null;

    harvestedTanks.push(tank);
  }

  let resultTanks = harvestedTanks;
  if (doc !== undefined && doc !== '' && !isNaN(doc)) {
    const targetDoc = parseInt(doc, 10);
    resultTanks = harvestedTanks.filter(t => {
      const hDoc = parseInt(t.harvest_doc, 10);
      const cDoc = parseInt(t.current_doc, 10);
      const pDoc = parseInt(t.doc, 10);
      const hasVisitDoc = t.recorded_docs?.includes(targetDoc);
      if (match_mode === 'range') {
        return Math.abs(hDoc - targetDoc) <= 3 || Math.abs(cDoc - targetDoc) <= 3 || Math.abs(pDoc - targetDoc) <= 3 || hasVisitDoc;
      }
      return hDoc === targetDoc || cDoc === targetDoc || pDoc === targetDoc || hasVisitDoc;
    });
  }

  return resultTanks;
};

const listFcrTanks = async (req, res) => {
  try {
    const resultTanks = await getHarvestedFcrTanksData(req.query, req.user);
    return sendSuccess(res, 'FCR tanks fetched successfully', resultTanks);
  } catch (err) {
    console.error('Error fetching FCR tanks:', err);
    return sendError(res, err.message, 500);
  }
};

const exportFcrTanks = async (req, res) => {
  try {
    const tanks = await getHarvestedFcrTanksData(req.query, req.user);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('FCR Report');

    ws.columns = [
      { header: 'Tank Name / No.', key: 'tank_number', width: 20 },
      { header: 'Farmer / Company', key: 'company_name', width: 25 },
      { header: 'Contact Person', key: 'contact_person', width: 20 },
      { header: 'Mobile', key: 'farmer_phone', width: 16 },
      { header: 'Village', key: 'village', width: 18 },
      { header: 'District', key: 'district', width: 18 },
      { header: 'Harvest DOC', key: 'harvest_doc', width: 14 },
      { header: 'Final FCR', key: 'fcr', width: 12 },
      { header: 'Final ABW (g)', key: 'abw', width: 14 },
      { header: 'Biomass (kg)', key: 'total_biomass', width: 16 },
      { header: 'Survival Rate', key: 'survival_rate', width: 14 },
      { header: 'Harvest Date', key: 'harvest_date', width: 15 },
      { header: 'Area (Acres)', key: 'area', width: 14 },
      { header: 'Seed Date', key: 'seed_date', width: 15 },
      { header: 'Stocking (Lakhs)', key: 'stocking', width: 16 },
      { header: 'Feed Type', key: 'feed_type', width: 18 },
      { header: 'Technical Executive', key: 'salesperson_name', width: 22 },
    ];

    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0F2FE' }
    };

    tanks.forEach(t => {
      const fh = t.final_harvest || {};
      const area = Number(t.area_acres || t.area || 0).toFixed(2);
      const survival = t.survival_rate ? (String(t.survival_rate).includes('%') ? t.survival_rate : `${t.survival_rate}%`) : '';
      ws.addRow({
        tank_number: t.tank_number || t.pond_name || `Tank #${t.id}`,
        company_name: t.company_name || '',
        contact_person: t.contact_person || '',
        farmer_phone: t.farmer_phone || '',
        village: t.village || '',
        district: t.district || '',
        harvest_doc: t.harvest_doc || fh.doc || '',
        fcr: t.fcr || '',
        abw: t.abw || '',
        total_biomass: t.total_biomass || '',
        survival_rate: survival,
        harvest_date: t.harvest_date ? String(t.harvest_date).slice(0, 10) : '',
        area: area,
        seed_date: t.seed_date ? String(t.seed_date).slice(0, 10) : '',
        stocking: t.stocking_quantity_lakhs || '',
        feed_type: t.feed_type || '',
        salesperson_name: t.salesperson_name || '',
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=fcr-report.xlsx');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error exporting FCR tanks:', err);
    return sendError(res, err.message, 500);
  }
};

const listDealers = async (req, res) => {
  try {
    const { search, region, area } = req.query;

    let scopingClause = '';
    const replacements = [];

    if (req.user.role === 'sales_executive') {
      scopingClause = 'AND (c.assigned_salesperson_id = ? OR c.created_by = ? OR p.created_by = ?)';
      replacements.push(req.user.id, req.user.id, req.user.id);
    } else if (req.user.role === 'sales_manager') {
      scopingClause = 'AND (c.assigned_manager_id = ? OR c.assigned_salesperson_id = ? OR c.created_by = ? OR p.created_by = ? OR c.assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id = ?))';
      replacements.push(req.user.id, req.user.id, req.user.id, req.user.id, req.user.id);
    }

    let searchClause = '';
    if (search && search.trim()) {
      searchClause = 'AND (p.dealer_name LIKE ? OR c.company_name LIKE ? OR c.village LIKE ? OR c.district LIKE ? OR u.region LIKE ? OR u.area LIKE ?)';
      const s = `%${search.trim()}%`;
      replacements.push(s, s, s, s, s, s);
    }

    const docCols = await getPondDocCols();

    // Query all ponds that have a dealer_name
    const [rows] = await sequelize.query(`
      SELECT 
        TRIM(p.dealer_name) as dealer_name,
        p.id as pond_id,
        p.pond_name,
        p.tank_number,
        ${pondAreaExpr(docCols, 'p')},
        c.id as client_id,
        c.company_name,
        c.contact_person,
        c.mobile,
        c.village,
        c.mandal,
        c.district,
        c.city,
        c.state,
        u.id as salesperson_id,
        u.full_name as salesperson_name,
        u.region as salesperson_region,
        u.area as salesperson_area,
        m.region as manager_region,
        m.area as manager_area
      FROM ponds p
      JOIN clients c ON (p.client_id = c.id OR p.farmer_id = c.id)
      LEFT JOIN users u ON (c.assigned_salesperson_id = u.id OR p.created_by = u.id)
      LEFT JOIN users m ON u.manager_id = m.id
      WHERE p.dealer_name IS NOT NULL 
        AND TRIM(p.dealer_name) != ''
        AND p.deleted_at IS NULL 
        AND c.deleted_at IS NULL
        ${scopingClause}
        ${searchClause}
      ORDER BY p.dealer_name ASC, c.company_name ASC
    `, { replacements });

    const dealersMap = new Map();

    for (const r of rows) {
      const name = r.dealer_name;
      if (!dealersMap.has(name)) {
        dealersMap.set(name, {
          dealer_name: name,
          tank_count: 0,
          farmer_count: 0,
          total_acres: 0,
          regions: new Set(),
          areas: new Set(),
          districts: new Set(),
          villages: new Set(),
          farmersMap: new Map(),
          salespersons: new Set(),
        });
      }

      const d = dealersMap.get(name);
      d.tank_count += 1;
      const acres = parseFloat(r.area_acres || 0);
      if (!isNaN(acres)) d.total_acres += acres;

      const rowRegion = (r.salesperson_region || r.manager_region || r.district || '').trim();
      const rowArea = (r.salesperson_area || r.manager_area || r.mandal || r.village || '').trim();

      if (rowRegion) d.regions.add(rowRegion);
      if (rowArea) d.areas.add(rowArea);
      if (r.district) d.districts.add(r.district.trim());
      if (r.village) d.villages.add(r.village.trim());
      if (r.salesperson_name) d.salespersons.add(r.salesperson_name.trim());

      if (!d.farmersMap.has(r.client_id)) {
        d.farmersMap.set(r.client_id, {
          client_id: r.client_id,
          company_name: r.company_name,
          contact_person: r.contact_person,
          mobile: r.mobile,
          village: r.village,
          mandal: r.mandal,
          district: r.district,
          region: rowRegion,
          area: rowArea,
          salesperson_name: r.salesperson_name,
          tanks: [],
          total_acres: 0,
        });
      }

      const f = d.farmersMap.get(r.client_id);
      f.tanks.push({
        id: r.pond_id,
        name: r.tank_number || r.pond_name || `Tank #${r.pond_id}`,
        area_acres: acres,
      });
      f.total_acres += acres;
    }

    let dealersList = Array.from(dealersMap.values()).map(d => ({
      dealer_name: d.dealer_name,
      tank_count: d.tank_count,
      farmer_count: d.farmersMap.size,
      total_acres: parseFloat(d.total_acres.toFixed(2)),
      regions: Array.from(d.regions).filter(Boolean),
      areas: Array.from(d.areas).filter(Boolean),
      districts: Array.from(d.districts).filter(Boolean),
      villages: Array.from(d.villages).filter(Boolean),
      salespersons: Array.from(d.salespersons).filter(Boolean),
      farmers: Array.from(d.farmersMap.values()).map(f => ({
        ...f,
        total_acres: parseFloat(f.total_acres.toFixed(2)),
      })),
    }));

    if (region && region.trim()) {
      const targetRegion = region.trim().toLowerCase();
      dealersList = dealersList.filter(d =>
        d.regions.some(r => r.toLowerCase() === targetRegion) ||
        d.districts.some(dist => dist.toLowerCase() === targetRegion)
      );
    }

    if (area && area.trim()) {
      const targetArea = area.trim().toLowerCase();
      dealersList = dealersList.filter(d =>
        d.areas.some(a => a.toLowerCase() === targetArea) ||
        d.villages.some(v => v.toLowerCase() === targetArea)
      );
    }

    dealersList.sort((a, b) => b.tank_count - a.tank_count || a.dealer_name.localeCompare(b.dealer_name));

    return sendSuccess(res, 'Dealers fetched successfully', dealersList);
  } catch (err) {
    console.error('Error fetching dealers:', err);
    return sendError(res, err.message, 500);
  }
};

module.exports = {
  listDealers,

  listFcrTanks,
  exportFcrTanks,
  listHarvestedTanks,
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
