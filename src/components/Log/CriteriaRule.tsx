import { Typography } from 'antd';
import { CircleCheckIcon, CircleExclamationPointIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type CriteriaRuleProps = {
  label: ReactNode;
  value: boolean;
};

export function CriteriaRule({ label, value }: CriteriaRuleProps) {
  return (
    <Typography.Text>
      {value ? <CircleCheckIcon /> : <CircleExclamationPointIcon className="log-icon--red" />} {label}
    </Typography.Text>
  );
}
