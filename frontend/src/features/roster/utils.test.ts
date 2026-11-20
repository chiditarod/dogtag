import { describe, expect, it } from 'vitest';
import { emptyDraft, payloadFromDraft } from '@/features/roster/utils';

describe('payloadFromDraft', () => {
  const draft = {
    first_name: '  Dee ',
    last_name: ' Lamb  ',
    email: '  Dee@Example.COM ',
    phone: '(312) 555-0144',
    experience: '2',
    instagram: ' @dee ',
    tiktok: ' @Dee.Lamb ',
  };

  it('trims every field, lowercases the email and converts the phone', () => {
    expect(payloadFromDraft(draft)).toEqual({
      first_name: 'Dee',
      last_name: 'Lamb',
      email: 'dee@example.com',
      phone: '312-555-0144',
      experience: 2,
      instagram: '@dee',
      tiktok: '@Dee.Lamb',
    });
  });

  it('keeps the first years label as 0', () => {
    expect(payloadFromDraft({ ...draft, experience: '0' }).experience).toBe(0);
  });

  it('sends null, not 0, for a blank years value', () => {
    expect(payloadFromDraft({ ...draft, experience: '' }).experience).toBeNull();
    expect(payloadFromDraft(emptyDraft).experience).toBeNull();
  });
});
