const sequelize = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { getPagination, buildMeta } = require('../utils/pagination');

const listAllTanks = async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const { status, search, view } = req.query;

  try {
    let whereConditions = [];
    const replacements = [];

    if (status && status !== 'all') {
      whereConditions.push('LOWER(t.status) = ?');
      replacements.push(status.toLowerCase());
    }

    if (view === 'abw') {
      whereConditions.push('t.abw > 0');
    }

    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      whereConditions.push('(t.tank_name LIKE ? OR t.tank_number LIKE ? OR t.farmer_name LIKE ? OR t.farmer_mobile LIKE ? OR t.village LIKE ? OR t.area LIKE ? OR t.city LIKE ?)');
      replacements.push(s, s, s, s, s, s, s);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const baseSql = `
      SELECT * FROM (
        SELECT 
          p.id,
          p.uuid,
          p.pond_name as tank_name,
          COALESCE(p.tank_number, p.pond_name) as tank_number,
          COALESCE(p.tank_size, p.area_acres, p.area) as size_acres,
          p.salinity,
          p.soil_type,
          p.hatchery_name,
          p.brooder,
          p.seed_date,
          p.stocking_quantity_lakhs,
          p.feed_type,
          p.culture_type,
          p.water_source as water_type,
          LOWER(p.status) as status,
          p.doc,
          p.remarks,
          p.latitude,
          p.longitude,
          p.gps_address,
          COALESCE(p.abw, 0) as abw,
          p.created_at,
          c.id as farmer_id,
          c.company_name as farmer_name,
          c.mobile as farmer_mobile,
          c.village,
          c.area,
          c.city,
          c.state
        FROM ponds p
        LEFT JOIN clients c ON (p.client_id = c.id OR p.farmer_id = c.id)
        WHERE p.deleted_at IS NULL

        UNION ALL

        SELECT
          t.id,
          t.id as uuid,
          t.name as tank_name,
          t.name as tank_number,
          COALESCE(t.area_acres, CAST(NULLIF(t.acres, '') AS DECIMAL(10,2)), CAST(NULLIF(t.size, '') AS DECIMAL(10,2))) as size_acres,
          CAST(NULLIF(t.salinity, '') AS DECIMAL(10,2)) as salinity,
          NULL as soil_type,
          NULL as hatchery_name,
          NULL as brooder,
          t.stocking_date as seed_date,
          NULL as stocking_quantity_lakhs,
          NULL as feed_type,
          t.culture_type,
          t.water_source as water_type,
          LOWER(t.status) as status,
          t.doc,
          NULL as remarks,
          NULL as latitude,
          NULL as longitude,
          NULL as gps_address,
          COALESCE(CAST(NULLIF(t.abw, '') AS DECIMAL(10,2)), 0) as abw,
          t.created_at,
          c.id as farmer_id,
          COALESCE(c.company_name, f.name, 'Unknown') as farmer_name,
          COALESCE(c.mobile, f.phone, '—') as farmer_mobile,
          COALESCE(c.village, f.village, '—') as village,
          COALESCE(c.area, f.mandal, '—') as area,
          COALESCE(c.city, f.district, '—') as city,
          COALESCE(c.state, f.state, '—') as state
        FROM tanks t
        LEFT JOIN clients c ON c.id = CAST(NULLIF(t.farmer_id, '') AS UNSIGNED)
        LEFT JOIN farmers f ON f.id = CAST(NULLIF(t.farmer_id, '') AS UNSIGNED)
      ) t
      ${whereClause}
    `;

    const countSql = `SELECT COUNT(*) as total FROM (${baseSql}) as count_tbl`;
    const [[{ total }]] = await sequelize.query(countSql, { replacements });

    const orderClause = view === 'abw' ? 'ORDER BY t.abw DESC, t.created_at DESC' : 'ORDER BY t.created_at DESC, t.id DESC';
    const dataSql = `${baseSql} ${orderClause} LIMIT ? OFFSET ?`;
    const [tanks] = await sequelize.query(dataSql, { replacements: [...replacements, limit, offset] });

    // Aggregate stats
    const statsSql = `
      SELECT 
        COUNT(*) as total_tanks,
        COALESCE(SUM(CASE WHEN LOWER(t.status) = 'active' THEN 1 ELSE 0 END), 0) as active_tanks,
        COALESCE(SUM(CASE WHEN LOWER(t.status) = 'harvested' THEN 1 ELSE 0 END), 0) as harvested_tanks,
        COALESCE(ROUND(AVG(CASE WHEN t.abw > 0 THEN t.abw ELSE NULL END), 2), 0) as avg_abw,
        COALESCE(ROUND(SUM(t.size_acres), 2), 0) as total_acres
      FROM (
        SELECT 
          p.id,
          COALESCE(p.tank_size, p.area_acres, p.area) as size_acres,
          LOWER(p.status) as status,
          COALESCE(p.abw, 0) as abw
        FROM ponds p WHERE p.deleted_at IS NULL
        UNION ALL
        SELECT
          t.id,
          COALESCE(t.area_acres, CAST(NULLIF(t.acres, '') AS DECIMAL(10,2))) as size_acres,
          LOWER(t.status) as status,
          COALESCE(CAST(NULLIF(t.abw, '') AS DECIMAL(10,2)), 0) as abw
        FROM tanks t
      ) t
    `;
    const [statsRows] = await sequelize.query(statsSql);
    const stats = statsRows[0] || { total_tanks: 0, active_tanks: 0, harvested_tanks: 0, avg_abw: 0, total_acres: 0 };

    return sendPaginated(res, 'Tanks fetched', tanks, { ...buildMeta(total, page, limit), stats });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

module.exports = { listAllTanks };
