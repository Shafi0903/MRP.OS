/**
 * Utility functions for Indian Numbering System and INR currency formatting
 */

/**
 * Format a number as Indian Currency (INR)
 * e.g. 2345750 -> "₹23,45,750.00"
 */
export function formatINR(value, options = {}) {
  const num = Number(value);
  if (isNaN(num)) return '₹0.00';

  const { minimumFractionDigits = 2, maximumFractionDigits = 2 } = options;

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(num);
}

/**
 * Format large numbers into Indian compact notation (Lakhs & Crores)
 * e.g. 23457500 -> "₹2.35 Cr"
 * e.g. 780450 -> "₹7.80 L"
 * e.g. 45000 -> "₹45.0 K"
 */
export function formatIndianCompact(value) {
  const num = Number(value);
  if (isNaN(num)) return '₹0';

  if (num >= 10000000) {
    return `₹${(num / 10000000).toFixed(2)} Cr`;
  } else if (num >= 100000) {
    return `₹${(num / 100000).toFixed(2)} L`;
  } else if (num >= 1000) {
    return `₹${(num / 1000).toFixed(1)} K`;
  }
  return `₹${num.toFixed(2)}`;
}

/**
 * Format quantity in Indian numbering system
 * e.g. 100000 -> "1,00,000"
 */
export function formatIndianNumber(value) {
  const num = Number(value);
  if (isNaN(num)) return '0';
  return num.toLocaleString('en-IN');
}

