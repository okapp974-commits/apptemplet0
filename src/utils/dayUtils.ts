export interface WeekdayOption {
  value: string;
  label: string;
}

export const WEEKDAYS: WeekdayOption[] = [
  { value: 'Saturday', label: 'السبت' },
  { value: 'Sunday', label: 'الأحد' },
  { value: 'Monday', label: 'الاثنين' },
  { value: 'Tuesday', label: 'الثلاثاء' },
  { value: 'Wednesday', label: 'الأربعاء' },
  { value: 'Thursday', label: 'الخميس' },
  { value: 'Friday', label: 'الجمعة' }
];

/**
 * Normalizes any Arabic or English weekday name to canonical English ('Saturday', 'Sunday', etc.)
 */
export const normalizeDayValue = (day: any): string => {
  if (!day || typeof day !== 'string') return '';
  const trimmed = day.trim();
  if (!trimmed) return '';

  const cleanArabic = (str: string) =>
    str.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/\s+/g, ' ').toLowerCase();

  const found = WEEKDAYS.find(w => {
    if (w.value.toLowerCase() === trimmed.toLowerCase()) return true;
    if (w.label === trimmed) return true;
    if (cleanArabic(w.label) === cleanArabic(trimmed)) return true;
    return false;
  });

  return found ? found.value : trimmed;
};

/**
 * Returns the Arabic label for a given weekday name
 */
export const getArabicWeekdayLabel = (day: string): string => {
  const norm = normalizeDayValue(day);
  const found = WEEKDAYS.find(w => w.value === norm || w.label === day);
  return found ? found.label : day;
};

/**
 * Robustly parses and extracts customer's preferred visit days from any customer record.
 * Handles arrays, JSON strings, comma-separated strings, and legacy singular preferredDay/preferredday fields.
 */
export const parseCustomerPreferredDays = (customer: any): string[] => {
  if (!customer) return [];

  const rawList = customer.preferredDays ?? customer.preferreddays;
  const rawSingular = customer.preferredDay ?? customer.preferredday;

  let rawTokens: string[] = [];

  // Parse multi-day field if present
  if (Array.isArray(rawList)) {
    rawTokens.push(...rawList);
  } else if (typeof rawList === 'string' && rawList.trim()) {
    const s = rawList.trim();
    if (s.startsWith('[') && s.endsWith(']')) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          rawTokens.push(...parsed);
        }
      } catch {
        rawTokens.push(s);
      }
    } else if (s.includes(',')) {
      rawTokens.push(...s.split(',').map(x => x.trim()));
    } else if (s.includes('،')) {
      rawTokens.push(...s.split('،').map(x => x.trim()));
    } else if (s.includes('-')) {
      rawTokens.push(...s.split('-').map(x => x.trim()));
    } else {
      rawTokens.push(s);
    }
  }

  // Also include legacy singular field if not already present
  if (typeof rawSingular === 'string' && rawSingular.trim()) {
    rawTokens.push(rawSingular.trim());
  }

  // Normalize all tokens to canonical English weekday values ('Saturday', etc.) and deduplicate
  const normalized = Array.from(
    new Set(
      rawTokens
        .map(t => normalizeDayValue(t))
        .filter(t => Boolean(t) && WEEKDAYS.some(w => w.value === t))
    )
  );

  return normalized;
};

/**
 * Checks if a specific day is included in the customer's preferred days list.
 * Key requirement: The customer does not need to have ONLY this day; it is sufficient
 * that targetDay is ONE of their preferred days.
 */
export const isCustomerPreferredOnDay = (customer: any, targetDay: string): boolean => {
  if (!customer || !targetDay) return false;
  const normTarget = normalizeDayValue(targetDay);
  if (!normTarget) return false;
  const customerDays = parseCustomerPreferredDays(customer);
  return customerDays.includes(normTarget);
};

/**
 * Formats a list of preferred days into readable Arabic text (e.g. "السبت، الثلاثاء")
 */
export const formatPreferredDaysArabic = (days: string[]): string => {
  if (!days || days.length === 0) return 'لم يحدد أيام';
  return days
    .map(d => getArabicWeekdayLabel(d))
    .join('، ');
};
