import type { CollapseProps } from 'antd';
import { Collapse } from 'antd';

export function NudgeSongCollapse() {
  const items: CollapseProps['items'] = [
    {
      key: '1',
      label: 'Nudge Song',
      children: <p>{''}</p>,
    },
  ];

  return <Collapse items={items} size="small" />;
}
