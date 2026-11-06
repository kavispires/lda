import { Alert, Button, Collapse, Modal, Space, Typography } from 'antd';
import { useState } from 'react';
import type { SimulationState } from '../types/simulation';
import type { TrackSpecialsAction } from '../types/track-specials-episode';
import { AutoCompleteEpisodeButton } from './AutoCompleteEpisodeButton';
import { ContestantAvatar } from './ContestantAvatar';
import { CopyEpisodeRundown } from './CopyEpisodeRundown';
import { EpisodeNarrative, EpisodeSceneNarrative } from './EpisodeNarrative';
import { PreparationDialog } from './NarrativeEpisodeView';
import styles from './NarrativeEpisodeView.module.scss';
import { NarrativeStage, OpeningCredits } from './NarrativeStage';
import { PersonnelAvatar } from './personnel/PersonnelAvatar';
import { EpisodeEndScreens } from './RelationshipUpdates';
import { ChangeDirection, PropertyChangeValue } from './SimulationChange';

export function TrackSpecialsEpisodeView({
  state,
  onAction,
  onInspect,
  actionError,
}: {
  state: SimulationState;
  onAction: (action: TrackSpecialsAction, revision: number) => void;
  onInspect: (id: string) => void;
  actionError?: string | null;
}) {
  const [history, setHistory] = useState<{ runId: string; sceneId: string } | null>(null);
  const runtime = state.runtime;
  if (runtime?.version !== 3 || runtime.photoshoot?.phase !== 'complete') return null;
  const episode = runtime.trackSpecials;
  const preparation = runtime.preparations?.[6];
  if (!episode && preparation && (!preparation.mood || preparation.requiredSelections > 0))
    return (
      <PreparationDialog
        actionError={actionError}
        key={`${runtime.runId}-6-${preparation.mood ? 'cast' : 'mood'}`}
        onAction={onAction}
        onInspect={onInspect}
        phase={preparation.mood ? 'opening-cast' : 'mood'}
        preparation={preparation}
        state={state}
      />
    );
  if (!episode)
    return (
      <NarrativeStage episode={6} title="Track Specials">
        <Typography.Paragraph>Sixteen remain. Their primary tracks take the spotlight.</Typography.Paragraph>
        {actionError && <Alert role="alert" title={actionError} type="error" />}
        <Space wrap>
          <Button onClick={() => onAction({ type: 'start' }, preparation?.revision ?? 0)} type="primary">
            Start Episode 6 — Track Specials
          </Button>
          <AutoCompleteEpisodeButton episode={6} state={state} />
        </Space>
      </NarrativeStage>
    );
  const latest = episode.scenes.at(-1);
  const scene =
    episode.scenes.find((entry) => history?.runId === runtime.runId && entry.id === history.sceneId) ??
    latest;
  const lookingBack = scene?.id !== latest?.id;
  const decision = episode.phase === 'intervention' || episode.phase === 'secret-choice';
  const credits = scene?.presentation === 'credits' || scene?.sequence === 2;
  const act = (action: TrackSpecialsAction) => onAction(action, episode.revision);
  const person = (id: string) => {
    const contestant = state.contestants.find((entry) => entry.id === id);
    if (!contestant) throw new Error(`Unknown Track Specials contestant "${id}".`);
    return contestant;
  };
  const link = (id: string) => (
    <Button data-contestant-id={id} onClick={() => onInspect(id)} type="link">
      {person(id).name}
    </Button>
  );
  const showRanking =
    episode.rankRevealed && (scene?.kind === 'ranking' || (!lookingBack && episode.phase === 'complete'));
  const narrativeScene =
    scene && showRanking
      ? {
          ...scene,
          kind: 'ranking' as const,
          paragraphs: scene.paragraphs.filter((paragraph) => !/^\d+[.)]\s/.test(paragraph)),
          paragraphContestantIds: scene.paragraphContestantIds?.filter(
            (_, index) => !/^\d+[.)]\s/.test(scene.paragraphs[index]),
          ),
        }
      : scene;
  return (
    <EpisodeEndScreens enabled={!lookingBack} episode={6} onInspect={onInspect} state={state}>
      <CopyEpisodeRundown episode={6} state={state} />
      {!decision && (
        <AutoCompleteEpisodeButton episode={6} onCompleted={() => setHistory(null)} state={state} />
      )}
      <NarrativeStage
        episode={6}
        eyebrow={scene?.sequence ? `SEQUENCE ${scene.sequence}${lookingBack ? ' / Archive' : ''}` : undefined}
        footer={
          lookingBack ? (
            <Button onClick={() => setHistory(null)}>Return to current scene</Button>
          ) : episode.phase === 'complete' ? (
            <Typography.Text>
              Episode complete. Fifteen continue. Episode 7 — Versatility is next; it has not begun.
            </Typography.Text>
          ) : decision ? (
            <Typography.Text>The episode is paused for your decision.</Typography.Text>
          ) : (
            <Button onClick={() => act({ type: 'advance' })} type="primary">
              Continue
            </Button>
          )
        }
        speaker={scene?.speaker?.name}
        speakerRole={scene?.speaker?.role}
        title={scene?.title ?? 'Track Specials'}
      >
        {!decision && actionError && <Alert role="alert" title={actionError} type="error" />}
        {showRanking && (
          <ol aria-label="Episode 6 standings" style={{ listStyle: 'none', paddingLeft: 0 }}>
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
                    <ContestantAvatar enablePreview={false} id={id} name={person(id).name} size={28} />
                    {link(id)}
                    {id === episode.eliminatedId && (
                      <Typography.Text type="danger">Eliminated</Typography.Text>
                    )}
                  </Space>
                </li>
              );
            })}
          </ol>
        )}
        {!credits && narrativeScene && (
          <EpisodeSceneNarrative
            contestants={state.contestants}
            onInspect={onInspect}
            reactions={[]}
            scene={narrativeScene}
          />
        )}
        {scene?.dialogues?.map((dialogue, index) => (
          <div className={styles.dialogue} key={`${scene.id}-dialogue-${index}`}>
            <div className={styles.speaker}>
              <PersonnelAvatar name={dialogue.name} />
              <strong>{dialogue.name}</strong>
              <small>{dialogue.role}</small>
            </div>
            <div className={styles.bubble}>
              {dialogue.paragraphs.map((text, paragraphIndex) => (
                <Typography.Paragraph key={paragraphIndex}>
                  <EpisodeNarrative
                    contestants={state.contestants}
                    mentionedIds={dialogue.paragraphContestantIds?.[paragraphIndex]}
                    onInspect={onInspect}
                    text={text}
                  />
                </Typography.Paragraph>
              ))}
            </div>
          </div>
        ))}
        {Object.entries(scene?.contestantChanges ?? {}).flatMap(([id, changes]) =>
          changes
            .filter((change) => change.path === 'aggregations.happiness')
            .map((change, index) => (
              <Typography.Paragraph key={`${id}-happiness-${index}`}>
                {link(id)} happiness <PropertyChangeValue change={change} />
              </Typography.Paragraph>
            )),
        )}
        {credits && preparation && (
          <OpeningCredits
            ids={preparation.slots.filter((id) => id !== null)}
            onInspect={onInspect}
            state={state}
          />
        )}
      </NarrativeStage>
      {decision && (
        <Modal
          centered
          closable={false}
          footer={null}
          keyboard={false}
          mask={{ closable: false }}
          open
          styles={{ body: { maxHeight: '75vh', overflowY: 'auto' } }}
          title={
            episode.phase === 'intervention'
              ? 'Your decision: rehearsal conflict'
              : 'Your decision: investigate a secret'
          }
        >
          <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            <AutoCompleteEpisodeButton episode={6} onCompleted={() => setHistory(null)} state={state} />
            {actionError && <Alert role="alert" title={actionError} type="error" />}
            {episode.phase === 'intervention' ? (
              <>
                <Typography.Paragraph>{episode.conflict?.description}</Typography.Paragraph>
                <Space wrap>
                  {(['support', 'mediate', 'push'] as const).map((choice) => (
                    <Button key={choice} onClick={() => act({ type: 'conflict', choice })}>
                      {choice === 'support'
                        ? 'Support the team'
                        : choice === 'mediate'
                          ? 'Mediate the disagreement'
                          : 'Push them to finish'}
                    </Button>
                  ))}
                </Space>
              </>
            ) : (
              episode.secretCandidates.map((id) => (
                <Space key={id}>
                  {link(id)}
                  <Button onClick={() => act({ type: 'secret', contestantId: id })} type="primary">
                    Investigate {person(id).name}
                  </Button>
                </Space>
              ))
            )}
            <Typography.Text type="secondary">
              The episode is paused until your decision is saved.
            </Typography.Text>
          </Space>
        </Modal>
      )}
      {!lookingBack && (
        <Collapse
          items={[
            {
              key: 'performances',
              label: 'Details — recorded performances',
              children: episode.performances.flatMap((performance) =>
                performance.evaluations.map((evaluation) => (
                  <Typography.Paragraph key={evaluation.contestantId}>
                    {link(evaluation.contestantId)} — {evaluation.grade}; {evaluation.finalScore.toFixed(2)}
                    /100.
                  </Typography.Paragraph>
                )),
              ),
            },
            {
              key: 'role-ballots',
              label: 'Details — recorded role ballots',
              children: episode.teams.map((team) => (
                <div key={team.id}>
                  <Typography.Text strong>{team.name}</Typography.Text>
                  {(
                    [
                      ['Leader', team.leaderElection],
                      ['Center', team.centerElection],
                    ] as const
                  ).map(
                    ([role, election]) =>
                      election && (
                        <div key={role}>
                          <Typography.Text>
                            {role}: {link(election.winnerId)}
                            {election.appointed ? ' (solo appointment)' : ''}
                          </Typography.Text>
                          {Object.entries(election.ballots).map(([voter, choice]) => (
                            <div key={voter}>
                              {link(voter)} votes for {link(choice)}.
                            </div>
                          ))}
                        </div>
                      ),
                  )}
                </div>
              )),
            },
            ...(episode.juryRevealed && episode.performances.length === episode.teams.length
              ? [
                  {
                    key: 'jury-ballots',
                    label: 'Details — jury ballots (viewer knowledge)',
                    children: episode.awards.map((award) => {
                      const recipient = (id: string) => {
                        if (award.category !== 'group') return link(id);
                        const team = episode.teams.find((entry) => entry.id === id);
                        if (!team) throw new Error('A jury ballot contains an unknown group.');
                        return team.name;
                      };
                      return (
                        <div key={award.category}>
                          <Typography.Title level={5}>{award.category}</Typography.Title>
                          {award.status === 'not-contested' ? (
                            <Typography.Text>No eligible performers.</Typography.Text>
                          ) : (
                            Object.entries(award.ballots).map(([voter, ballot]) => (
                              <div key={voter}>
                                {link(voter)}: Best {recipient(ballot.bestId)}; Worst{' '}
                                {ballot.worstId ? recipient(ballot.worstId) : 'not contested'}.
                              </div>
                            ))
                          )}
                        </div>
                      );
                    }),
                  },
                ]
              : []),
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
    </EpisodeEndScreens>
  );
}
