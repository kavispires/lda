import { Button, Divider } from 'antd';
import clsx from 'clsx';
import { useSongEditContext } from 'services/SongEditProvider';
import { LogSection } from './LogSection';
import { UID } from 'types';
import { useState } from 'react';
import { LogLine } from './LogLine';
import { distributor, getInstanceName, removeDuplicates } from 'utils';
import { LogPart } from './LogPart';
import { EditDrawer } from './EditDrawer';

type LogProps = {
  className?: string;
};

export function EditorsLog({ className }: LogProps) {
  const { song } = useSongEditContext();
  const [selection, setSelection] = useState<UID[]>([]);
  const [drawerOpen, setDrawerOpen] = useState<UID[]>([]);

  const onSelect = (id: UID) => {
    if (selection.includes(id)) {
      setSelection(selection.filter((selectedId) => selectedId !== id));
      return;
    }

    if (selection.length === 0) {
      setSelection([id]);
      return;
    }

    if (selection[0][1] === id[1]) {
      setSelection((prevSelection) => [...prevSelection, id]);
      return;
    }

    setSelection([id]);
  };

  const onSelectMany = (ids: UID[]) => {
    console.log(ids);
    if (selection.length === 0) {
      setSelection([...ids]);
      return;
    }

    if (selection[0][1] === ids[0][1]) {
      setSelection((prevSelection) => removeDuplicates([...prevSelection, ...ids]));
      return;
    }
  };

  const onDeselectAll = () => setSelection([]);

  const onEntityClick = (id: UID) => {
    setDrawerOpen([id]);
  };

  const onClose = () => {
    setDrawerOpen([]);
    setSelection([]);
  };

  const instanceName = getInstanceName(selection);

  return (
    <div className={clsx('log', 'surface', className)} key={song.updatedAt}>
      <header className="grid grid-cols-3">
        <Button type="link" disabled={!selection.length} onClick={() => setDrawerOpen([...selection])}>
          Edit {selection.length} {instanceName}
        </Button>
        <Button type="link" disabled={!selection.length} onClick={onDeselectAll}>
          Deselect {selection.length > 1 ? 'All' : instanceName}
        </Button>
        <Button type="link" disabled={selection.length < 2}>
          Merge {instanceName}
        </Button>
      </header>
      <Divider className="my-1" />
      <ul className="log-sections">
        {song.sectionIds.map((sectionId) => (
          <LogSection
            key={sectionId}
            id={sectionId}
            onClick={onEntityClick}
            onSelect={onSelect}
            selected={selection.includes(sectionId)}
          >
            {distributor.getSection(sectionId, song).linesIds.map((lineId) => (
              <LogLine
                key={lineId}
                id={lineId}
                onClick={onEntityClick}
                onSelect={onSelect}
                selected={selection.includes(lineId)}
                onSelectParts={onSelectMany}
              >
                {distributor.getLine(lineId, song).partsIds.map((partId) => (
                  <LogPart
                    key={partId}
                    id={partId}
                    onClick={onEntityClick}
                    onSelect={onSelect}
                    selected={selection.includes(partId)}
                  />
                ))}
              </LogLine>
            ))}
          </LogSection>
        ))}
      </ul>
      <EditDrawer activeIds={drawerOpen} onClose={onClose} />
    </div>
  );
}
