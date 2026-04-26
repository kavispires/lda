import { ApiOutlined } from '@ant-design/icons';
import { Avatar, Button } from 'antd';
import clsx from 'clsx';
import { ArtistAvatar } from 'components/Artist';
import { useMemo } from 'react';
import { useSongDistributionContext } from 'services/SongDistributionProvider';
import type { Artist, Dictionary, SongPart, UID } from 'types';
import { distributor } from 'utils';
import { ALL_ID } from 'utils/constants';
import { LogLine } from './LogLine';
import { LogPart } from './LogPart';
import { LogSection } from './LogSection';

type LogProps = {
  className?: string;
};

export function DistributionLog({ className }: LogProps) {
  const {
    song,
    videoControls,
    activeAssignee,
    onAssign,
    onAssignMany,
    mapping,
    distribution: { assignees },
  } = useSongDistributionContext();

  const onPartClick = (partId: UID) => {
    onAssign(partId, activeAssignee);
  };

  const onLineClick = (lineId: UID) => {
    onAssignMany(distributor.getLine(lineId, song).partsIds, activeAssignee);
  };

  // Handler to assign all parts with recommendedAssignee 'G' to ALL
  const handleAssignGroupParts = () => {
    const groupPartIds = Object.entries(song.content)
      .filter(([, content]) => {
        // Check if it's a SongPart by checking for recommendedAssignee property
        return (content as SongPart).recommendedAssignee === 'G';
      })
      .map(([id]) => id);

    if (groupPartIds.length > 0) {
      onAssignMany(groupPartIds, ALL_ID);
    }
  };

  // Helper to check if all parts in a section are assigned
  const isSectionComplete = useMemo(() => {
    return (sectionId: UID) => {
      const section = distributor.getSection(sectionId, song);
      const allPartIds = section.linesIds.flatMap((lineId) => distributor.getLine(lineId, song).partsIds);
      return allPartIds.every((partId) => mapping[partId] && mapping[partId].length > 0);
    };
  }, [song, mapping]);

  return (
    <div className={clsx('log', 'surface', className)} key={song.updatedAt}>
      <Button onClick={handleAssignGroupParts} size="small" style={{ marginBottom: '1rem' }}>
        Assign Group Parts to ALL
      </Button>
      <ul className="log-sections">
        {song.sectionIds.map((sectionId) => (
          <LogSection
            id={sectionId}
            key={sectionId}
            onPlay={(startTime) => videoControls.seekAndPlay(startTime)}
            overrideComplete={isSectionComplete(sectionId)}
            song={song}
          >
            {distributor.getSection(sectionId, song).linesIds.map((lineId) => (
              <LogLine id={lineId} key={lineId} onApplyToLine={onLineClick} showPartsOnly song={song}>
                {distributor.getLine(lineId, song).partsIds.map((partId) => (
                  <LogPart
                    after={<PartAssignees assignees={assignees} mapping={mapping} partId={partId} />}
                    color="#d0d0d0"
                    hideStatusIcon
                    id={partId}
                    key={partId}
                    onClick={onPartClick}
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

type PartAssigneesProps = {
  mapping: Dictionary<UID[]>;
  partId: UID;
  assignees: Dictionary<Artist>;
};

function PartAssignees({ mapping, partId, assignees }: PartAssigneesProps) {
  if (!mapping[partId]) {
    return null;
  }

  if (mapping[partId].length === 0) {
    return <ApiOutlined />;
  }

  return (
    <Avatar.Group>
      {mapping[partId].map((assigneeId) => {
        const assignee = assignees?.[assigneeId];

        return (
          <ArtistAvatar
            id={assigneeId}
            key={assigneeId}
            name={assignees?.[assigneeId]?.name ?? assigneeId}
            size="small"
            style={{
              border: `2px solid ${assignee?.color ?? '#f1f1f1'}`,
            }}
          />
        );
      })}
    </Avatar.Group>
  );
}
