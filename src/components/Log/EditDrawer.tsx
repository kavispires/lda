import { Drawer } from 'antd';
import type { UID } from 'types';
import { getInstanceName } from 'utils';
import { EditPartForm } from './EditPartForm';
import { useState } from 'react';
import { EditLineForm } from './EditLineForm';
import { EditSectionForm } from './EditSectionForm';
import { EditPartsForm } from './EditPartsForm';

type EditDrawerProps = {
  onClose: () => void;
  activeIds: UID[];
};

export function EditDrawer({ onClose, activeIds }: EditDrawerProps) {
  const instanceType = getInstanceName(activeIds);
  const [isDirty, setDirty] = useState(false);

  const props = {
    onClose,
    setDirty,
  };

  return (
    <Drawer
      title={`Editing ${getInstanceName(activeIds)}: ${activeIds.join(', ')}`}
      onClose={onClose}
      open={!!activeIds.length}
      maskClosable={!isDirty}
    >
      {instanceType === 'section' && <EditSectionForm sectionId={activeIds[0]} {...props} />}
      {instanceType === 'line' && <EditLineForm lineId={activeIds[0]} {...props} />}
      {instanceType === 'part' && <EditPartForm partId={activeIds[0]} {...props} />}

      {instanceType === 'parts' && <EditPartsForm partsIds={activeIds} {...props} />}
    </Drawer>
  );
}
