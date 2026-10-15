const FARM_TIMEZONE = 'Asia/Kolkata';

/**
 * Returns 'YYYY-MM-DD' representing the calendar date in Asia/Kolkata (UTC+05:30).
 */
function getLocalDateString(dateInput, timeZone = FARM_TIMEZONE) {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;

  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(d);
  } catch {
    // Fallback if timezone not supported
    const offset = 5.5 * 60 * 60 * 1000;
    const local = new Date(d.getTime() + offset);
    return local.toISOString().substring(0, 10);
  }
}

/**
 * Calculate difference in calendar days between two 'YYYY-MM-DD' strings.
 * Result: toDate - fromDate (positive if toDate > fromDate).
 */
function calendarDaysDiff(fromStr, toStr) {
  if (!fromStr || !toStr) return 0;
  const parts1 = String(fromStr).substring(0, 10).split('-');
  const parts2 = String(toStr).substring(0, 10).split('-');
  if (parts1.length < 3 || parts2.length < 3) return 0;

  const y1 = parseInt(parts1[0], 10);
  const m1 = parseInt(parts1[1], 10);
  const d1 = parseInt(parts1[2], 10);

  const y2 = parseInt(parts2[0], 10);
  const m2 = parseInt(parts2[1], 10);
  const d2 = parseInt(parts2[2], 10);

  if (isNaN(y1) || isNaN(m1) || isNaN(d1) || isNaN(y2) || isNaN(m2) || isNaN(d2)) return 0;

  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
}

/**
 * Calculate dynamic DOC for a pond / tank.
 * 
 * Rules:
 * 1. Farm's timezone is Asia/Kolkata (UTC+05:30).
 * 2. Day of stocking is DOC 0 (i.e. if stocked today, DOC is 0; 1 day later, DOC is 1).
 * 3. If tank status is 'harvested' or 'completed', DOC is frozen at the recorded baseline.
 * 4. If stocking date is valid (<= today), date-derived DOC is elapsed calendar days.
 * 5. If an entered baseline DOC exists (> 0), compare it with date-derived DOC.
 *    If entered DOC was a baseline on registration day, elapsed days since registration
 *    are added to the baseline. We take Math.max(dateDerivedDoc, baselineDerivedDoc)
 *    to prevent regression without double-counting.
 * 6. If stocking date is missing/invalid, baseline DOC + daysSinceReg is used.
 * 7. If stocking date is in the future, DOC is 0.
 * 8. Never mutates database records on read; safe across refreshes and repeated calls.
 * 
 * @param {Object} options
 * @param {string|Date|null} options.stockingDate - The stocking date / seed_date
 * @param {number|string|null} options.baselineDoc - Stored baseline doc (if any)
 * @param {string|Date|null} options.createdAt - When the record was created/registered
 * @param {string} [options.status] - Tank status (e.g. 'active', 'harvested')
 * @param {Date|string} [options.referenceDate] - Date to calculate for (defaults to now in farm timezone)
 * @returns {number} The calculated DOC (integer >= 0)
 */
function calculateDoc({
  stockingDate,
  baselineDoc,
  createdAt,
  status = 'active',
  referenceDate = new Date(),
}) {
  const normStatus = String(status || '').toLowerCase().trim();
  const parsedBaseline =
    baselineDoc !== undefined && baselineDoc !== null && baselineDoc !== '' && !isNaN(Number(baselineDoc))
      ? Math.max(0, parseInt(baselineDoc, 10))
      : null;

  // Harvested tanks freeze DOC at their final value
  if (normStatus === 'harvested' || normStatus === 'completed') {
    return parsedBaseline !== null ? parsedBaseline : 0;
  }

  const todayStr = getLocalDateString(referenceDate);
  const stockingDateStr = getLocalDateString(stockingDate);
  const regDateStr = getLocalDateString(createdAt) || todayStr;

  const daysSinceReg = Math.max(0, calendarDaysDiff(regDateStr, todayStr));

  // Case A: Valid stocking date provided
  if (stockingDateStr) {
    const elapsedSinceStocking = calendarDaysDiff(stockingDateStr, todayStr);

    // If stocking date is in the future, DOC has not started yet
    if (elapsedSinceStocking < 0) {
      return 0;
    }

    const dateDerivedDoc = elapsedSinceStocking;

    // If an entered baseline DOC exists:
    if (parsedBaseline !== null && parsedBaseline > 0) {
      const baselineDerivedDoc = parsedBaseline + daysSinceReg;
      return Math.max(dateDerivedDoc, baselineDerivedDoc);
    }

    return dateDerivedDoc;
  }

  // Case B: No stocking date (legacy record)
  if (parsedBaseline !== null && parsedBaseline > 0) {
    return parsedBaseline + daysSinceReg;
  }

  return 0;
}

/**
 * SQL snippet generator for MySQL queries.
 * Produces a CASE expression computing DOC according to the farm's timezone and rules.
 * 
 * @param {string} seedDateCol - Column name for stocking date, e.g. 'p.seed_date' or 't.stocking_date'
 * @param {string} docCol - Column name for baseline DOC, e.g. 'p.doc' or 't.doc'
 * @param {string} createdAtCol - Column name for created_at, e.g. 'p.created_at' or 't.created_at'
 * @param {string} statusCol - Column name for status, e.g. 'p.status' or 't.status'
 * @param {boolean} isDateString - If the seed date column is VARCHAR instead of DATE
 * @returns {string} SQL CASE expression
 */
function getDocSqlExpression({
  seedDateCol = 'p.seed_date',
  docCol = 'p.doc',
  createdAtCol = 'p.created_at',
  statusCol = 'p.status',
  isDateString = false,
} = {}) {
  const seedExpr = isDateString
    ? `STR_TO_DATE(${seedDateCol}, '%Y-%m-%d')`
    : seedDateCol;

  const curFarmDate = `COALESCE(DATE(CONVERT_TZ(NOW(), '+00:00', '+05:30')), CURDATE())`;
  const regFarmDate = `DATE(CONVERT_TZ(${createdAtCol}, '+00:00', '+05:30'))`;

  return `
    CASE
      WHEN LOWER(COALESCE(${statusCol}, '')) IN ('harvested', 'completed') THEN COALESCE(${docCol}, 0)
      WHEN ${seedExpr} IS NOT NULL AND ${seedExpr} <= ${curFarmDate} THEN
        GREATEST(
          DATEDIFF(${curFarmDate}, ${seedExpr}),
          COALESCE(${docCol}, 0) + GREATEST(0, DATEDIFF(${curFarmDate}, ${regFarmDate}))
        )
      WHEN ${docCol} IS NOT NULL AND ${docCol} > 0 THEN
        ${docCol} + GREATEST(0, DATEDIFF(${curFarmDate}, ${regFarmDate}))
      ELSE 0
    END
  `.trim();
}

module.exports = {
  FARM_TIMEZONE,
  getLocalDateString,
  calendarDaysDiff,
  calculateDoc,
  getDocSqlExpression,
};
