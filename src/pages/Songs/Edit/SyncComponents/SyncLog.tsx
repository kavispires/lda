import { Button } from 'antd';
import { LogLine } from 'components/Log/LogLine';
import { LogPart } from 'components/Log/LogPart';
import { LogSection } from 'components/Log/LogSection';
import { UID } from 'types';
import { distributor } from 'utils';

import { RecordingTimestamp } from './KeyCapture';
import { useSongEditContext } from 'services/SongEditProvider';

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
        <Button type="link" disabled={!selection.length} onClick={onDeselectAll}>
          Deselect All
        </Button>
      </header>
      <ul className="log-sections">
        {song.sectionIds.map((sectionId) => (
          <LogSection
            key={sectionId}
            id={sectionId}
            onSelectParts={onSelectMany}
            onPlay={(startTime) => seekAndPlay(startTime)}
          >
            {distributor.getSection(sectionId, song).linesIds.map((lineId) => (
              <LogLine key={lineId} id={lineId} showPartsOnly>
                {distributor.getLine(lineId, song).partsIds.map((partId) => (
                  <LogPart
                    key={partId}
                    id={partId}
                    onClick={() => {
                      seekAndPlay(distributor.getPart(partId, song).startTime);
                    }}
                    onSelect={onSelect}
                    selected={selection.includes(partId)}
                    onConnect={!!activeTimestamp ? () => handleConnect(partId) : undefined}
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
