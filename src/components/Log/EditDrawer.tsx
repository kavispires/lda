import { Drawer } from 'antd';
import { useState } from 'react';
import type { UID } from 'types';
import { getInstanceName } from 'utils';
import { EditLineForm } from './EditLineForm';
import { EditPartForm } from './EditPartForm';
import { EditPartsForm } from './EditPartsForm';
import { EditSectionForm } from './EditSectionForm';
import { EditSectionsForm } from './EditSectionsForm';

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
      {instanceType === 'sections' && <EditSectionsForm sectionsIds={activeIds} {...props} />}
    </Drawer>
  );
}
