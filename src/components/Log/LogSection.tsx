import {
  CheckCircleOutlined,
  CopyOutlined,
  DatabaseFilled,
  MenuUnfoldOutlined,
  PlayCircleFilled,
  PlusOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { useLogPart, useLogSection } from '@hooks/useLogInstances';
import type { Song, UID } from '@types';
import { distributor } from '@utils';
import { NULL } from '@utils/constants';
import { Alert, Button, Checkbox, Popconfirm, Tooltip } from 'antd';
import { type ReactNode, useCallback, useMemo } from 'react';

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
   * The function to call when the section is copied
   */
  onCopy?: (sectionId: string) => void;
  /**
   * The function to call when the section is pasted
   */
  onPaste?: (sectionId: string) => void;
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
  /**
   * Override the completion status for the icon display
   * When provided, this takes precedence over the status check
   */
  overrideComplete?: boolean | 'partial' | 'complete' | 'incomplete';
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
  onCopy,
  onPaste,
  enableSelectRemainingParts,
  overrideComplete,
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

  const icon = useMemo(() => {
    if (overrideComplete === 'complete') return <CheckCircleOutlined className="log-icon--green" />;
    if (overrideComplete === 'partial') return <CheckCircleOutlined className="log-icon--orange" />;
    if (overrideComplete === 'incomplete') return <DatabaseFilled className="log-icon--yellow" />;
    if (status === 'complete') return <CheckCircleOutlined className="log-icon--green" />;
    return <DatabaseFilled />;
  }, [overrideComplete, status]);

  if (!section?.id)
    return (
      <li className="log-section">
        <Alert title="Section doesn't exist" type="error" />
      </li>
    );

  return (
    <li className="log-section">
      <span className="log-section__section-header">
        <span className="log-section__section-header-actions">
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
            <Tooltip title={section.id} trigger="click">
              <span>
                {icon} {name}
              </span>
            </Tooltip>
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
        </span>
        <span className="log-section__section-header-actions">
          {!!onAddLine && (
            <Tooltip title="Add content to section">
              <Button icon={<PlusOutlined />} onClick={() => onAddLine(id)} shape="round" size="small" />
            </Tooltip>
          )}

          {!!onCopy && (
            <Tooltip title="Copy section">
              <Button
                disabled={!overrideComplete || overrideComplete === 'incomplete'}
                icon={<CopyOutlined />}
                onClick={() => onCopy(id)}
                size="small"
              />
            </Tooltip>
          )}

          {!!onPaste && (
            <Popconfirm
              onConfirm={() => onPaste(id)}
              title="Are you sure you want to paste the copied section here?"
            >
              <Button icon={<i className="fi fi-rr-paste"></i>} size="small" />
            </Popconfirm>
          )}
        </span>
      </span>
      <ul className="log-section__lines">{children}</ul>
    </li>
  );
}
