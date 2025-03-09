import clsx from 'clsx';
import { Artist, Dictionary, UID } from 'types';
import { distributor } from 'utils';
import { useSongDistributionContext } from 'services/SongDistributionProvider';
import { ApiOutlined, PlayCircleFilled } from '@ant-design/icons';
import { Alert, Avatar, Button, Popconfirm, Typography } from 'antd';
import { ArtistAvatar } from 'components/Artist';
import { useLogLine, useLogPart, useLogSection } from 'hooks/useLogInstances';

import { useDanceFormationContext } from 'services/DanceFormationProvider';

type FormationDistributionLogProps = {
  className?: string;
};

export function FormationDistributionLog({ className }: FormationDistributionLogProps) {
  const { song, videoControls } = useSongDistributionContext();
  const { setActiveTimestamp } = useDanceFormationContext();

  return (
    <div className={clsx('log', 'surface', className)} key={song.updatedAt}>
      <ul className="log-sections">
        <li className="log-section">
          <span className="log-section__section">
            <Button
              size="small"
              shape="circle"
              icon={<PlayCircleFilled />}
              onClick={() => videoControls.seekAndPlay(song.startAt)}
            />
            <span>
              Start Pose <Typography.Text code>{song.startAt}ms</Typography.Text>
            </span>
            <Button
              size="small"
              icon={<i className="fi fi-rr-screen" />}
              onClick={() => setActiveTimestamp(String(song.startAt))}
            />
          </span>
        </li>
        {song.sectionIds.map((sectionId) => (
          <ViewSection
            key={sectionId}
            instanceId={sectionId}
            onPlay={(startTime) => videoControls.seekAndPlay(startTime)}
          />
        ))}
        <li className="log-section">
          <span className="log-section__section">
            <Button
              size="small"
              shape="circle"
              icon={<PlayCircleFilled />}
              onClick={() => videoControls.seekAndPlay(song.endAt)}
            />
            <span>
              End Pose <Typography.Text code>{song.endAt}ms</Typography.Text>
            </span>
            <Button
              size="small"
              icon={<i className="fi fi-rr-screen" />}
              onClick={() => setActiveTimestamp(String(song.endAt))}
            />
          </span>
        </li>
      </ul>
    </div>
  );
}

type ViewEntryProps = {
  instanceId: UID;
};

function ViewSection({ instanceId, onPlay }: ViewEntryProps & { onPlay: (startTime: number) => void }) {
  const { song } = useSongDistributionContext();
  const { name, partIds, section } = useLogSection(instanceId, song);
  const { part } = useLogPart(partIds[0], song);

  if (!section || !section.id)
    return (
      <li className="log-section">
        <Alert message="Section doesn't exist" type="error" />
      </li>
    );

  return (
    <li className="log-section">
      <span className="log-section__section">
        <Button
          size="small"
          shape="circle"
          icon={<PlayCircleFilled />}
          onClick={() => onPlay(part.startTime)}
        />
        <span>
          {name} <Typography.Text code>{part.startTime}ms</Typography.Text>
        </span>
      </span>
      {
        <ul className="log-section__lines">
          {distributor.getSection(instanceId, song).linesIds.map((lineId) => (
            <ViewLine key={lineId} instanceId={lineId} />
          ))}
        </ul>
      }
    </li>
  );
}

function ViewLine({ instanceId }: ViewEntryProps) {
  const { song } = useSongDistributionContext();
  const { line, startTime } = useLogLine(instanceId, song);
  const { timeline, addTimestamp, setActiveTimestamp } = useDanceFormationContext();

  const createSnapshot = () => {
    addTimestamp(startTime);
    setActiveTimestamp(String(startTime));
  };

  return (
    <li className={clsx('log-line', 'log-line--inline')}>
      <ul className="log-line__parts">
        <span className="log-line__line-text">
          {!!line.adlib && '> '}
          {!!line.dismissible && '* '}
        </span>
        {distributor.getLine(instanceId, song).partsIds.map((partId) => (
          <ViewPart instanceId={partId} />
        ))}
        {timeline[startTime] ? (
          <Button
            size="small"
            icon={<i className="fi fi-rr-screen" />}
            onClick={() => setActiveTimestamp(String(startTime))}
          />
        ) : (
          <Popconfirm title="Are you sure you want to create a new snapshot?" onConfirm={createSnapshot}>
            <Button size="small" icon={<i className="fi fi-rr-map-marker-plus" />} />
          </Popconfirm>
        )}
      </ul>
    </li>
  );
}

function ViewPart({ instanceId }: ViewEntryProps) {
  const {
    song,
    mapping,
    distribution: { assignees },
  } = useSongDistributionContext();
  const { part } = useLogPart(instanceId, song);

  if (!part || !part.id) {
    return (
      <li className="log-section">
        <Alert message="Line doesn't exist" type="error" />
      </li>
    );
  }

  return (
    <li className="log-part">
      <span>{part.text}</span>

      <PartAssignees mapping={mapping} partId={instanceId} assignees={assignees} />
    </li>
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
