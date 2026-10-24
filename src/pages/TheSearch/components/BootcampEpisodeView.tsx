import { Alert, Button, Collapse, Space, Typography } from 'antd';
import { useState } from 'react';
import type { BootcampAction } from '../types/bootcamp-episode';
import type { SimulationState } from '../types/simulation';
import { AutoCompleteEpisodeButton } from './AutoCompleteEpisodeButton';
import { ContestantAvatar } from './ContestantAvatar';
import { CopyEpisodeRundown } from './CopyEpisodeRundown';
import { EpisodeContestantList, EpisodeNarrative, EpisodeSceneNarrative } from './EpisodeNarrative';
import { PreparationDialog } from './NarrativeEpisodeView';
import styles from './NarrativeEpisodeView.module.scss';
import { NarrativeStage, OpeningCredits } from './NarrativeStage';
import { PersonnelAvatar } from './personnel/PersonnelAvatar';
import { ChangeDirection } from './SimulationChange';

export function BootcampEpisodeView({
  state,
  onAction,
  onInspect,
  actionError,
}: {
  state: SimulationState;
  onAction: (action: BootcampAction, revision: number) => void;
  onInspect: (id: string) => void;
  actionError?: string | null;
}) {
  const [history, setHistory] = useState<{ runId: string; sceneId: string } | null>(null);
  const runtime = state.runtime;
  if (!runtime || runtime.version !== 3 || runtime.battle?.phase !== 'complete') return null;
  const episode = runtime.bootcamp;
  const preparation = runtime.preparations?.[3];
  if (!episode && preparation && (!preparation.mood || preparation.requiredSelections > 0))
    return (
      <PreparationDialog
        actionError={actionError}
        key={`${runtime.runId}-3-${preparation.mood ? 'cast' : 'mood'}`}
        onAction={onAction}
        onInspect={onInspect}
        phase={preparation.mood ? 'opening-cast' : 'mood'}
        preparation={preparation}
        state={state}
      />
    );
  if (!episode)
    return (
      <NarrativeStage episode={3} title="Boot Camp">
        <AutoCompleteEpisodeButton episode={3} state={state} />
        <Typography.Paragraph>
          The eighteen survivors head outdoors for a training assessment with Mike Philip and Sargent Miller.
        </Typography.Paragraph>
        {actionError && <Alert role="alert" title={actionError} type="error" />}
        <Button onClick={() => onAction({ type: 'start' }, preparation?.revision ?? 0)} type="primary">
          Start Episode 3 — Boot Camp
        </Button>
      </NarrativeStage>
    );

  const latest = episode.scenes.at(-1);
  const selected =
    episode.scenes.find((scene) => history?.runId === runtime.runId && history.sceneId === scene.id) ??
    latest;
  const lookingBack = selected?.id !== latest?.id;
  const people = (ids: string[]) => (
    <EpisodeContestantList contestants={state.contestants} ids={ids} onInspect={onInspect} />
  );
  const name = (id: string) => state.contestants.find((person) => person.id === id)?.name ?? id;
  const person = (id: string) => (
    <Button data-contestant-id={id} onClick={() => onInspect(id)} type="link">
      {name(id)}
    </Button>
  );
  const narration = (text: string) => (
    <EpisodeNarrative contestants={state.contestants} onInspect={onInspect} text={text} />
  );
  const ranking = (revealed: boolean) => (
    <ol
      aria-label={revealed ? 'Episode 3 ranking' : 'Episode 2 ranking'}
      style={{ listStyle: 'none', paddingLeft: 0 }}
    >
      {(revealed ? episode.rankedIds : episode.previousRankedIds).map((id, index) => {
        const movement = episode.previousRankedIds.indexOf(id) - index;
        return (
          <li key={id}>
            <Space>
              <Typography.Text strong>{index + 1}.</Typography.Text>
              {revealed && movement !== 0 && (
                <Typography.Text
                  aria-label={`${movement > 0 ? 'Up' : 'Down'} ${Math.abs(movement)} ${Math.abs(movement) === 1 ? 'place' : 'places'}`}
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
    selected?.kind === 'ranking'
      ? {
          ...selected,
          paragraphs: selected.paragraphs.slice(episode.rankedIds.length),
          paragraphContestantIds: selected.paragraphContestantIds?.slice(episode.rankedIds.length),
        }
      : selected;
  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <CopyEpisodeRundown episode={3} state={state} />
      <AutoCompleteEpisodeButton episode={3} onCompleted={() => setHistory(null)} state={state} />
      <NarrativeStage
        episode={3}
        eyebrow={selected?.sequence ? `SEQUENCE ${selected.sequence}` : undefined}
        footer={
          lookingBack ? (
            <Button onClick={() => setHistory(null)}>Return to current scene</Button>
          ) : episode.phase !== 'complete' ? (
            <Button onClick={() => onAction({ type: 'advance' }, episode.revision)} type="primary">
              Continue
            </Button>
          ) : (
            <Typography.Text>Episode complete</Typography.Text>
          )
        }
        speaker={selected?.speaker?.name}
        speakerRole={selected?.speaker?.role}
        title={selected?.title ?? 'Boot Camp'}
      >
        {actionError && <Alert role="alert" title={actionError} type="error" />}
        {episode.rankRevealed &&
          (selected?.kind === 'ranking' || (!lookingBack && episode.phase === 'complete')) &&
          ranking(true)}
        {narrativeScene && (
          <EpisodeSceneNarrative
            contestants={state.contestants}
            onInspect={onInspect}
            reactions={[]}
            scene={narrativeScene}
          />
        )}
        {selected?.dialogues?.map((dialogue, index) => (
          <div className={styles.dialogue} key={`${selected.id}-dialogue-${index}`}>
            <div className={styles.speaker}>
              <PersonnelAvatar name={dialogue.name} />
              <strong>{dialogue.name}</strong>
              <small>{dialogue.role}</small>
            </div>
            <div className={styles.bubble}>
              {dialogue.paragraphs.map((paragraph, paragraphIndex) => (
                <Typography.Paragraph key={`${index}-${paragraphIndex}`}>
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
        {(selected?.presentation === 'credits' || selected?.sequence === 2) && preparation && (
          <OpeningCredits
            ids={preparation.slots.filter((id) => id !== null)}
            onInspect={onInspect}
            state={state}
          />
        )}
      </NarrativeStage>
      <Collapse
        items={[
          {
            key: 'details',
            label: 'Details — recorded Boot Camp evidence',
            children: (
              <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                <Collapse
                  items={episode.groups.map((group, index) => ({
                    key: group.id,
                    label: `Group ${index + 1}`,
                    children: (
                      <>
                        {people(group.memberIds)}
                        {group.pairs.map((pair, round) => (
                          <div key={`pair-${round}`}>
                            <Typography.Title level={5}>Round {round + 1} pair</Typography.Title>
                            {people(pair)}
                          </div>
                        ))}
                        {Object.entries(group.ballots).map(([round, ballots]) => (
                          <div key={round}>
                            <Typography.Title level={5}>Round {round} ballots</Typography.Title>
                            {Object.entries(ballots).map(([voter, choices]) => (
                              <div key={voter}>
                                {person(voter)} nominates {people(choices)}
                              </div>
                            ))}
                            <Typography.Paragraph type="secondary">
                              Saved tie keys:{' '}
                              {Object.entries(group.tieKeys[round] ?? {})
                                .map(([id, value]) => `${name(id)}: ${value}`)
                                .join('; ')}
                              .
                            </Typography.Paragraph>
                          </div>
                        ))}
                      </>
                    ),
                  }))}
                />
                <Collapse
                  items={episode.evaluations.map((evaluation) => ({
                    key: `${evaluation.round}-${evaluation.contestantId}`,
                    label: `Round ${evaluation.round} — ${name(evaluation.contestantId)}`,
                    children: (
                      <>
                        {person(evaluation.contestantId)}
                        <Typography.Paragraph>
                          Raw dice: {evaluation.rawDice.join(' + ')}. Base {evaluation.baseScore.toFixed(2)};
                          final {evaluation.finalScore.toFixed(2)}; temporary fatigue {evaluation.fatigue}.
                          Saved tie key: {evaluation.tieBreakKey}.
                        </Typography.Paragraph>
                        {Object.entries(evaluation.checks).map(([skill, check]) => (
                          <Typography.Paragraph key={skill}>
                            {skill}: level {check.skillLevel}; adjusted dice {check.adjustedDice.join(' + ')};
                            score {check.score.toFixed(2)}.
                          </Typography.Paragraph>
                        ))}
                        {evaluation.events.map((event, index) => (
                          <Typography.Paragraph key={`${event.kind}-${index}`}>
                            {narration(event.narrative)} Technical adjustment {event.scoreDelta}; spotlight{' '}
                            {event.spotlight}.
                          </Typography.Paragraph>
                        ))}
                      </>
                    ),
                  }))}
                />
                {episode.groupResults.map((result) => (
                  <div key={result.groupId}>
                    <Typography.Title level={5}>{result.groupId} — final group result</Typography.Title>
                    <Typography.Paragraph>
                      Score {result.score.toFixed(2)}; resets {result.resets};
                      {result.assisted ? ' assisted finish / safety stop' : ' completed'}. Saved tie key:{' '}
                      {result.tieBreakKey}.
                    </Typography.Paragraph>
                    <div>Staging: {people(result.staging)}</div>
                    {result.attempts.map((attempt, index) => (
                      <Typography.Paragraph key={index}>
                        Attempt after {attempt.reset} resets:{' '}
                        {Object.entries(attempt.timing)
                          .map(([id, timing]) => `${name(id)} ${timing.toFixed(2)}`)
                          .join('; ')}
                        .
                      </Typography.Paragraph>
                    ))}
                  </div>
                ))}
                {episode.winners.map((id, index) => (
                  <div key={`winner-${index}`}>
                    Round {index + 1} winner: {person(id)}
                  </div>
                ))}
                {episode.winningGroupId && <div>Winning group: {episode.winningGroupId}</div>}
                {episode.mvp && (
                  <div>
                    <Typography.Title level={5}>Peer MVP: {person(episode.mvp.winnerId)}</Typography.Title>
                    {Object.entries(episode.mvp.ballots).map(([voter, choice]) => (
                      <div key={voter}>
                        {person(voter)} votes for {person(choice)}
                      </div>
                    ))}
                  </div>
                )}
                <Typography.Title level={5}>
                  {episode.rankRevealed
                    ? 'Episode 3 continuing ranking'
                    : 'Previous public ranking — Episode 2'}
                </Typography.Title>
                {ranking(episode.rankRevealed)}
              </Space>
            ),
          },
          {
            key: 'history',
            label: 'Scene history — read only',
            children: (
              <Space wrap>
                {episode.scenes.map((scene) => (
                  <Button
                    key={scene.id}
                    onClick={() => setHistory({ runId: runtime.runId, sceneId: scene.id })}
                  >
                    {scene.title}
                  </Button>
                ))}
              </Space>
            ),
          },
        ]}
      />
    </Space>
  );
}
