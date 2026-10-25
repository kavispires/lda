import { Button, Space, Typography } from 'antd';
import { type ReactNode, useState } from 'react';
import { type EpisodeNumber, isEpisodeComplete } from '../engine/episode-auto-complete';
import type { SimulationState } from '../types/simulation';
import { episodeRelationshipUpdates } from '../utilities/relationship-updates';
import { CopyEpisodeRundown } from './CopyEpisodeRundown';
import { NarrativeStage } from './NarrativeStage';
import { ChangeDirection } from './SimulationChange';

export function RelationshipUpdates({
  state,
  episode,
  onInspect,
  onBack,
}: {
  state: SimulationState;
  episode: EpisodeNumber;
  onInspect: (id: string) => void;
  onBack: () => void;
}) {
  const updates = episodeRelationshipUpdates(state, episode);
  const cast = new Map(state.runtime?.initialContestants.map((person) => [person.id, person.name]));
  const person = (id: string) => {
    const name = cast.get(id);
    if (name === undefined) throw new Error('A relationship update has an unknown contestant.');
    return (
      <Button data-contestant-id={id} onClick={() => onInspect(id)} type="link">
        {name}
      </Button>
    );
  };
  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <CopyEpisodeRundown episode={episode} state={state} />
      <NarrativeStage
        episode={episode}
        eyebrow="VIEWER NOTES / NOT PART OF THE BROADCAST"
        footer={<Button onClick={onBack}>Back to the episode finale</Button>}
        title="Relationships Updates"
      >
        <Typography.Paragraph>
          What viewers noticed during the episode. These notes are not part of the broadcast and do not add
          any new interactions.
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary">
          {episode === 1
            ? 'Net changes compared with season-entry relationships.'
            : 'Net changes compared with the previous episode ending.'}
        </Typography.Paragraph>
        <Typography.Title level={4}>Improved or worsened</Typography.Title>
        {updates.changes.length ? (
          <ul aria-label="Relationship changes">
            {updates.changes.map(({ fromId, toId, delta, after }) => (
              <li key={`${fromId}-${toId}`}>
                {person(fromId)} toward {person(toId)}: <ChangeDirection change={delta} /> {Math.abs(delta)}{' '}
                points; now {after}/100.
              </li>
            ))}
          </ul>
        ) : (
          <Typography.Paragraph>No relationships changed by more than 5 points.</Typography.Paragraph>
        )}
        <Typography.Title level={4}>Uneven feelings in this episode's cast</Typography.Title>
        {updates.gaps.length ? (
          <ul aria-label="Uneven feelings">
            {updates.gaps.map(({ fromId, toId, fromValue, toValue, gap }) => (
              <li key={`${fromId}-${toId}`}>
                {person(fromId)} toward {person(toId)}: {fromValue}/100; {person(toId)} toward{' '}
                {person(fromId)}: {toValue}/100. Gap: {gap} points.
              </li>
            ))}
          </ul>
        ) : (
          <Typography.Paragraph>No mutual-feeling gaps of 15 points or more.</Typography.Paragraph>
        )}
      </NarrativeStage>
    </Space>
  );
}

export function EpisodeEndScreens({
  state,
  episode,
  onInspect,
  enabled = true,
  children,
}: {
  state: SimulationState;
  episode: EpisodeNumber;
  onInspect: (id: string) => void;
  enabled?: boolean;
  children: ReactNode;
}) {
  const [selectedEpisode, setSelectedEpisode] = useState<string | null>(null);
  const identity = state.runtime ? `${state.runtime.runId}:${episode}` : null;
  const complete = enabled && isEpisodeComplete(state, episode);
  if (complete && selectedEpisode !== null && selectedEpisode === identity)
    return (
      <RelationshipUpdates
        episode={episode}
        onBack={() => setSelectedEpisode(null)}
        onInspect={onInspect}
        state={state}
      />
    );
  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      {children}
      {complete && identity !== null && (
        <Button onClick={() => setSelectedEpisode(identity)} type="primary">
          Relationships Updates
        </Button>
      )}
    </Space>
  );
}
