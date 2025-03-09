import { Alert, Button, Checkbox } from 'antd';
import { useLogPart, useLogSection } from 'hooks/useLogInstances';
import type { ReactNode } from 'react';
import type { Song, UID } from 'types';

import {
  CheckCircleOutlined,
  DatabaseFilled,
  PlayCircleFilled,
  PlusOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';

type LogSectionProps = {
  /**
   * The current song
   */
  song: Song;
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
   * The function to call to trigger the play of the section
   */
  onPlay?: (startTime: number) => void;
  /**
   * The function to call to add a new line to the section
   */
  onAddLine?: (sectionId: UID) => void;
};

export function LogSection({
  id,
  song,
  onClick,
  onSelect,
  selected,
  children,
  onSelectParts,
  onPlay,
  onAddLine,
}: LogSectionProps) {
  const { name, status, partIds, section } = useLogSection(id, song);
  const { part } = useLogPart(partIds[0], song);

  if (!section || !section.id)
    return (
      <li className="log-section">
        <Alert message="Section doesn't exist" type="error" />
      </li>
    );

  const icon =
    status === 'complete' ? <CheckCircleOutlined className="log-icon--green" /> : <DatabaseFilled />;

  return (
    <li className="log-section">
      <span className="log-section__section">
        {!!onSelect && <Checkbox onChange={() => onSelect(id)} checked={selected} />}

        {!!onPlay && (
          <Button
            size="small"
            shape="circle"
            icon={<PlayCircleFilled />}
            onClick={() => onPlay(part.startTime)}
          />
        )}

        {onClick ? (
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

        {!!onAddLine && (
          <Button size="small" shape="circle" icon={<PlusOutlined />} onClick={() => onAddLine(id)} />
        )}
      </span>
      <ul className="log-section__lines">{children}</ul>
    </li>
  );
}
