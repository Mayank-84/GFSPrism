// ----------------- Parsing Logic -----------------
export const parseKPI = (raw) => ({
  value: raw?.value ?? '--',
  label: raw?.label ?? '',
});
export const parseGraph = (raw) => {
  const x = raw.map((r) => r.month || r.x || '');
  const y = raw.map((r) => r.count || r.y || 0);
  return { x, y };
};
export const parseTable = (raw) => {
  if (!raw || !raw.length) return { headers: [], rows: [] };
  const headers = Object.keys(raw[0]);
  return { headers, rows: raw };
};
