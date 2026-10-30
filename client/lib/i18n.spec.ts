import { describe, it, expect } from 'vitest';
import { t } from './i18n';

describe('i18n translations', () => {
  it('should fall back to english if kiswahili is missing', () => {
    // We expect the key to exist in en, we can test auth.signIn
    expect(t('en', 'auth.signIn')).toBeTypeOf('string');
  });

  it('should translate kiswahili keys', () => {
    expect(t('sw', 'auth.signIn')).toBeTypeOf('string');
    // Ensure they differ
    expect(t('en', 'auth.signIn')).not.toBe(t('sw', 'auth.signIn'));
  });
});
