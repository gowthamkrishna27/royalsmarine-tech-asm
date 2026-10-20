const ExcelJS = require('exceljs');
const sequelize = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');

const salespersonVisitReport = async (req, res) => {
  const { from_date, to_date, salesperson_id } = req.query;
  let where = 'v.deleted_at IS NULL';
  const replacements = [];
  if (from_date) { where += ' AND v.visit_date >= ?'; replacements.push(from_date); }
  if (to_date) { where += ' AND v.visit_date <= ?'; replacements.push(to_date); }

  // Data isolation: Sales executive can only see their own reports
  if (req.user.role === 'sales_executive') {
    where += ' AND v.salesperson_id = ?';
    replacements.push(req.user.id);
  } else if (req.user.role === 'sales_manager') {
    if (salesperson_id) {
      where += ' AND v.salesperson_id = ? AND (v.salesperson_id = ? OR v.salesperson_id IN (SELECT id FROM users WHERE manager_id = ?))';
      replacements.push(salesperson_id, req.user.id, req.user.id);
    } else {
      where += ' AND (v.salesperson_id = ? OR v.salesperson_id IN (SELECT id FROM users WHERE manager_id = ?))';
      replacements.push(req.user.id, req.user.id);
    }
  } else if (salesperson_id) {
    where += ' AND v.salesperson_id = ?';
    replacements.push(salesperson_id);
  }

  try {
    const [data] = await sequelize.query(
      `SELECT u.full_name as salesperson, COUNT(v.id) as total_visits
       FROM visits v JOIN users u ON v.salesperson_id=u.id
       WHERE ${where} GROUP BY u.id, u.full_name ORDER BY total_visits DESC`,
      { replacements }
    );
    return sendSuccess(res, 'Salesperson visit report', data);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};


const followupReport = async (req, res) => {
  const { from_date, to_date, salesperson_id, status } = req.query;
  let where = 'f.deleted_at IS NULL';
  const replacements = [];
  if (from_date) { where += ' AND f.followup_date >= ?'; replacements.push(from_date); }
  if (to_date) { where += ' AND f.followup_date <= ?'; replacements.push(to_date); }
  if (status) { where += ' AND f.status = ?'; replacements.push(status); }

  // Data isolation: Sales executive can only see their own followups
  if (req.user.role === 'sales_executive') {
    where += ' AND f.assigned_salesperson_id = ?';
    replacements.push(req.user.id);
  } else if (req.user.role === 'sales_manager') {
    if (salesperson_id) {
      where += ' AND f.assigned_salesperson_id = ? AND (f.assigned_salesperson_id = ? OR f.assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id = ?))';
      replacements.push(salesperson_id, req.user.id, req.user.id);
    } else {
      where += ' AND (f.assigned_salesperson_id = ? OR f.assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id = ?))';
      replacements.push(req.user.id, req.user.id);
    }
  } else if (salesperson_id) {
    where += ' AND f.assigned_salesperson_id = ?';
    replacements.push(salesperson_id);
  }

  try {
    const [data] = await sequelize.query(
      `SELECT u.full_name as salesperson,
              SUM(CASE WHEN f.status='completed' THEN 1 ELSE 0 END) as completed,
              SUM(CASE WHEN f.status='overdue' THEN 1 ELSE 0 END) as overdue,
              SUM(CASE WHEN f.status='pending' THEN 1 ELSE 0 END) as pending,
              COUNT(*) as total
       FROM followups f JOIN users u ON f.assigned_salesperson_id=u.id
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
  const { type, from_date, to_date } = req.query;
  try {
    let data = [], headers = [], filename = 'report.xlsx';

    if (type === 'visits') {
      headers = ['Date', 'Salesperson', 'Farmer', 'City', 'Type', 'Outcome', 'Status'];
      let where = 'v.deleted_at IS NULL';
      const replacements = [];
      if (from_date) { where += ' AND v.visit_date >= ?'; replacements.push(from_date); }
      if (to_date) { where += ' AND v.visit_date <= ?'; replacements.push(to_date); }

      if (req.user.role === 'sales_executive') {
        where += ' AND v.salesperson_id = ?';
        replacements.push(req.user.id);
      } else if (req.user.role === 'sales_manager') {
        where += ' AND (v.salesperson_id = ? OR v.salesperson_id IN (SELECT id FROM users WHERE manager_id = ?))';
        replacements.push(req.user.id, req.user.id);
      }

      const [rows] = await sequelize.query(
        `SELECT v.visit_date, sp.full_name, c.company_name, c.city, v.meeting_type, v.visit_outcome, v.approval_status
         FROM visits v JOIN clients c ON v.client_id=c.id JOIN users sp ON v.salesperson_id=sp.id
         WHERE ${where} ORDER BY v.visit_date DESC`,
        { replacements }
      );
      data = rows;
      filename = 'visit-report.xlsx';
    } else {
      headers = ['Followup Title', 'Farmer', 'Salesperson', 'Date', 'Status'];
      let where = 'f.deleted_at IS NULL';
      const replacements = [];
      if (from_date) { where += ' AND f.followup_date >= ?'; replacements.push(from_date); }
      if (to_date) { where += ' AND f.followup_date <= ?'; replacements.push(to_date); }

      if (req.user.role === 'sales_executive') {
        where += ' AND f.assigned_salesperson_id = ?';
        replacements.push(req.user.id);
      } else if (req.user.role === 'sales_manager') {
        where += ' AND (f.assigned_salesperson_id = ? OR f.assigned_salesperson_id IN (SELECT id FROM users WHERE manager_id = ?))';
        replacements.push(req.user.id, req.user.id);
      }

      const [rows] = await sequelize.query(
        `SELECT f.title, c.company_name, sp.full_name, f.followup_date, f.status
         FROM followups f JOIN clients c ON f.client_id=c.id JOIN users sp ON f.assigned_salesperson_id=sp.id
         WHERE ${where} ORDER BY f.followup_date DESC`,
        { replacements }
      );
      data = rows;
      filename = 'followup-report.xlsx';
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Report');
    ws.addRow(headers);
    data.forEach(row => ws.addRow(Object.values(row)));

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
