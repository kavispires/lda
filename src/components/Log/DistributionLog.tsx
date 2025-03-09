import clsx from 'clsx';
import type { Artist, Dictionary, UID } from 'types';
import { distributor } from 'utils';

import { LogLine } from './LogLine';
import { LogPart } from './LogPart';
import { LogSection } from './LogSection';
import { useSongDistributionContext } from 'services/SongDistributionProvider';
import { ApiOutlined } from '@ant-design/icons';
import { Avatar } from 'antd';
import { ArtistAvatar } from 'components/Artist';

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

  return (
    <div className={clsx('log', 'surface', className)} key={song.updatedAt}>
      <ul className="log-sections">
        {song.sectionIds.map((sectionId) => (
          <LogSection
            key={sectionId}
            song={song}
            id={sectionId}
            onPlay={(startTime) => videoControls.seekAndPlay(startTime)}
          >
            {distributor.getSection(sectionId, song).linesIds.map((lineId) => (
              <LogLine key={lineId} id={lineId} song={song} showPartsOnly onApplyToLine={onLineClick}>
                {distributor.getLine(lineId, song).partsIds.map((partId) => (
                  <LogPart
                    key={partId}
                    id={partId}
                    song={song}
                    onClick={onPartClick}
                    after={<PartAssignees mapping={mapping} partId={partId} assignees={assignees} />}
                    hideStatusIcon
                    color="#d0d0d0"
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
            key={assigneeId}
            id={assigneeId}
            name={assignees?.[assigneeId]?.name ?? assigneeId}
            style={{
              border: `2px solid ${assignee?.color ?? '#f1f1f1'}`,
            }}
            size="small"
          />
        );
      })}
    </Avatar.Group>
  );
}
