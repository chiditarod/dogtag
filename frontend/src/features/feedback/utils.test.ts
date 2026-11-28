import { describe, expect, it } from 'vitest';
import { feedbackPath } from '@/features/feedback/utils';

describe('feedbackPath', () => {
  it('hides a password reset token', () => {
    expect(feedbackPath('/register/reset-password/abc123XYZ')).toBe(
      '/register/reset-password/[redacted]',
    );
  });

  it('leaves other paths alone', () => {
    expect(feedbackPath('/register/teams/12')).toBe('/register/teams/12');
  });
});
