import { Button, Divider } from 'antd';
import clsx from 'clsx';
import { usePreserveScrollPosition } from 'hooks/usePreserveScrollPosition';
import type { useVideoControls } from 'hooks/useVideoControls';
import { useState } from 'react';
import { useSongEditContext } from 'services/SongEditProvider';
import type { UID } from 'types';
import { distributor, getInstanceName } from 'utils';
import { EditDrawer } from './EditDrawer';
import { LogLine } from './LogLine';
import { LogPart } from './LogPart';
import { LogSection } from './LogSection';

type LogProps = {
  className?: string;
  videoControls: ReturnType<typeof useVideoControls>;
};

export function EditorsLog({ className, videoControls }: LogProps) {
  const {
    song,
    selectionIdModel: { selection, onSelect, onSelectMany, onDeselectAll },
  } = useSongEditContext();
  const [specialModal, setSpecialModal] = useState(false);
  const ref = usePreserveScrollPosition<HTMLUListElement>();

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
      <header
        className="grid grid-cols-2"
        style={
          selection.length > 0
            ? {
                position: 'sticky',
                top: 0,
                zIndex: 10,
                backgroundColor: 'var(--surface-color, #fff)',
              }
            : {}
        }
      >
        <Button type="link" disabled={!selection.length} onClick={() => setDrawerOpen([...selection])}>
          Edit {selection.length} {instanceName}
        </Button>
        <Button type="link" disabled={!selection.length} onClick={onDeselectAll}>
          Deselect {selection.length > 1 ? 'All' : instanceName}
        </Button>
      </header>
      <Divider className="my-1" />
      <ul className="log-sections" ref={ref} key={song.updatedAt}>
        {song.sectionIds.map((sectionId) => (
          <LogSection
            key={sectionId}
            id={sectionId}
            song={song}
            onClick={onEntityClick}
            onSelect={onSelect}
            selected={selection.includes(sectionId)}
            onAddLine={(sectionId) => {
              setSpecialModal(true);
              setDrawerOpen([sectionId]);
            }}
            onPlay={(startTime) => videoControls.seekAndPlay(startTime)}
          >
            {distributor.getSection(sectionId, song)?.linesIds.map((lineId) => (
              <LogLine
                key={lineId}
                id={lineId}
                song={song}
                onClick={onEntityClick}
                onSelect={onSelect}
                selected={selection.includes(lineId)}
                onSelectParts={onSelectMany}
                onAddPart={(lineId) => {
                  setSpecialModal(true);
                  setDrawerOpen([lineId]);
                }}
              >
                {distributor.getLine(lineId, song, true)?.partsIds.map((partId) => (
                  <LogPart
                    key={partId}
                    id={partId}
                    song={song}
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
      <EditDrawer activeIds={drawerOpen} specialModal={specialModal} onClose={onClose} />
    </div>
  );
}
