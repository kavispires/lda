import { Button, Drawer } from 'antd';
import { useToggle } from 'react-use';

import { NewGroupForm } from './NewGroupForm';

export function NewGroupDrawer() {
  const [open, toggleOpen] = useToggle(false);

  return (
    <>
      <Button onClick={() => toggleOpen(true)}>Add Group</Button>
      <Drawer open={open} onClose={() => toggleOpen(false)}>
        <NewGroupForm onClose={() => toggleOpen(false)} />
      </Drawer>
    </>
  );
}
