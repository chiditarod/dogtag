import type { AnchorHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { buttonClasses, type Variant } from '@/components/ui/button';

type ButtonLinkProps = { variant?: Variant } & (
  | (Omit<LinkProps, 'className'> & { to: LinkProps['to']; href?: never; className?: string })
  | (Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className'> & {
      href: string;
      to?: never;
      className?: string;
    })
);

/**
 * A link that looks like a `Button`. Pass `to` for a route inside the SPA, or `href` for a plain anchor
 * (legacy pages, API downloads, mailto), which the router must not handle.
 */
export function ButtonLink({ variant = 'primary', className = '', ...props }: ButtonLinkProps) {
  const classes = buttonClasses(variant, className);
  if ('to' in props && props.to !== undefined) {
    const { to, href: _href, ...rest } = props;
    return <Link to={to} className={classes} {...rest} />;
  }
  const { to: _to, ...rest } = props;
  return <a className={classes} {...rest} />;
}
