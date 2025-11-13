import { Button } from 'antd';
import { LogLine } from 'components/Log/LogLine';
import { LogPart } from 'components/Log/LogPart';
import { LogSection } from 'components/Log/LogSection';
import { useSongEditContext } from 'services/SongEditProvider';
import type { UID } from 'types';
import { distributor } from 'utils';
import type { RecordingTimestamp } from './KeyCapture';

type SyncLogProps = {
  activeTimestamp: RecordingTimestamp | null;
  seekAndPlay: (time: number) => void;
  handleConnect: (partId: UID) => void;
};

export function SyncLog({ activeTimestamp, seekAndPlay, handleConnect }: SyncLogProps) {
  const {
    song,
    selectionIdModel: { selection, onSelect, onSelectMany, onDeselectAll },
  } = useSongEditContext();

  return (
    <div className="surface">
      <header className="grid">
        <Button disabled={!selection.length} onClick={onDeselectAll} type="link">
          Deselect All
        </Button>
      </header>
      <ul className="log-sections">
        {song.sectionIds.map((sectionId) => (
          <LogSection
            enableSelectRemainingParts
            id={sectionId}
            key={sectionId}
            onPlay={(startTime) => seekAndPlay(startTime)}
            onSelectParts={onSelectMany}
            song={song}
          >
            {distributor.getSection(sectionId, song).linesIds.map((lineId) => (
              <LogLine id={lineId} key={lineId} showPartsOnly song={song}>
                {distributor.getLine(lineId, song).partsIds.map((partId) => (
                  <LogPart
                    id={partId}
                    key={partId}
                    onClick={() => {
                      seekAndPlay(distributor.getPart(partId, song).startTime);
                    }}
                    onConnect={activeTimestamp ? () => handleConnect(partId) : undefined}
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
    </div>
  );
}
