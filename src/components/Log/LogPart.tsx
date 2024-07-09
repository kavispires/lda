import { Button, Checkbox } from 'antd';
import { useLogPart } from 'hooks/useLogInstances';
import { UID } from 'types';

import { ApiFilled, ApiOutlined, CheckCircleOutlined, NotificationFilled } from '@ant-design/icons';
import { ASSIGNEES } from 'utils/constants';

type LogPartProps = {
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
};

export function LogPart({ id, onClick, onSelect, selected, onConnect }: LogPartProps) {
  const {
    part: { text, recommendedAssignee },
    status,
    duration,
  } = useLogPart(id);
  const color = ASSIGNEES[recommendedAssignee].color;

  const icon =
    status === 'complete' ? <CheckCircleOutlined className="log-icon--green" /> : <NotificationFilled />;

  return (
    <li className="log-part" style={{ background: color }}>
      {!!onSelect && <Checkbox onChange={() => onSelect(id)} checked={selected} />}

      {!!onClick ? (
        <Button size="small" type="text" onClick={() => onClick(id)} icon={icon}>
          {text}
        </Button>
      ) : (
        <span>
          {icon} {text}
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
    </li>
  );
}
