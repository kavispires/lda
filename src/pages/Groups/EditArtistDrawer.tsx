import { EditOutlined } from '@ant-design/icons';
import { Button, Drawer } from 'antd';
import { useToggle } from 'react-use';
import type { Artist, Group } from 'types';

import { EditArtistForm } from './EditArtistForm';

type EditArtistDrawerProps = {
  artist: Artist;
  group: Group;
};

export function EditArtistDrawer({ artist, group }: EditArtistDrawerProps) {
  const [open, toggleOpen] = useToggle(false);

  return (
    <>
      <Button icon={<EditOutlined />} onClick={() => toggleOpen(true)} size="small" type="text">
        Edit
      </Button>
      <Drawer onClose={() => toggleOpen(false)} open={open} title={`Edit ${artist.name}`}>
        <EditArtistForm artist={artist} group={group} onClose={() => toggleOpen(false)} />
      </Drawer>
    </>
  );
}
