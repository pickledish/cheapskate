/** Normalized name (lowercase, alphanumeric only) -> site domain (used for fetching favicon) */
export const INSTITUTION_DOMAINS: Record<string, string> = {
  vanguard: 'vanguard.com',
  fidelity: 'fidelity.com',
  schwab: 'schwab.com',
  tiaa: 'tiaa.org',
  etrade: 'etrade.com',
  merrill: 'ml.com',
  interactivebrokers: 'interactivebrokers.com',
  robinhood: 'robinhood.com',
  ally: 'ally.com',
  wellsfargo: 'wellsfargo.com',
  chase: 'chase.com',
  bankofamerica: 'bankofamerica.com',
  capitalone: 'capitalone.com',
  usaa: 'usaa.com',
  navyfederal: 'navyfederal.org',
  empower: 'empower.com',
  principal: 'principal.com',
  voya: 'voya.com',
  sofi: 'sofi.com',
  wealthfront: 'wealthfront.com',
  betterment: 'betterment.com',
  webull: 'webull.com',
  coinbase: 'coinbase.com',
  morganstanley: 'morganstanley.com',
  edwardjones: 'edwardjones.com',
  ameriprise: 'ameriprise.com',
  goldmansachs: 'goldmansachs.com',
  healthequity: 'healthequity.com',
  acorns: 'acorns.com',
  m1: 'm1.com',
  citi: 'citi.com',
  carta: 'carta.com',
};

const iconModules = import.meta.glob<string>('../assets/institutions/*', {
  eager: true,
  import: 'default',
});

const iconsByKey: Record<string, string> = {};
for (const [path, url] of Object.entries(iconModules)) {
  const filename = path.split('/').pop() ?? '';
  const stem = filename.replace(/\.[^.]+$/, '');
  iconsByKey[stem] = url;
}

export function normalizeInstitution(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function institutionIconUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const key = normalizeInstitution(input);
  if (!key) return null;
  return iconsByKey[key] ?? null;
}
