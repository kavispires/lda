import { Result } from 'antd';
import { PropsWithChildren } from 'react';

export function ContentNotFound({ children }: PropsWithChildren) {
  return <Result status="404" title="Not Found" subTitle={children} />;
}
