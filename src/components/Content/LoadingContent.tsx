import { Spin } from 'antd';

export function LoadingContent() {
  return (
    <Spin tip="Loading..." size="large">
      <div className="my-4" style={{ width: '100%', height: '300px' }}></div>
    </Spin>
  );
}
