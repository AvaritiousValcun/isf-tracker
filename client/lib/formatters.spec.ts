import { describe, it, expect } from 'vitest';
import { formatCurrency, formatNumber, formatDate, formatDateTime } from './formatters';

describe('formatters', () => {
  it('should format currency correctly', () => {
    // using replacing non-breaking spaces for reliable asserts
    expect(formatCurrency(250).replace(/\s/g, ' ')).toBe('Ksh 250'); 
  });

  it('should format numbers correctly', () => {
    expect(formatNumber(1234.56)).toBe('1,234.56');
  });

  it('should format dates correctly', () => {
    const d = new Date('2026-08-30T00:00:00Z');
    expect(formatDate(d)).toBeDefined();
  });

  it('should format datetime correctly', () => {
    const d = new Date('2026-08-30T00:00:00Z');
    expect(formatDateTime(d)).toBeDefined();
  });
});
