export { cn } from "./cn";
import { isNativeApp } from "@/infrastructure/navigation/mobileApp";
import { DEFAULT_MAP_CENTER } from "@/infrastructure/location/location";


// Module-level static cache for Intl.NumberFormat instance (10x faster execution)
const currencyFormatter = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function resolveCurrencyPrefix(currency?: string): string {
  return !currency || currency.toUpperCase() === 'KES' || currency.toUpperCase() === 'KSH' ? 'KSh' : currency;
}

export function formatCurrency(amount: number | string | null | undefined, currency?: string): string {
  const prefix = resolveCurrencyPrefix(currency);

  // Handle null, undefined, or empty string
  if (amount === null || amount === undefined || amount === '') {
    return `${prefix} 0`;
  }

  // Handle objects - if amount is an object, try to extract a numeric value
  if (typeof amount === 'object' && amount !== null) {
    // Try to extract a numeric value from common object structures
    const obj = amount as Record<string, unknown>;
    const numericValue = obj.value || obj.amount || obj.price || obj.total || 0;
    if (typeof numericValue === 'number' && !Number.isNaN(numericValue)) {
      amount = numericValue;
    } else {
      return `${prefix} 0`;
    }
  }

  // Convert to string to handle different input types
  const amountStr = String(amount).trim();

  // Remove any non-numeric characters except decimal point and minus
  const numericStr = amountStr.replace(/[^0-9.-]+/g, '');

  // Parse to number
  const numericAmount = Number.parseFloat(numericStr);

  // Check if parsing was successful
  if (Number.isNaN(numericAmount)) {
    return `${prefix} 0`;
  }

  const fallbackFormatted = () => `${prefix} ${numericAmount.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  try {
    if (prefix === 'KSh') {
      // Format as Kenyan Shillings using cached formatter
      const formatted = currencyFormatter.format(numericAmount);

      // Standardize currency symbol to capital KSh
      return formatted.replace(/Ksh/i, 'KSh');
    }
    return fallbackFormatted();
  } catch {
    return fallbackFormatted();
  }
}

/**
 * Format currency with compact notation (e.g. 1k, 10k, 100k, 130.1k) after passing 1000.
 * Values below 1000 display standard currency formatting (e.g. KSh 0, KSh 950).
 * Values >= 1000 display at most one decimal place, omitting .0 for clean whole numbers.
 */
export function formatCompactCurrency(amount: number | string | null | undefined, currency?: string): string {
  const prefix = resolveCurrencyPrefix(currency);

  if (amount === null || amount === undefined || amount === '') {
    return `${prefix} 0`;
  }

  const num = typeof amount === 'number' ? amount : Number.parseFloat(String(amount).replace(/[^0-9.-]+/g, ''));
  if (!Number.isFinite(num)) {
    return `${prefix} 0`;
  }

  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (abs < 1000) {
    return formatCurrency(num, prefix);
  }

  const formatWithSuffix = (value: number, suffix: string) => {
    const rounded = Math.round(value * 10) / 10;
    const formatted = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
    return `${sign}${prefix} ${formatted}${suffix}`;
  };

  if (abs >= 1_000_000_000) {
    return formatWithSuffix(abs / 1_000_000_000, 'B');
  }
  if (abs >= 1_000_000) {
    return formatWithSuffix(abs / 1_000_000, 'M');
  }
  return formatWithSuffix(abs / 1000, 'k');
}

export function formatDate(dateInput: string | Date, format: 'full' | 'date' | 'time' = 'full'): string {
  try {
    // Handle different date input types
    let date: Date;

    // If it's already a Date object
    if (dateInput instanceof Date) {
      date = dateInput;
    }
    // If it's a string that can be parsed by Date constructor
    else if (typeof dateInput === 'string') {
      // Try parsing the date string
      const parsedDate = new Date(dateInput);

      // If the date is invalid, try parsing with Date.parse
      if (Number.isNaN(parsedDate.getTime())) {
        const timestamp = Date.parse(dateInput);
        if (!Number.isNaN(timestamp)) {
          date = new Date(timestamp);
        } else {
          throw new TypeError(`Invalid date string: ${dateInput}`);
        }
      } else {
        date = parsedDate;
      }
    } else {
      throw new TypeError(`Invalid date format: ${typeof dateInput}`);
    }

    // Format based on requested format
    switch (format) {
      case 'date':
        return date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      case 'time':
        return date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        });
      case 'full':
      default:
        return date.toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
    }
  } catch {
    return 'Date not available';
  }
}

/**
 * Normalizes an image path or URL to a full URL
 * Handles base64, absolute URLs, relative paths, and Capacitor Native environment paths
 */
export function getImageUrl(path: string | undefined | null): string {
  const placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect width="400" height="400" fill="%23111111"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="20" fill="%23666666"%3ENo Image%3C/text%3E%3C/svg%3E';

  // Return placeholder image if no path provided or string is 'null'/'undefined'
  if (!path) return placeholder;

  const trimmed = String(path).trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') {
    return placeholder;
  }

  // 1. If it's already a full URL (http/https), a data URL (base64), or a blob URL, return it as is
  if (trimmed.startsWith('http') || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // 2. Identify the backend base URL
  const VITE_API_URL = import.meta.env.VITE_API_URL;
  let baseUrl = '';

  if (isNativeApp()) {
    const nativeApiUrl = import.meta.env.VITE_NATIVE_API_URL || VITE_API_URL || 'https://api.byblosafrica.site/api';
    baseUrl = nativeApiUrl.replace(/\/api$/, '').replace(/\/$/, '');
  } else if (VITE_API_URL) {
    baseUrl = VITE_API_URL.replace(/\/api$/, '').replace(/\/$/, '');
  } else {
    baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  }

  // 3. Normalize the path (ensure it starts with /)
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

  // 4. Combine and return
  return `${baseUrl}${cleanPath}`;
}

/**
 * Standardized check to determine if a seller is "Shopless"
 * (Missing physical shop flag, missing address, or using default placeholder coordinates)
 */
export function isSellerShopless(input: unknown): boolean {
  if (!input) return true;

  // 1. Identify the core seller data (prioritize nested seller object)
  const seller = ((input as Record<string, unknown>).seller || input) as Record<string, unknown>;

  // 2. Extract coordinates and address (Strict Backend Parity)
  const latValue = seller.latitude ?? seller.lat;
  const lngValue = seller.longitude ?? seller.lng;

  const lat = Number(latValue);
  const lng = Number(lngValue);

  // 3. Validate coordinates (must be non-zero numbers and not the Nairobi sentinel)
  const hasCoords = !Number.isNaN(lat) && !Number.isNaN(lng) && lat !== 0 && lng !== 0;

  // 4. Check for Nairobi sentinel (the default placeholder)
  const isDefaultNairobi = hasCoords && (
    Math.abs(lat - DEFAULT_MAP_CENTER.lat) < 0.0001 &&
    Math.abs(lng - DEFAULT_MAP_CENTER.lng) < 0.0001
  );

  // 5. BACKEND ALIGNMENT: To have a shop, you MUST have valid non-sentinel coordinates.
  const hasShop = hasCoords && !isDefaultNairobi;

  if (hasShop) return false;

  return true;
}

/**
 * Extract up to two uppercase initials from a name or label.
 *
 * @param name The primary name/label to extract initials from.
 * @param fallback Alternative string if name is missing or empty. Defaults to 'Shop'.
 * @returns 1-2 character uppercase string, or 'S' if empty.
 */
export function getInitials(name?: string, fallback?: string): string {
  const source = (name || fallback || 'Shop').trim();
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return 'S';
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
}




