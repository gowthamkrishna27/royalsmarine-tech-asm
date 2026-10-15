export const FARM_TIMEZONE = 'Asia/Kolkata';

/**
 * Returns 'YYYY-MM-DD' representing the calendar date in Asia/Kolkata (UTC+05:30).
 */
export function getLocalDateString(dateInput, timeZone = FARM_TIMEZONE) {
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
    const offset = 5.5 * 60 * 60 * 1000;
    const local = new Date(d.getTime() + offset);
    return local.toISOString().substring(0, 10);
  }
}

/**
 * Calculate difference in calendar days between two 'YYYY-MM-DD' strings.
 */
export function calendarDaysDiff(fromStr, toStr) {
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
 * Calculate dynamic DOC for a pond / tank on the frontend.
 */
export function calculateDoc({
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

  if (normStatus === 'harvested' || normStatus === 'completed') {
    return parsedBaseline !== null ? parsedBaseline : 0;
  }

  const todayStr = getLocalDateString(referenceDate);
  const stockingDateStr = getLocalDateString(stockingDate);
  const regDateStr = getLocalDateString(createdAt) || todayStr;

  const daysSinceReg = Math.max(0, calendarDaysDiff(regDateStr, todayStr));

  if (stockingDateStr) {
    const elapsedSinceStocking = calendarDaysDiff(stockingDateStr, todayStr);
    if (elapsedSinceStocking < 0) return 0;

    const dateDerivedDoc = elapsedSinceStocking;
    if (parsedBaseline !== null && parsedBaseline > 0) {
      const baselineDerivedDoc = parsedBaseline + daysSinceReg;
      return Math.max(dateDerivedDoc, baselineDerivedDoc);
    }
    return dateDerivedDoc;
  }

  if (parsedBaseline !== null && parsedBaseline > 0) {
    return parsedBaseline + daysSinceReg;
  }

  return 0;
}
