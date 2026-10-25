import { Alert, Button, Collapse, Space, Typography } from 'antd';
import { useState } from 'react';
import type { PhotoshootAction } from '../types/photoshoot-episode';
import type { SimulationState } from '../types/simulation';
import { AutoCompleteEpisodeButton } from './AutoCompleteEpisodeButton';
import { ContestantAvatar } from './ContestantAvatar';
import { CopyEpisodeRundown } from './CopyEpisodeRundown';
import { EpisodeNarrative, EpisodeSceneNarrative } from './EpisodeNarrative';
import { PreparationDialog } from './NarrativeEpisodeView';
import styles from './NarrativeEpisodeView.module.scss';
import { NarrativeStage, OpeningCredits } from './NarrativeStage';
import { PersonnelAvatar } from './personnel/PersonnelAvatar';
import { ChangeDirection, PropertyChangeValue } from './SimulationChange';

export function PhotoshootEpisodeView({
  state,
  onAction,
  onInspect,
  actionError,
}: {
  state: SimulationState;
  onAction: (action: PhotoshootAction, revision: number) => void;
  onInspect: (id: string) => void;
  actionError?: string | null;
}) {
  const [history, setHistory] = useState<{ runId: string; sceneId: string } | null>(null);
  const runtime = state.runtime;
  if (runtime?.version !== 3 || runtime.megaGroups?.phase !== 'complete') return null;
  const episode = runtime.photoshoot;
  const preparation = runtime.preparations?.[5];
  if (!episode && preparation && (!preparation.mood || preparation.requiredSelections > 0))
    return (
      <PreparationDialog
        actionError={actionError}
        key={`${runtime.runId}-5-${preparation.mood ? 'cast' : 'mood'}`}
        onAction={onAction}
        onInspect={onInspect}
        phase={preparation.mood ? 'opening-cast' : 'mood'}
        preparation={preparation}
        state={state}
      />
    );
  if (!episode)
    return (
      <NarrativeStage episode={5} title="The Photoshoot">
        <Typography.Paragraph>
          Sixteen survivors return for a new camera-ready challenge.
        </Typography.Paragraph>
        {actionError && <Alert role="alert" title={actionError} type="error" />}
        <Space wrap>
          <Button onClick={() => onAction({ type: 'start' }, preparation?.revision ?? 0)} type="primary">
            Start Episode 5 — The Photoshoot
          </Button>
          <AutoCompleteEpisodeButton episode={5} state={state} />
        </Space>
      </NarrativeStage>
    );
  const latest = episode.scenes.at(-1);
  const scene =
    episode.scenes.find((entry) => history?.runId === runtime.runId && history.sceneId === entry.id) ??
    latest;
  const lookingBack = scene?.id !== latest?.id;
  const decision = episode.phase === 'styling-choice' || episode.phase === 'secret-choice';
  const act = (action: PhotoshootAction) => onAction(action, episode.revision);
  const name = (id: string) => {
    const contestant = state.contestants.find((entry) => entry.id === id);
    if (!contestant) throw new Error(`Unknown Photoshoot contestant "${id}".`);
    return contestant.name;
  };
  const person = (id: string) => (
    <Button data-contestant-id={id} onClick={() => onInspect(id)} type="link">
      {name(id)}
    </Button>
  );
  const ranking = (
    <ol aria-label="Episode 5 standings" style={{ listStyle: 'none', paddingLeft: 0 }}>
      {episode.rankedIds.map((id, index) => {
        const movement = episode.previousRankedIds.indexOf(id) - index;
        return (
          <li key={id}>
            <Space>
              <Typography.Text strong>{index + 1}.</Typography.Text>
              {movement !== 0 && (
                <Typography.Text
                  aria-label={`${movement > 0 ? 'Up' : 'Down'} ${Math.abs(movement)} places`}
                  type={movement > 0 ? 'success' : 'danger'}
                >
                  <ChangeDirection change={movement} /> {Math.abs(movement)}
                </Typography.Text>
              )}
              <ContestantAvatar enablePreview={false} id={id} name={name(id)} size={28} />
              {person(id)}
            </Space>
          </li>
        );
      })}
    </ol>
  );
  const narrativeScene =
    scene?.kind === 'ranking'
      ? {
          ...scene,
          paragraphs: scene.paragraphs.filter((text) => !/^\d+[.)]\s/.test(text)),
          paragraphContestantIds: undefined,
        }
      : scene;
  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <CopyEpisodeRundown episode={5} state={state} />
      <AutoCompleteEpisodeButton episode={5} onCompleted={() => setHistory(null)} state={state} />
      <NarrativeStage
        episode={5}
        eyebrow={scene?.sequence ? `SEQUENCE ${scene.sequence}${lookingBack ? ' / Archive' : ''}` : undefined}
        footer={
          lookingBack ? (
            <Button onClick={() => setHistory(null)}>Return to current scene</Button>
          ) : episode.phase === 'complete' ? (
            <Typography.Text>
              Episode complete. All sixteen continue. Episode 6 — Track Specials is next; it is not playable
              yet.
            </Typography.Text>
          ) : decision ? (
            <Typography.Text>Choose how to continue below.</Typography.Text>
          ) : (
            <Button onClick={() => act({ type: 'advance' })} type="primary">
              Continue
            </Button>
          )
        }
        speaker={scene?.speaker?.name}
        speakerRole={scene?.speaker?.role}
        title={scene?.title ?? 'The Photoshoot'}
      >
        {actionError && <Alert role="alert" title={actionError} type="error" />}
        {episode.rankRevealed &&
          (scene?.kind === 'ranking' || (!lookingBack && episode.phase === 'complete')) &&
          ranking}
        {narrativeScene && (
          <EpisodeSceneNarrative
            contestants={state.contestants}
            onInspect={onInspect}
            reactions={[]}
            scene={narrativeScene}
          />
        )}
        {Object.entries(scene?.contestantChanges ?? {}).flatMap(([id, changes]) =>
          changes
            .filter((change) => change.path === 'aggregations.happiness')
            .map((change, index) => (
              <Typography.Paragraph key={`${id}-happiness-${index}`}>
                {person(id)} happiness <PropertyChangeValue change={change} />
              </Typography.Paragraph>
            )),
        )}
        {scene?.dialogues?.map((dialogue, index) => (
          <div className={styles.dialogue} key={`${scene.id}-dialogue-${index}`}>
            <div className={styles.speaker}>
              <PersonnelAvatar name={dialogue.name} />
              <strong>{dialogue.name}</strong>
              <small>{dialogue.role}</small>
            </div>
            <div className={styles.bubble}>
              {dialogue.paragraphs.map((paragraph, paragraphIndex) => (
                <Typography.Paragraph key={paragraphIndex}>
                  <EpisodeNarrative
                    contestants={state.contestants}
                    mentionedIds={dialogue.paragraphContestantIds?.[paragraphIndex]}
                    onInspect={onInspect}
                    text={paragraph}
                  />
                </Typography.Paragraph>
              ))}
            </div>
          </div>
        ))}
        {scene?.presentation === 'credits' && preparation && (
          <OpeningCredits
            ids={preparation.slots.filter((id) => id !== null)}
            onInspect={onInspect}
            state={state}
          />
        )}
        {!lookingBack && episode.phase === 'styling-choice' && (
          <Space wrap>
            <Button onClick={() => act({ type: 'styling', choice: 'intervene' })}>
              Intervene — bring in stylists
            </Button>
            <Button onClick={() => act({ type: 'styling', choice: 'self-style' })}>
              Let them clash — keep creative control
            </Button>
          </Space>
        )}
        {!lookingBack && episode.phase === 'secret-choice' && (
          <Space wrap>
            {episode.secretCandidates.map((id) => (
              <Button key={id} onClick={() => act({ type: 'secret', contestantId: id })}>
                Investigate {name(id)}
              </Button>
            ))}
          </Space>
        )}
      </NarrativeStage>
      {scene?.contestantChanges && (
        <Collapse
          items={[
            {
              key: 'relationships',
              label: 'Details — relationship changes in this scene',
              children: Object.entries(scene.contestantChanges).flatMap(([id, changes]) =>
                changes
                  .filter((change) => change.path.startsWith('relationships.'))
                  .map((change, index) => (
                    <div key={`${id}-${index}`}>
                      {person(id)} toward {person(change.path.slice('relationships.'.length))}{' '}
                      <PropertyChangeValue change={change} />
                    </div>
                  )),
              ),
            },
          ]}
        />
      )}
      {!lookingBack && (
        <Collapse
          items={[
            {
              key: 'photos',
              label: 'Details — recorded photographs',
              children: (
                <Space orientation="vertical">
                  {episode.individualPhotos.map((photo) => (
                    <div key={photo.contestantId}>
                      {person(photo.contestantId)} — {photo.grade}; {photo.finalScore.toFixed(2)}/100. Dice:{' '}
                      {photo.rawDice.join(' + ')}.
                    </div>
                  ))}
                  {episode.groupPhotos.map((photo) => (
                    <div key={photo.teamId}>
                      <Typography.Text strong>
                        {episode.teams.find((team) => team.id === photo.teamId)?.name}
                      </Typography.Text>
                      {photo.evaluations.map((evaluation) => (
                        <div key={evaluation.contestantId}>
                          {person(evaluation.contestantId)} — {evaluation.finalScore.toFixed(2)}/100.
                        </div>
                      ))}
                    </div>
                  ))}
                </Space>
              ),
            },
            {
              key: 'ballots',
              label: 'Details — recorded ballots (viewer knowledge)',
              children: (
                <Space orientation="vertical">
                  {episode.teams.map((team) => (
                    <div key={team.id}>
                      <Typography.Text strong>{team.name} center</Typography.Text>
                      {Object.entries(team.centerBallots).map(([voter, choice]) => (
                        <div key={voter}>
                          {person(voter)} votes for {person(choice)}.
                        </div>
                      ))}
                    </div>
                  ))}
                  {Object.entries(episode.ultimateVisual?.ballots ?? {}).map(([voter, choice]) => (
                    <div key={voter}>
                      {person(voter)} privately votes for {person(choice)}.
                    </div>
                  ))}
                </Space>
              ),
            },
          ]}
        />
      )}
      <Collapse
        items={[
          {
            key: 'history',
            label: 'Episode history',
            children: episode.scenes.map((entry) => (
              <div key={entry.id}>
                <Button onClick={() => setHistory({ runId: runtime.runId, sceneId: entry.id })} type="link">
                  {entry.title}
                </Button>
              </div>
            )),
          },
        ]}
      />
    </Space>
  );
}
