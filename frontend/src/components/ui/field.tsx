import {
  cloneElement,
  isValidElement,
  useId,
  type ComponentPropsWithRef,
  type ReactElement,
  type ReactNode,
} from 'react';

export interface FieldControlProps {
  id: string;
  name: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
}

interface FieldProps {
  label: string;
  name: string;
  /** Server-side messages, e.g. `ApiError.errors[name]`. */
  error?: string[];
  /** Slot for an InfoTip rendered beside the label. */
  hint?: ReactNode;
  /** An input element (gets id/name/aria props injected) or a render function. */
  children: ReactElement | ((props: FieldControlProps) => ReactNode);
  className?: string;
}

const inputClass =
  'block min-h-11 w-full rounded-md border border-flag bg-white px-3 py-2 font-sans text-base text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-link aria-[invalid=true]:border-star';

export function Input({
  className = '',
  ...props
}: ComponentPropsWithRef<'input'>) {
  return <input className={`${inputClass} ${className}`} {...props} />;
}

export function Field({
  label,
  name,
  error,
  hint,
  children,
  className = '',
}: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hasError = !!error?.length;
  const control: FieldControlProps = {
    id,
    name,
    'aria-invalid': hasError ? true : undefined,
    'aria-describedby': hasError ? errorId : undefined,
  };

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center gap-1">
        <label htmlFor={id} className="text-sm font-semibold text-navy">
          {label}
        </label>
        {hint}
      </div>
      {typeof children === 'function'
        ? children(control)
        : isValidElement(children)
          ? cloneElement(children, control as Partial<FieldControlProps>)
          : children}
      {hasError && (
        <ul id={errorId} className="space-y-0.5 text-sm text-starText">
          {error.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
