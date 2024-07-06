import clsx from 'clsx';
import { ReactNode } from 'react';

type ContentProps = {
  children: ReactNode;
  className?: string;
};

export function Content({ children, className }: ContentProps) {
  return <main className={clsx('m-4', className)}>{children}</main>;
}
