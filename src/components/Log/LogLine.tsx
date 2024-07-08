import { CheckCircleOutlined, MessageFilled, PlusOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Button, Checkbox } from 'antd';
import { useLogLine } from 'hooks/useLogInstances';
import { ReactNode } from 'react';
import { UID } from 'types';

type LogLineProps = {
  /**
   * The unique identifier of the line.
   */
  id: UID;
  /**
   * The function to call when the line is clicked
   **/
  onClick?: (lineId: UID) => void;
  /**
   * The function to call when the line is selected
   * If present, the checkbox is displayed
   */
  onSelect?: (lineId: UID) => void;
  /**
   * Flag indicating if the line is selected
   * Only used if onSelect is provided
   */
  selected?: boolean;
  /**
   * The children of the line (usually its parts)
   */
  children: ReactNode;
  /**
   * The function to call to select all parts belonging to the line
   */
  onSelectParts?: (partsIds: UID[]) => void;
  /**
   * the function to call to add a new part to the line
   */
  onAddPart?: (lineId: UID) => void;
};

export function LogLine({
  id,
  onClick,
  onSelect,
  selected,
  children,
  onSelectParts,
  onAddPart,
}: LogLineProps) {
  const { text, status, line } = useLogLine(id);

  return (
    <li className="log-line">
      <span className="log-line__line">
        {!!onSelect && <Checkbox onChange={() => onSelect(id)} checked={selected} />}
        {status === 'complete' ? <CheckCircleOutlined className="log-icon--green" /> : <MessageFilled />}

        {!!onClick ? (
          <Button onClick={() => onClick(id)} type="text" className="log-line__line-text">
            {text}
          </Button>
        ) : (
          <span className="log-line__line-text">{text}</span>
        )}

        {!!onSelectParts && (
          <Button
            size="small"
            shape="circle"
            icon={<UnorderedListOutlined />}
            onClick={() => onSelectParts(line.partsIds)}
          />
        )}

        {!!onAddPart && (
          <Button size="small" shape="circle" icon={<PlusOutlined />} onClick={() => onAddPart(id)} />
        )}
      </span>
      <ul className="log-line__parts">{children}</ul>
    </li>
  );
}
