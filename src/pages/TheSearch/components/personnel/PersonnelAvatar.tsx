import { UserOutlined } from '@ant-design/icons';
import { Avatar, type AvatarProps } from 'antd';
import type { ReactNode } from 'react';

const personnel: Partial<Record<string, { placeholder: ReactNode; src?: string }>> = {
  'Sargent Miller': {
    placeholder: (
      <svg aria-hidden="true" height="100%" viewBox="0 0 80 80" width="100%">
        <circle cx="40" cy="40" fill="#e1ead9" r="40" />
        <path d="M9 80V70a31 31 0 0 1 62 0v10" fill="#526344" />
        <path d="m29 54 11 10 11-10-5 26H34" fill="#d0d6b5" />
        <ellipse cx="40" cy="33" fill="#bd8864" rx="17" ry="21" />
        <path d="M23 24V14h34v10z" fill="#526344" />
        <path d="M16 25h48l-8 5H24z" fill="#37452f" />
        <circle cx="34" cy="35" fill="#372d28" r="2" />
        <circle cx="46" cy="35" fill="#372d28" r="2" />
        <path d="M34 45h12" stroke="#754d3a" strokeLinecap="round" strokeWidth="2" />
        <path d="m38 65 4 0-1 12h-2z" fill="#d9c075" />
      </svg>
    ),
  },
  'Mike Philip': {
    placeholder: (
      <svg aria-hidden="true" height="100%" viewBox="0 0 80 80" width="100%">
        <circle cx="40" cy="40" fill="#e9ddfa" r="40" />
        <path d="M12 80V69a28 28 0 0 1 56 0v11" fill="#574078" />
        <path d="m31 53 9 13 9-13" fill="#fff" />
        <ellipse cx="40" cy="32" fill="#dba57e" rx="17" ry="21" />
        <path d="M23 30V20c0-17 35-17 35 2v8L46 19 23 25" fill="#49352e" />
        <circle cx="34" cy="33" fill="#49352e" r="2" />
        <circle cx="46" cy="33" fill="#49352e" r="2" />
        <path d="M34 43q6 6 12 0" fill="none" stroke="#8c5347" strokeWidth="2" />
        <rect fill="#c4b5d5" height="18" rx="5" width="9" x="57" y="53" />
        <path d="M61.5 71v9" stroke="#c4b5d5" strokeWidth="3" />
      </svg>
    ),
  },
  'John Stan': {
    placeholder: (
      <svg aria-hidden="true" height="100%" viewBox="0 0 80 80" width="100%">
        <circle cx="40" cy="40" fill="#f8e7ce" r="40" />
        <path d="M10 80V70a30 30 0 0 1 60 0v10" fill="#775a3e" />
        <ellipse cx="40" cy="33" fill="#ad7655" rx="17" ry="21" />
        <path d="M23 29V21c0-18 34-18 34 0v8l-8-9-26 5" fill="#302a28" />
        <circle cx="34" cy="33" fill="#302a28" r="2" />
        <circle cx="46" cy="33" fill="#302a28" r="2" />
        <path d="M34 44h12" stroke="#704433" strokeLinecap="round" strokeWidth="2" />
        <path d="M19 34V26a21 21 0 0 1 42 0v8" fill="none" stroke="#413b38" strokeWidth="5" />
        <rect fill="#413b38" height="16" rx="4" width="8" x="15" y="29" />
        <rect fill="#413b38" height="16" rx="4" width="8" x="57" y="29" />
      </svg>
    ),
  },
  'Megan Ryder': {
    placeholder: (
      <svg aria-hidden="true" height="100%" viewBox="0 0 80 80" width="100%">
        <circle cx="40" cy="40" fill="#f8dfe9" r="40" />
        <path d="M17 64V29c0-32 46-32 46 0v35" fill="#723c32" />
        <path d="M10 80V72a30 30 0 0 1 60 0v8" fill="#a43e6a" />
        <ellipse cx="40" cy="33" fill="#efbd9f" rx="17" ry="21" />
        <path d="M22 30V22c0-19 36-19 36 3L45 15 22 30" fill="#723c32" />
        <circle cx="34" cy="34" fill="#56352f" r="2" />
        <circle cx="46" cy="34" fill="#56352f" r="2" />
        <path d="M34 44q6 5 12 0" fill="none" stroke="#b35765" strokeWidth="2" />
        <circle cx="22" cy="42" fill="#e6bc62" r="3" />
        <circle cx="58" cy="42" fill="#e6bc62" r="3" />
      </svg>
    ),
  },
  'Michael Lion': {
    placeholder: (
      <svg aria-hidden="true" height="100%" viewBox="0 0 80 80" width="100%">
        <circle cx="40" cy="40" fill="#dcebf5" r="40" />
        <path d="M10 80V70a30 30 0 0 1 60 0v10" fill="#354e68" />
        <path d="m29 54 11 6 11-6-6 26H35" fill="#fff" />
        <path d="m40 60 4 5-2 15h-4l-2-15" fill="#8f4d63" />
        <ellipse cx="40" cy="32" fill="#c68e6b" rx="17" ry="21" />
        <path d="M23 28V20c0-17 34-17 34 0v8l-9-11-25 7" fill="#59575b" />
        <path d="M26 32h11v7H26zm17 0h11v7H43zm-6 2h6" fill="none" stroke="#35404b" strokeWidth="2" />
        <path d="M35 45h10" stroke="#845544" strokeLinecap="round" strokeWidth="2" />
      </svg>
    ),
  },
};

export function PersonnelAvatar({
  name,
  size = 72,
  src,
  ...props
}: { name: string } & Omit<AvatarProps, 'children' | 'icon' | 'alt'>) {
  const person = personnel[name];
  return (
    <Avatar
      {...props}
      alt={name}
      aria-label={`${name} portrait`}
      icon={person?.placeholder ?? <UserOutlined />}
      size={size}
      src={src ?? person?.src}
    />
  );
}
