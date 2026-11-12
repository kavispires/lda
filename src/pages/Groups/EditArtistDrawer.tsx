import type { Artist, Group } from '@types';
import { Button, Drawer } from 'antd';
import { PencilIcon } from 'lucide-react';
import { useToggle } from 'react-use';

import { EditArtistForm } from './EditArtistForm';

type EditArtistDrawerProps = {
  artist: Artist;
  group: Group;
};

export function EditArtistDrawer({ artist, group }: EditArtistDrawerProps) {
  const [open, toggleOpen] = useToggle(false);

  return (
    <>
      <Button icon={<PencilIcon />} onClick={() => toggleOpen(true)} size="small" type="text">
        Edit
      </Button>
      <Drawer onClose={() => toggleOpen(false)} open={open} title={`Edit ${artist.name}`}>
        <EditArtistForm artist={artist} group={group} onClose={() => toggleOpen(false)} />
      </Drawer>
    </>
  );
}
