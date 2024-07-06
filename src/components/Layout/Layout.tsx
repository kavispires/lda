import './Layout.scss';

import { Layout as AntLayout } from 'antd';
import { ReactNode } from 'react';
import { useAuthContext } from 'services/AuthProvider';

import { AuthWrapper } from './AuthWrapper';
import { Menu } from './Menu';

type LayoutProps = {
  /**
   * The content to render in the chrome.
   */
  children: ReactNode;
};

export function Layout({ children }: LayoutProps) {
  const { isAuthenticated } = useAuthContext();

  return (
    <AntLayout className="chrome">
      {isAuthenticated && <Menu />}
      <AntLayout className="chrome-layout">
        <AntLayout.Content className="chrome-layout-content">
          <AuthWrapper>{children}</AuthWrapper>
        </AntLayout.Content>
      </AntLayout>
    </AntLayout>
  );
}
