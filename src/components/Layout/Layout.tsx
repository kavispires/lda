import { Layout as AntLayout } from 'antd';
import { useAuthContext } from 'hooks/useAuthContext';
import { ReactNode } from 'react';

import { Menu } from './Menu';
import { AuthWrapper } from './AuthWrapper';
import './Layout.scss';

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
