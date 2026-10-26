/**
 * Canonical list of recognized neighborhoods/locations within Nairobi.
 * Matches frontend constants (src/shared/utils/constants.ts).
 */
export const NAIROBI_LOCATIONS = [
  'CBD',
  'Westlands',
  'Karen',
  'Runda',
  'Kileleshwa',
  'Kilimani',
  'Lavington',
  'Parklands',
  'Eastleigh',
  'South B',
  'South C',
  'Langata',
  'Kasarani',
  'Embakasi',
  'Ruaraka',
  'Ngara',
  'Pangani',
  'Roysambu',
  'Madaraka',
  'Upper Hill',
  'Gigiri',
  'Muthaiga',
  'Hurlingham',
  'Dagoretti',
  'Ruaka'
];

/**
 * Returns a PostgreSQL CASE SQL expression that inspects any location or address
 * text expression and normalizes it to a canonical Nairobi neighborhood.
 *
 * Crucially:
 * - Returns NULL for generic city-level names like 'Nairobi', 'Unknown', etc.
 * - Never returns 'Nairobi' as a neighborhood/location.
 *
 * @param {string} expr - SQL expression representing the text column or value.
 * @returns {string} - SQL CASE snippet.
 */
export function normalizeNairobiLocationSql(expr) {
  return `
    CASE
      WHEN ${expr} ~* '(^|[^a-z0-9])(cbd|central business district)([^a-z0-9]|$)' THEN 'CBD'
      WHEN ${expr} ~* '(^|[^a-z0-9])westlands([^a-z0-9]|$)' THEN 'Westlands'
      WHEN ${expr} ~* '(^|[^a-z0-9])karen([^a-z0-9]|$)' THEN 'Karen'
      WHEN ${expr} ~* '(^|[^a-z0-9])kilimani([^a-z0-9]|$)' THEN 'Kilimani'
      WHEN ${expr} ~* '(^|[^a-z0-9])kileleshwa([^a-z0-9]|$)' THEN 'Kileleshwa'
      WHEN ${expr} ~* '(^|[^a-z0-9])lavington([^a-z0-9]|$)' THEN 'Lavington'
      WHEN ${expr} ~* '(^|[^a-z0-9])parklands([^a-z0-9]|$)' THEN 'Parklands'
      WHEN ${expr} ~* '(^|[^a-z0-9])eastleigh([^a-z0-9]|$)' THEN 'Eastleigh'
      WHEN ${expr} ~* '(^|[^a-z0-9])south\\s*b([^a-z0-9]|$)' THEN 'South B'
      WHEN ${expr} ~* '(^|[^a-z0-9])south\\s*c([^a-z0-9]|$)' THEN 'South C'
      WHEN ${expr} ~* '(^|[^a-z0-9])lang''?ata([^a-z0-9]|$)' THEN 'Langata'
      WHEN ${expr} ~* '(^|[^a-z0-9])kasarani([^a-z0-9]|$)' THEN 'Kasarani'
      WHEN ${expr} ~* '(^|[^a-z0-9])embakasi([^a-z0-9]|$)' THEN 'Embakasi'
      WHEN ${expr} ~* '(^|[^a-z0-9])ruaraka([^a-z0-9]|$)' THEN 'Ruaraka'
      WHEN ${expr} ~* '(^|[^a-z0-9])runda([^a-z0-9]|$)' THEN 'Runda'
      WHEN ${expr} ~* '(^|[^a-z0-9])roysambu([^a-z0-9]|$)' THEN 'Roysambu'
      WHEN ${expr} ~* '(^|[^a-z0-9])ngara([^a-z0-9]|$)' THEN 'Ngara'
      WHEN ${expr} ~* '(^|[^a-z0-9])pangani([^a-z0-9]|$)' THEN 'Pangani'
      WHEN ${expr} ~* '(^|[^a-z0-9])madaraka([^a-z0-9]|$)' THEN 'Madaraka'
      WHEN ${expr} ~* '(^|[^a-z0-9])upper\\s*hill([^a-z0-9]|$)' THEN 'Upper Hill'
      WHEN ${expr} ~* '(^|[^a-z0-9])gigiri([^a-z0-9]|$)' THEN 'Gigiri'
      WHEN ${expr} ~* '(^|[^a-z0-9])muthaiga([^a-z0-9]|$)' THEN 'Muthaiga'
      WHEN ${expr} ~* '(^|[^a-z0-9])hurlingham([^a-z0-9]|$)' THEN 'Hurlingham'
      WHEN ${expr} ~* '(^|[^a-z0-9])dagoretti([^a-z0-9]|$)' THEN 'Dagoretti'
      WHEN ${expr} ~* '(^|[^a-z0-9])ruaka([^a-z0-9]|$)' THEN 'Ruaka'
      ELSE NULL
    END
  `;
}

