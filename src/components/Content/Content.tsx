import clsx from 'clsx';
import { forwardRef, ReactNode } from 'react';

type ContentProps = {
  children: ReactNode;
  className?: string;
};

export const Content = forwardRef<HTMLElement, ContentProps>(({ children, className }, ref) => {
  return (
    <main ref={ref} className={clsx('m-4', className)}>
      {children}
    </main>
  );
});
