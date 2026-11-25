/** Announces the number of matching rows once a response settles; empty while one loads. */
export function ResultCount({ message }: { message?: string }) {
  return (
    <p role="status" className="sr-only">
      {message ?? ''}
    </p>
  );
}
