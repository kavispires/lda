import { Alert, Result } from 'antd';
import { PropsWithChildren } from 'react';

export function ContentError({ children }: PropsWithChildren) {
  return (
    <Result
      status="500"
      title="Error"
      subTitle="Sorry, something went wrong."
      extra={<Alert type="error" message={children} />}
    />
  );
}
