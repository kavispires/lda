import { CheckCircleOutlined, DatabaseFilled } from '@ant-design/icons';
import { Button, Checkbox } from 'antd';
import { useLogSection } from 'hooks/useLogInstances';
import { ReactNode } from 'react';
import { UID } from 'types';

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
};

export function LogSection({ id, onClick, onSelect, selected, children }: LogSectionProps) {
  const { name, status } = useLogSection(id);

  const icon =
    status === 'complete' ? <CheckCircleOutlined className="log-icon--green" /> : <DatabaseFilled />;

  return (
    <li className="log-section">
      <span className="log-section__section">
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
      </span>
      <ul className="log-section__lines">{children}</ul>
    </li>
  );
}
