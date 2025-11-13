import {
  CheckCircleOutlined,
  DatabaseFilled,
  MenuUnfoldOutlined,
  PlayCircleFilled,
  PlusOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { Alert, Button, Checkbox, Tooltip } from 'antd';
import { useLogPart, useLogSection } from 'hooks/useLogInstances';
import { type ReactNode, useCallback, useMemo } from 'react';
import type { Song, UID } from 'types';
import { distributor } from 'utils';
import { NULL } from 'utils/constants';

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
  /**
   * Only available if onSelectParts is present and if any parts has no timestamps
   * Selects the remaining parts with no timestamps
   */
  enableSelectRemainingParts?: boolean;
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
  enableSelectRemainingParts,
}: LogSectionProps) {
  const { name, status, partIds, section } = useLogSection(id, song);
  const { part } = useLogPart(partIds[0], song);

  // Get parts without timestamps
  const remainingParts = useMemo(() => {
    return partIds.filter((partId) => {
      const part = distributor.getPart(partId, song);
      return part && !part.startTime;
    });
  }, [partIds, song]);

  // Check if there are parts without timestamps
  const hasRemainingParts = remainingParts.length > 0;

  const onSelectRemainingParts = useCallback(() => {
    if (onSelectParts) {
      onSelectParts(remainingParts);
    }
  }, [onSelectParts, remainingParts]);

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
        {!!onSelect && <Checkbox checked={selected} onChange={() => onSelect(id)} />}

        {!!onPlay && (
          <Tooltip title={part ? `Play from ${part.startTime} ms` : 'No parts to play'}>
            <Button
              icon={<PlayCircleFilled />}
              onClick={() => onPlay(part.startTime)}
              shape="circle"
              size="small"
            />
          </Tooltip>
        )}

        {onClick ? (
          <Button danger={section?.kind === NULL} icon={icon} onClick={() => onClick(id)} shape="round">
            {name}
          </Button>
        ) : (
          <span>
            {icon} {name}
          </span>
        )}

        {!!onSelectParts && (
          <Tooltip title="Select all parts">
            <Button
              icon={<UnorderedListOutlined />}
              onClick={() => onSelectParts(partIds)}
              shape="circle"
              size="small"
            />
          </Tooltip>
        )}

        {!!onSelectParts && enableSelectRemainingParts && hasRemainingParts && (
          <Tooltip title="Select missing parts">
            <Button
              icon={<MenuUnfoldOutlined />}
              onClick={onSelectRemainingParts}
              shape="circle"
              size="small"
            />
          </Tooltip>
        )}

        {!!onAddLine && (
          <Tooltip title="Add content to section">
            <Button icon={<PlusOutlined />} onClick={() => onAddLine(id)} shape="circle" size="small" />
          </Tooltip>
        )}
      </span>
      <ul className="log-section__lines">{children}</ul>
    </li>
  );
}
