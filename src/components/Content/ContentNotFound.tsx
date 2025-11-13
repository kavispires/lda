import { Result } from 'antd';
import type { PropsWithChildren } from 'react';

export function ContentNotFound({ children }: PropsWithChildren) {
  return <Result status="404" subTitle={children} title="Not Found" />;
}
