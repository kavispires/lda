import clsx from 'clsx';
import { forwardRef, type ReactNode } from 'react';

type ContentProps = {
  children: ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLElement>;

export const Content = forwardRef<HTMLElement, ContentProps>(({ children, className, ...props }, ref) => {
  return (
    <main ref={ref} className={clsx('m-4', className)} {...props}>
      {children}
    </main>
  );
});
