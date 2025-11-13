import { Button, Drawer } from 'antd';
import { useToggle } from 'react-use';
import type { Group } from 'types';

import { NewArtistForm } from './NewArtistForm';

type NewArtistDrawerProps = {
  group: Group;
};

export function NewArtistDrawer({ group }: NewArtistDrawerProps) {
  const [open, toggleOpen] = useToggle(false);

  return (
    <>
      <Button onClick={() => toggleOpen(true)}>Add Artist</Button>
      <Drawer onClose={() => toggleOpen(false)} open={open}>
        <NewArtistForm group={group} onClose={() => toggleOpen(false)} />
      </Drawer>
    </>
  );
}
