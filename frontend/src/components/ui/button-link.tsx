import type { AnchorHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { buttonClasses, type Variant } from '@/components/ui/button';

type RouterProps = Omit<LinkProps, 'className'>;
type AnchorProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className'> & { href: string };

type ButtonLinkProps = { variant?: Variant; className?: string } & (
  | (RouterProps & { href?: undefined })
  | (AnchorProps & { to?: undefined })
);

/**
 * A link that looks like a `Button`. Pass `to` for a route inside the SPA, or `href` for a plain anchor
 * (legacy pages, API downloads, mailto), which the router must not handle.
 */
export function ButtonLink({ variant = 'primary', className = '', ...props }: ButtonLinkProps) {
  const classes = buttonClasses(variant, className);
  if (props.to !== undefined) return <Link {...props} className={classes} />;
  return <a {...props} className={classes} />;
}
