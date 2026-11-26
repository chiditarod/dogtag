import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

export const PREVIEW_DELAY_MS = 400;

/**
 * The server's rendering of Markdown confirmation text (the same `ConfirmationText.to_html` racers get),
 * asked for once typing pauses. `html` is null for blank text; text over the limit is a 422, which gives no data.
 */
export function useConfirmationPreview(text: string) {
  const [settled, setSettled] = useState(text);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(text), PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const query = useQuery({
    queryKey: ['staff', 'confirmation_preview', settled],
    queryFn: () =>
      apiFetch<{ html: string | null }>('/staff/confirmation_preview', { method: 'POST', json: { text: settled } }),
    enabled: settled.trim() !== '',
    placeholderData: keepPreviousData,
  });
  // Cleared text shows nothing at once, not the previous preview until the delay passes.
  return text.trim() === '' ? null : (query.data?.html ?? null);
}
