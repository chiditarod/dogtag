interface ConfirmationTextProps {
  /** Server-sanitized HTML from the race's confirmation text (safe to inject). */
  html: string | null;
  className?: string;
}

export function ConfirmationText({ html, className = '' }: ConfirmationTextProps) {
  if (!html) return null;
  return (
    <div
      data-testid="confirmation-text"
      className={`space-y-2 text-sm [overflow-wrap:anywhere] [&_a]:text-link [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
