import { Spin } from 'antd';
import type { ReactNode } from 'react';

type LoadingContentProps = {
  children?: ReactNode;
};

export function ContentLoading({ children }: LoadingContentProps) {
  return (
    <Spin size="large" tip={children ?? 'Loading...'}>
      <div className="my-4" style={{ width: '100%', height: '300px' }}></div>
    </Spin>
  );
}
