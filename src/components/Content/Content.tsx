import clsx from 'clsx';
import { forwardRef, type ReactNode } from 'react';

type ContentProps = {
  children: ReactNode;
  className?: string;
};

export const Content = forwardRef<HTMLElement, ContentProps>(({ children, className }, ref) => {
  return (
    <main className={clsx('m-4', className)} ref={ref}>
      {children}
    </main>
  );
});
