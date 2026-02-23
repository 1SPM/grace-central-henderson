/**
 * Input Validation Utilities
 *
 * Provides validation functions for form inputs and data integrity.
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface PersonValidation {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}

/**
 * Validates person/contact data
 */
export function validatePerson(data: PersonValidation): ValidationResult {
  const errors: string[] = [];

  // First name validation
  if (!data.firstName || data.firstName.trim().length === 0) {
    errors.push('First name is required');
  } else if (data.firstName.length > 100) {
    errors.push('First name must be 100 characters or less');
  } else if (!/^[a-zA-Z\s\-'.]+$/.test(data.firstName)) {
    errors.push('First name contains invalid characters');
  }

  // Last name validation
  if (!data.lastName || data.lastName.trim().length === 0) {
    errors.push('Last name is required');
  } else if (data.lastName.length > 100) {
    errors.push('Last name must be 100 characters or less');
  } else if (!/^[a-zA-Z\s\-'.]+$/.test(data.lastName)) {
    errors.push('Last name contains invalid characters');
  }

  // Email validation (optional but must be valid if provided)
  if (data.email && data.email.trim().length > 0) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      errors.push('Invalid email format');
    } else if (data.email.length > 254) {
      errors.push('Email must be 254 characters or less');
    }
  }

  // Phone validation (optional but must be valid if provided)
  if (data.phone && data.phone.trim().length > 0) {
    const digitsOnly = data.phone.replace(/\D/g, '');
    if (digitsOnly.length < 10 || digitsOnly.length > 15) {
      errors.push('Phone number must be 10-15 digits');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates task data
 */
export function validateTask(data: {
  title: string;
  dueDate: string;
  description?: string;
}): ValidationResult {
  const errors: string[] = [];

  if (!data.title || data.title.trim().length === 0) {
    errors.push('Task title is required');
  } else if (data.title.length > 255) {
    errors.push('Task title must be 255 characters or less');
  }

  if (!data.dueDate) {
    errors.push('Due date is required');
  } else {
    const date = new Date(data.dueDate);
    if (isNaN(date.getTime())) {
      errors.push('Invalid due date format');
    }
  }

  if (data.description && data.description.length > 5000) {
    errors.push('Description must be 5000 characters or less');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates prayer request data
 */
export function validatePrayerRequest(data: {
  content: string;
  personId: string;
}): ValidationResult {
  const errors: string[] = [];

  if (!data.content || data.content.trim().length === 0) {
    errors.push('Prayer request content is required');
  } else if (data.content.length > 5000) {
    errors.push('Prayer request must be 5000 characters or less');
  }

  if (!data.personId) {
    errors.push('Person is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates giving/donation data
 */
export function validateGiving(data: {
  amount: number;
  personId?: string;
  fund: string;
}): ValidationResult {
  const errors: string[] = [];

  if (typeof data.amount !== 'number' || isNaN(data.amount)) {
    errors.push('Valid amount is required');
  } else if (data.amount <= 0) {
    errors.push('Amount must be greater than 0');
  } else if (data.amount > 1000000000) {
    errors.push('Amount exceeds maximum allowed');
  }

  const validFunds = ['tithe', 'offering', 'missions', 'building', 'other'];
  if (!validFunds.includes(data.fund)) {
    errors.push('Invalid fund type');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates integration credentials format (not values)
 */
export function validateCredentialFormat(type: 'resend' | 'twilio' | 'stripe', value: string): boolean {
  if (!value || typeof value !== 'string') return false;

  switch (type) {
    case 'resend':
      // Resend API keys start with 're_'
      return value.startsWith('re_') && value.length > 10;
    case 'twilio':
      // Twilio Account SID starts with 'AC', Auth Token is 32 chars
      return (value.startsWith('AC') && value.length === 34) || value.length === 32;
    case 'stripe':
      // Stripe keys start with 'sk_' or 'pk_'
      return (value.startsWith('sk_') || value.startsWith('pk_')) && value.length > 20;
    default:
      return false;
  }
}

/**
 * Sanitizes and validates a date string
 */
export function validateDate(dateStr: string): { isValid: boolean; date: Date | null } {
  if (!dateStr) return { isValid: false, date: null };

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return { isValid: false, date: null };
  }

  // Check for reasonable date range (1900-2100)
  const year = date.getFullYear();
  if (year < 1900 || year > 2100) {
    return { isValid: false, date: null };
  }

  return { isValid: true, date };
}

/**
 * Parse a YYYY-MM-DD date string as a local date (not UTC).
 * Avoids the common timezone off-by-one bug where "2026-02-06"
 * parsed via `new Date("2026-02-06")` becomes Feb 5 in US timezones.
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN);
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }
  return new Date(dateStr);
}

/**
 * Format a YYYY-MM-DD date string for display using the local timezone.
 * Returns the formatted date string, or the fallback if the date is invalid.
 */
export function formatLocalDate(dateStr: string | undefined, fallback = 'Unknown'): string {
  if (!dateStr) return fallback;
  const date = parseLocalDate(dateStr);
  if (isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString();
}
