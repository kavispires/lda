import { ApiFilled, ApiOutlined, CheckCircleOutlined, NotificationFilled } from '@ant-design/icons';
import { Alert, Button, Checkbox } from 'antd';
import { useLogPart } from 'hooks/useLogInstances';
import type { ReactNode } from 'react';
import type { Song, UID } from 'types';
import { ASSIGNEES } from 'utils/constants';

type LogPartProps = {
  /**
   * The current song
   */
  song: Song;
  /**
   * The unique identifier of the part.
   */
  id: UID;
  /**
   * The function to call when the part is clicked
   **/
  onClick?: (partId: string) => void;
  /**
   * The function to call when the part is selected
   * If present, the checkbox is displayed
   */
  onSelect?: (partId: string) => void;
  /**
   * Flag indicating if the part is selected
   * Only used if onSelect is provided
   */
  selected?: boolean;
  /**
   *
   */
  onConnect?: (partId: string) => void;
  /**
   * The element to display after the part text
   */
  after?: ReactNode;
  /**
   * Flag indicating if the status icon should be hidden
   */
  hideStatusIcon?: boolean;
  /**
   * Flag indicating if the recommended assignee color should be displayed
   */
  color?: string;
};

export function LogPart({
  id,
  song,
  onClick,
  onSelect,
  selected,
  onConnect,
  after = null,
  hideStatusIcon = false,
  color,
}: LogPartProps) {
  const { part, status, duration } = useLogPart(id, song);
  const bgColor = color ?? ASSIGNEES[part.recommendedAssignee].color;

  if (!part || !part.id)
    return (
      <li className="log-section">
        <Alert message="Line doesn't exist" type="error" />
      </li>
    );

  const icon = hideStatusIcon ? null : status === 'complete' ? (
    <CheckCircleOutlined className="log-icon--green" />
  ) : (
    <NotificationFilled />
  );

  return (
    <li className="log-part" style={{ background: bgColor }}>
      {!!onSelect && <Checkbox onChange={() => onSelect(id)} checked={selected} />}

      {onClick ? (
        <Button size="small" type="text" onClick={() => onClick(id)} icon={icon}>
          {part.text}
        </Button>
      ) : (
        <span>
          {icon} {part.text}
        </span>
      )}

      {!!onConnect && (
        <Button
          size="small"
          shape="circle"
          icon={duration > 0 ? <ApiFilled /> : <ApiOutlined />}
          onClick={() => onConnect(id)}
        />
      )}

      {after}
    </li>
  );
}
