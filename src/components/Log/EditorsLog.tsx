import { Button, Divider } from 'antd';
import clsx from 'clsx';
import { useSongActions } from 'hooks/useSongActions';
import { useState } from 'react';
import { useSongEditContext } from 'services/SongEditProvider';
import { UID } from 'types';
import { distributor, getInstanceName } from 'utils';

import { EditDrawer } from './EditDrawer';
import { LogLine } from './LogLine';
import { LogPart } from './LogPart';
import { LogSection } from './LogSection';
import { useSelectionIdModel } from 'hooks/useSelectionIdModel';

type LogProps = {
  className?: string;
};

export function EditorsLog({ className }: LogProps) {
  const { song } = useSongEditContext();
  const { onAddNewPart } = useSongActions();
  const { selection, onSelect, onSelectMany, onDeselectAll } = useSelectionIdModel([]);
  const [drawerOpen, setDrawerOpen] = useState<UID[]>([]);

  const onEntityClick = (id: UID) => {
    setDrawerOpen([id]);
  };

  const onClose = () => {
    setDrawerOpen([]);
    onDeselectAll();
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
                onAddPart={onAddNewPart}
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
