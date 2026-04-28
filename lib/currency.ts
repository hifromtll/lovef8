export function getCurrencyCodeFromCountry(country: string | null | undefined): string {
  if (!country) return 'USD';

  // 🔹 Direct mappings (high priority markets)
  if (country === 'United Kingdom') return 'GBP';
  if (country === 'Philippines') return 'PHP';
  if (country === 'Australia') return 'AUD';
  if (country === 'Canada') return 'CAD';

  // 🔥 NEW — payout-heavy countries
  if (country === 'India') return 'INR';
  if (country === 'Vietnam') return 'VND';
  if (country === 'Indonesia') return 'IDR';
  if (country === 'Thailand') return 'THB';
  if (country === 'Pakistan') return 'PKR';
  if (country === 'Bangladesh') return 'BDT';
  if (country === 'Nigeria') return 'NGN';
  if (country === 'Kenya') return 'KES';
  if (country === 'South Africa') return 'ZAR';

  // 🔹 Eurozone
  const euroCountries = new Set([
    'Austria',
    'Belgium',
    'Croatia',
    'Cyprus',
    'Estonia',
    'Finland',
    'France',
    'Germany',
    'Greece',
    'Ireland',
    'Italy',
    'Latvia',
    'Lithuania',
    'Luxembourg',
    'Malta',
    'Netherlands',
    'Portugal',
    'Slovakia',
    'Slovenia',
    'Spain',
  ]);

  if (euroCountries.has(country)) return 'EUR';

  return 'USD';
}

export function formatMoneyFromCountry(
  amount: number,
  country: string | null | undefined
): string {
  const currency = getCurrencyCodeFromCountry(country);

  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}