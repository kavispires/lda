import { Alert, Result } from 'antd';
import type { PropsWithChildren } from 'react';

export function ContentError({ children }: PropsWithChildren) {
  return (
    <Result
      extra={<Alert message={children} type="error" />}
      status="500"
      subTitle="Sorry, something went wrong."
      title="Error"
    />
  );
}
