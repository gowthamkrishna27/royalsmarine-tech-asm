const ExcelJS = require('exceljs');
const sequelize = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');

const salespersonVisitReport = async (req, res) => {
  const { from_date, to_date, salesperson_id } = req.query;
  let where = 'v.deleted_at IS NULL';
  const replacements = [];
  if (from_date) { where += ' AND v.visit_date >= ?'; replacements.push(from_date); }
  if (to_date) { where += ' AND v.visit_date <= ?'; replacements.push(to_date); }
  if (salesperson_id) { where += ' AND v.salesperson_id = ?'; replacements.push(salesperson_id); }

  try {
    const [data] = await sequelize.query(
      `SELECT u.full_name as salesperson, COUNT(v.id) as total_visits,
              SUM(CASE WHEN v.approval_status='approved' THEN 1 ELSE 0 END) as approved,
              SUM(CASE WHEN v.approval_status='pending' THEN 1 ELSE 0 END) as pending
       FROM visits v JOIN users u ON v.salesperson_id=u.id
       WHERE ${where} GROUP BY u.id, u.full_name ORDER BY total_visits DESC`,
      { replacements }
    );
    return sendSuccess(res, 'Salesperson visit report', data);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const opportunityReport = async (req, res) => {
  const { from_date, to_date, salesperson_id, brand_id, stage } = req.query;
  let where = 'o.deleted_at IS NULL';
  const replacements = [];
  if (from_date) { where += ' AND o.created_at >= ?'; replacements.push(from_date); }
  if (to_date) { where += ' AND o.created_at <= ?'; replacements.push(to_date); }
  if (salesperson_id) { where += ' AND o.assigned_salesperson_id = ?'; replacements.push(salesperson_id); }
  if (brand_id) { where += ' AND o.brand_id = ?'; replacements.push(brand_id); }
  if (stage) { where += ' AND o.current_stage = ?'; replacements.push(stage); }

  try {
    const [summary] = await sequelize.query(
      `SELECT o.current_stage, COUNT(*) as count, COALESCE(SUM(estimated_value),0) as total_value
       FROM opportunities o WHERE ${where} GROUP BY o.current_stage`,
      { replacements }
    );
    const [brandwise] = await sequelize.query(
      `SELECT b.name as brand, COUNT(o.id) as count, COALESCE(SUM(o.estimated_value),0) as value,
              SUM(CASE WHEN o.current_stage='won' THEN 1 ELSE 0 END) as won,
              SUM(CASE WHEN o.current_stage='lost' THEN 1 ELSE 0 END) as lost
       FROM opportunities o LEFT JOIN brands b ON o.brand_id=b.id
       WHERE ${where} GROUP BY b.id, b.name ORDER BY value DESC`,
      { replacements }
    );
    return sendSuccess(res, 'Opportunity report', { summary, brandwise });
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
  if (salesperson_id) { where += ' AND f.assigned_salesperson_id = ?'; replacements.push(salesperson_id); }
  if (status) { where += ' AND f.status = ?'; replacements.push(status); }

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
  const { month, year, client_id } = req.query;
  const m = month || new Date().getMonth() + 1;
  const y = year || new Date().getFullYear();

  try {
    const [clientBilling] = await sequelize.query(
      `SELECT c.company_name, COALESCE(curr.total,0) as current_month, COALESCE(prev.total,0) as prev_month,
              ROUND(((COALESCE(curr.total,0) - COALESCE(prev.total,0)) / NULLIF(COALESCE(prev.total,0),0)) * 100, 2) as growth_pct
       FROM clients c
       LEFT JOIN (SELECT client_id, SUM(invoice_amount) as total FROM billing_records WHERE MONTH(invoice_date)=? AND YEAR(invoice_date)=? GROUP BY client_id) curr ON curr.client_id=c.id
       LEFT JOIN (SELECT client_id, SUM(invoice_amount) as total FROM billing_records WHERE MONTH(invoice_date)=? AND YEAR(invoice_date)=? GROUP BY client_id) prev ON prev.client_id=c.id
       WHERE c.deleted_at IS NULL ${client_id ? 'AND c.id=?' : ''} ORDER BY current_month DESC LIMIT 50`,
      { replacements: client_id ? [m, y, m - 1 || 12, m === 1 ? y - 1 : y, client_id] : [m, y, m - 1 || 12, m === 1 ? y - 1 : y] }
    );
    const [overduePayments] = await sequelize.query(
      `SELECT c.company_name, br.invoice_number, br.invoice_amount, br.outstanding_amount, br.due_date,
              DATEDIFF(CURDATE(), br.due_date) as days_overdue
       FROM billing_records br JOIN clients c ON br.client_id=c.id
       WHERE br.payment_status IN ('unpaid','partial') AND br.due_date < CURDATE()
       ORDER BY days_overdue DESC LIMIT 50`
    );
    return sendSuccess(res, 'Billing report', { clientBilling, overduePayments });
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

const exportReport = async (req, res) => {
  const { type, from_date, to_date } = req.query;
  try {
    let data = [], headers = [], filename = 'report.xlsx';

    if (type === 'visits') {
      headers = ['Date', 'Salesperson', 'Client', 'City', 'Type', 'Person Met', 'Outcome', 'Status'];
      const [rows] = await sequelize.query(
        `SELECT v.visit_date, sp.full_name, c.company_name, c.city, v.meeting_type, v.person_met, v.visit_outcome, v.approval_status
         FROM visits v JOIN clients c ON v.client_id=c.id JOIN users sp ON v.salesperson_id=sp.id
         WHERE v.deleted_at IS NULL ${from_date ? 'AND v.visit_date>=?' : ''} ${to_date ? 'AND v.visit_date<=?' : ''} ORDER BY v.visit_date DESC`,
        { replacements: [from_date, to_date].filter(Boolean) }
      );
      data = rows;
      filename = 'visit-report.xlsx';
    } else if (type === 'opportunities') {
      headers = ['Title', 'Client', 'Salesperson', 'Brand', 'Stage', 'Value', 'Closing Date'];
      const [rows] = await sequelize.query(
        `SELECT o.title, c.company_name, sp.full_name, b.name, o.current_stage, o.estimated_value, o.expected_closing_date
         FROM opportunities o JOIN clients c ON o.client_id=c.id JOIN users sp ON o.assigned_salesperson_id=sp.id LEFT JOIN brands b ON o.brand_id=b.id
         WHERE o.deleted_at IS NULL ORDER BY o.expected_closing_date ASC`,
        { replacements: [] }
      );
      data = rows;
      filename = 'opportunity-report.xlsx';
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
  let where = 'o.deleted_at IS NULL';
  const replacements = [];
  if (from_date) { where += ' AND o.created_at >= ?'; replacements.push(from_date); }
  if (to_date)   { where += ' AND o.created_at <= ?'; replacements.push(to_date); }
  if (brand_id)  { where += ' AND o.brand_id = ?';    replacements.push(brand_id); }
  const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  try {
    const [data] = await sequelize.query(
      `SELECT b.id as brand_id, b.name as brand_name,
         COUNT(o.id) as total_opportunities,
         COALESCE(SUM(o.estimated_value), 0) as pipeline_value,
         SUM(CASE WHEN o.current_stage='won' THEN 1 ELSE 0 END) as won_count,
         COALESCE(SUM(CASE WHEN o.current_stage='won' THEN o.estimated_value ELSE 0 END), 0) as won_value,
         SUM(CASE WHEN o.current_stage='lost' THEN 1 ELSE 0 END) as lost_count,
         SUM(CASE WHEN o.current_stage IN ('negotiation','finalization') THEN 1 ELSE 0 END) as hot_leads,
         SUM(CASE WHEN o.current_stage IN ('qualified','evaluation') THEN 1 ELSE 0 END) as warm_leads,
         COUNT(DISTINCT CASE WHEN c.created_at >= ? THEN c.id ELSE NULL END) as new_customers_this_month
       FROM opportunities o
       LEFT JOIN brands b ON o.brand_id = b.id
       LEFT JOIN clients c ON o.client_id = c.id
       WHERE ${where}
       GROUP BY b.id, b.name
       ORDER BY pipeline_value DESC`,
      { replacements: [thisMonthStart, ...replacements] }
    );
    return sendSuccess(res, 'Brand report', data);
  } catch (err) { return sendError(res, err.message, 500); }
};

const momReport = async (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  try {
    const [data] = await sequelize.query(
      `SELECT c.id as client_id, c.company_name,
         COALESCE(SUM(CASE WHEN MONTH(br.invoice_date)=1  THEN br.invoice_amount ELSE 0 END),0) as m01,
         COALESCE(SUM(CASE WHEN MONTH(br.invoice_date)=2  THEN br.invoice_amount ELSE 0 END),0) as m02,
         COALESCE(SUM(CASE WHEN MONTH(br.invoice_date)=3  THEN br.invoice_amount ELSE 0 END),0) as m03,
         COALESCE(SUM(CASE WHEN MONTH(br.invoice_date)=4  THEN br.invoice_amount ELSE 0 END),0) as m04,
         COALESCE(SUM(CASE WHEN MONTH(br.invoice_date)=5  THEN br.invoice_amount ELSE 0 END),0) as m05,
         COALESCE(SUM(CASE WHEN MONTH(br.invoice_date)=6  THEN br.invoice_amount ELSE 0 END),0) as m06,
         COALESCE(SUM(CASE WHEN MONTH(br.invoice_date)=7  THEN br.invoice_amount ELSE 0 END),0) as m07,
         COALESCE(SUM(CASE WHEN MONTH(br.invoice_date)=8  THEN br.invoice_amount ELSE 0 END),0) as m08,
         COALESCE(SUM(CASE WHEN MONTH(br.invoice_date)=9  THEN br.invoice_amount ELSE 0 END),0) as m09,
         COALESCE(SUM(CASE WHEN MONTH(br.invoice_date)=10 THEN br.invoice_amount ELSE 0 END),0) as m10,
         COALESCE(SUM(CASE WHEN MONTH(br.invoice_date)=11 THEN br.invoice_amount ELSE 0 END),0) as m11,
         COALESCE(SUM(CASE WHEN MONTH(br.invoice_date)=12 THEN br.invoice_amount ELSE 0 END),0) as m12,
         COALESCE(SUM(br.invoice_amount),0) as year_total
       FROM clients c
       LEFT JOIN billing_records br ON br.client_id=c.id AND YEAR(br.invoice_date)=?
       WHERE c.deleted_at IS NULL
       GROUP BY c.id, c.company_name
       HAVING year_total > 0
       ORDER BY year_total DESC`,
      { replacements: [year] }
    );
    const months = ['m01','m02','m03','m04','m05','m06','m07','m08','m09','m10','m11','m12'];
    const currentMonth = new Date().getMonth() + 1;
    const result = data.map(row => {
      const mom = {};
      for (let i = 1; i < Math.min(currentMonth, 12); i++) {
        const prev = parseFloat(row[months[i-1]]) || 0;
        const curr = parseFloat(row[months[i]]) || 0;
        mom[`mom_${months[i]}_pct`] = prev === 0 ? null : Math.round(((curr - prev) / prev) * 10000) / 100;
      }
      return { ...row, ...mom };
    });
    return sendSuccess(res, 'Month-over-month report', result);
  } catch (err) { return sendError(res, err.message, 500); }
};

const productMovementReport = async (req, res) => {
  const { from_date, to_date, brand_id, category_id } = req.query;
  let dateWhere = '1=1';
  const baseR = [];
  if (from_date)   { dateWhere += ' AND br.invoice_date >= ?'; baseR.push(from_date); }
  if (to_date)     { dateWhere += ' AND br.invoice_date <= ?'; baseR.push(to_date); }
  if (brand_id)    { dateWhere += ' AND br.brand_id = ?';      baseR.push(brand_id); }
  if (category_id) { dateWhere += ' AND br.category_id = ?';   baseR.push(category_id); }
  const now = new Date();
  const thisMonth = now.getMonth() + 1, thisYear = now.getFullYear();
  const lastMonth = thisMonth === 1 ? 12 : thisMonth - 1;
  const lastMonthYear = thisMonth === 1 ? thisYear - 1 : thisYear;
  try {
    const [topProducts] = await sequelize.query(
      `SELECT br.brand_name, br.category_name,
         b.name as brand_label, cat.name as category_label,
         COUNT(br.id) as invoice_count,
         COALESCE(SUM(br.invoice_amount), 0) as total_amount
       FROM billing_records br
       LEFT JOIN brands b ON br.brand_id = b.id
       LEFT JOIN categories cat ON br.category_id = cat.id
       WHERE ${dateWhere}
       GROUP BY br.brand_name, br.category_name, b.name, cat.name
       ORDER BY total_amount DESC LIMIT 20`,
      { replacements: baseR }
    );
    const [categoryMovement] = await sequelize.query(
      `SELECT cat.id as category_id, COALESCE(cat.name, br.category_name, 'Untagged') as category_name,
         COUNT(DISTINCT br.client_id) as unique_clients,
         COUNT(br.id) as invoice_count,
         COALESCE(SUM(br.invoice_amount), 0) as total_amount,
         COALESCE(SUM(CASE WHEN MONTH(br.invoice_date)=? AND YEAR(br.invoice_date)=? THEN br.invoice_amount ELSE 0 END),0) as this_month,
         COALESCE(SUM(CASE WHEN MONTH(br.invoice_date)=? AND YEAR(br.invoice_date)=? THEN br.invoice_amount ELSE 0 END),0) as last_month
       FROM billing_records br
       LEFT JOIN categories cat ON br.category_id = cat.id
       WHERE ${dateWhere}
       GROUP BY cat.id, category_name
       ORDER BY total_amount DESC`,
      { replacements: [thisMonth, thisYear, lastMonth, lastMonthYear, ...baseR] }
    );
    return sendSuccess(res, 'Product movement report', { top_products: topProducts, category_movement: categoryMovement });
  } catch (err) { return sendError(res, err.message, 500); }
};

module.exports = { salespersonVisitReport, opportunityReport, followupReport, billingReport, exportReport, brandReport, momReport, productMovementReport };
