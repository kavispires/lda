import { Button, Checkbox } from 'antd';
import { useLogPart, useLogSection } from 'hooks/useLogInstances';
import { ReactNode } from 'react';
import { UID } from 'types';

import {
  CheckCircleOutlined,
  DatabaseFilled,
  PlayCircleFilled,
  UnorderedListOutlined,
} from '@ant-design/icons';

type LogSectionProps = {
  /**
   * The unique identifier of the section.
   */
  id: UID;
  /**
   * The function to call when the section is clicked
   **/
  onClick?: (sectionId: string) => void;
  /**
   * The function to call when the section is selected
   * If present, the checkbox is displayed
   */
  onSelect?: (sectionId: string) => void;
  /**
   * Flag indicating if the section is selected
   * Only used if onSelect is provided
   */
  selected?: boolean;
  /**
   * The children of the section (usually its lines)
   */
  children: ReactNode;
  /**
   * The function to call to select all parts belonging to the line
   */
  onSelectParts?: (partsIds: UID[]) => void;
  /**
   *
   */
  onPlay?: (startTime: number) => void;
};

export function LogSection({
  id,
  onClick,
  onSelect,
  selected,
  children,
  onSelectParts,
  onPlay,
}: LogSectionProps) {
  const { name, status, partIds } = useLogSection(id);
  const { part } = useLogPart(partIds[0]);

  const icon =
    status === 'complete' ? <CheckCircleOutlined className="log-icon--green" /> : <DatabaseFilled />;

  return (
    <li className="log-section">
      <span className="log-section__section">
        {!!onPlay && (
          <Button
            size="small"
            shape="circle"
            icon={<PlayCircleFilled />}
            onClick={() => onPlay(part.startTime)}
          />
        )}

        {!!onSelect && <Checkbox onChange={() => onSelect(id)} checked={selected} />}

        {!!onClick ? (
          <Button role="button" onClick={() => onClick(id)} shape="round" icon={icon}>
            {name}
          </Button>
        ) : (
          <span>
            {icon} {name}
          </span>
        )}

        {!!onSelectParts && (
          <Button
            size="small"
            shape="circle"
            icon={<UnorderedListOutlined />}
            onClick={() => onSelectParts(partIds)}
          />
        )}
      </span>
      <ul className="log-section__lines">{children}</ul>
    </li>
  );
}
