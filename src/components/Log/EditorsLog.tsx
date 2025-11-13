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
        <Button disabled={!selection.length} onClick={() => setDrawerOpen([...selection])} type="link">
          Edit {selection.length} {instanceName}
        </Button>
        <Button disabled={!selection.length} onClick={onDeselectAll} type="link">
          Deselect {selection.length > 1 ? 'All' : instanceName}
        </Button>
      </header>
      <Divider className="my-1" />
      <ul className="log-sections" key={song.updatedAt} ref={ref}>
        {song.sectionIds.map((sectionId) => (
          <LogSection
            id={sectionId}
            key={sectionId}
            onAddLine={(sectionId) => {
              setSpecialModal(true);
              setDrawerOpen([sectionId]);
            }}
            onClick={onEntityClick}
            onPlay={(startTime) => videoControls.seekAndPlay(startTime)}
            onSelect={onSelect}
            selected={selection.includes(sectionId)}
            song={song}
          >
            {distributor.getSection(sectionId, song)?.linesIds.map((lineId) => (
              <LogLine
                id={lineId}
                key={lineId}
                onAddPart={(lineId) => {
                  setSpecialModal(true);
                  setDrawerOpen([lineId]);
                }}
                onClick={onEntityClick}
                onSelect={onSelect}
                onSelectParts={onSelectMany}
                selected={selection.includes(lineId)}
                song={song}
              >
                {distributor.getLine(lineId, song, true)?.partsIds.map((partId) => (
                  <LogPart
                    id={partId}
                    key={partId}
                    onClick={onEntityClick}
                    onSelect={onSelect}
                    selected={selection.includes(partId)}
                    song={song}
                  />
                ))}
              </LogLine>
            ))}
          </LogSection>
        ))}
      </ul>
      <EditDrawer activeIds={drawerOpen} onClose={onClose} specialModal={specialModal} />
    </div>
  );
}
