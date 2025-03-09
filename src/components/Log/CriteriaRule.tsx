import { CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { Typography } from 'antd';
import type { ReactNode } from 'react';

type CriteriaRuleProps = {
  label: ReactNode;
  value: boolean;
};

export function CriteriaRule({ label, value }: CriteriaRuleProps) {
  return (
    <Typography.Text>
      {value ? <CheckCircleOutlined /> : <ExclamationCircleOutlined className="log-icon--red" />} {label}
    </Typography.Text>
  );
}
