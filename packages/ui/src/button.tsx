import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

export type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'quiet' }
>;

export function Button({
  children,
  className,
  tone = 'primary',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={['ds-button', `ds-button--${tone}`, className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </button>
  );
}
