/**
 * Form validation helpers.
 */

export function isRequired(value: string | undefined | null): string | undefined {
  if (!value || value.trim().length === 0) return 'Kinakailangan ito';
  return undefined;
}

export function isMinLength(min: number) {
  return (value: string): string | undefined => {
    if (value.length < min) return `Hindi bababa sa ${min} na karakter`;
    return undefined;
  };
}

export function isMaxLength(max: number) {
  return (value: string): string | undefined => {
    if (value.length > max) return `Hindi hihigit sa ${max} na karakter`;
    return undefined;
  };
}

export function isPhilippinePhone(value: string): string | undefined {
  const digits = value.replace(/\D/g, '');
  if (!/^9\d{9}$/.test(digits) && !/^09\d{9}$/.test(digits)) {
    return 'Mali ang format ng numero';
  }
  return undefined;
}

export function isPositiveAmount(value: string): string | undefined {
  const num = parseFloat(value);
  if (isNaN(num) || num <= 0) return 'Kailangang positibo ang halaga';
  return undefined;
}
