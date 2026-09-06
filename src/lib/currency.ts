export function getCurrencySymbol(code?: string): string {
  switch (code?.toUpperCase()) {
    case 'INR': return '₹';
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'AUD': return 'A$';
    case 'SGD': return 'S$';
    default: return code || '$';
  }
}