/**
 * Normalizes a raw string in JavaScript to a canonical Nairobi neighborhood, or null.
 *
 * @param {string|null|undefined} text
 * @returns {string|null}
 */
export function normalizeNairobiLocation(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  const patterns = [
    [/(^|[^a-z0-9])(cbd|central business district)([^a-z0-9]|$)/i, 'CBD'],
    [/(^|[^a-z0-9])westlands([^a-z0-9]|$)/i, 'Westlands'],
    [/(^|[^a-z0-9])karen([^a-z0-9]|$)/i, 'Karen'],
    [/(^|[^a-z0-9])kilimani([^a-z0-9]|$)/i, 'Kilimani'],
    [/(^|[^a-z0-9])kileleshwa([^a-z0-9]|$)/i, 'Kileleshwa'],
    [/(^|[^a-z0-9])lavington([^a-z0-9]|$)/i, 'Lavington'],
    [/(^|[^a-z0-9])parklands([^a-z0-9]|$)/i, 'Parklands'],
    [/(^|[^a-z0-9])eastleigh([^a-z0-9]|$)/i, 'Eastleigh'],
    [/(^|[^a-z0-9])south\s*b([^a-z0-9]|$)/i, 'South B'],
    [/(^|[^a-z0-9])south\s*c([^a-z0-9]|$)/i, 'South C'],
    [/(^|[^a-z0-9])lang'?ata([^a-z0-9]|$)/i, 'Langata'],
    [/(^|[^a-z0-9])kasarani([^a-z0-9]|$)/i, 'Kasarani'],
    [/(^|[^a-z0-9])embakasi([^a-z0-9]|$)/i, 'Embakasi'],
    [/(^|[^a-z0-9])ruaraka([^a-z0-9]|$)/i, 'Ruaraka'],
    [/(^|[^a-z0-9])runda([^a-z0-9]|$)/i, 'Runda'],
    [/(^|[^a-z0-9])roysambu([^a-z0-9]|$)/i, 'Roysambu'],
    [/(^|[^a-z0-9])ngara([^a-z0-9]|$)/i, 'Ngara'],
    [/(^|[^a-z0-9])pangani([^a-z0-9]|$)/i, 'Pangani'],
    [/(^|[^a-z0-9])madaraka([^a-z0-9]|$)/i, 'Madaraka'],
    [/(^|[^a-z0-9])upper\s*hill([^a-z0-9]|$)/i, 'Upper Hill'],
    [/(^|[^a-z0-9])gigiri([^a-z0-9]|$)/i, 'Gigiri'],
    [/(^|[^a-z0-9])muthaiga([^a-z0-9]|$)/i, 'Muthaiga'],
    [/(^|[^a-z0-9])hurlingham([^a-z0-9]|$)/i, 'Hurlingham'],
    [/(^|[^a-z0-9])dagoretti([^a-z0-9]|$)/i, 'Dagoretti'],
    [/(^|[^a-z0-9])ruaka([^a-z0-9]|$)/i, 'Ruaka']
  ];

  for (const [regex, canonical] of patterns) {
    if (regex.test(trimmed)) {
      return canonical;
    }
  }

  return null;
}
