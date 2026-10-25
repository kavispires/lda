import { Alert, Button, Collapse, Modal, Space, Typography } from 'antd';
import { useState } from 'react';
import type { SimulationState } from '../types/simulation';
import type { VersatilityAction } from '../types/versatility-episode';
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

export function VersatilityEpisodeView({
  state,
  onAction,
  onInspect,
  actionError,
}: {
  state: SimulationState;
  onAction: (action: VersatilityAction, revision: number) => void;
  onInspect: (id: string) => void;
  actionError?: string | null;
}) {
  const [history, setHistory] = useState<{ runId: string; sceneId: string } | null>(null);
  const runtime = state.runtime;
  if (runtime?.version !== 3 || runtime.trackSpecials?.phase !== 'complete') return null;
  const episode = runtime.versatility;
  const preparation = runtime.preparations?.[7];
  if (!episode && preparation && (!preparation.mood || preparation.requiredSelections > 0))
    return (
      <PreparationDialog
        actionError={actionError}
        key={`${runtime.runId}-7-${preparation.mood ? 'cast' : 'mood'}`}
        onAction={onAction}
        onInspect={onInspect}
        phase={preparation.mood ? 'opening-cast' : 'mood'}
        preparation={preparation}
        state={state}
      />
    );
  if (!episode)
    return (
      <NarrativeStage episode={7} title="Versatility">
        <Typography.Paragraph>
          Fifteen remain. A new concept will take them beyond their usual strengths.
        </Typography.Paragraph>
        {actionError && <Alert role="alert" title={actionError} type="error" />}
        <Space wrap>
          <Button onClick={() => onAction({ type: 'start' }, preparation?.revision ?? 0)} type="primary">
            Start Episode 7 — Versatility
          </Button>
          <AutoCompleteEpisodeButton episode={7} state={state} />
        </Space>
      </NarrativeStage>
    );
  const latest = episode.scenes.at(-1);
  const scene =
    episode.scenes.find((entry) => history?.runId === runtime.runId && entry.id === history.sceneId) ??
    latest;
  const lookingBack = scene?.id !== latest?.id;
  const decision = episode.phase === 'intervention' || episode.phase === 'secret-choice';
  const credits = scene?.presentation === 'credits';
  const act = (action: VersatilityAction) => onAction(action, episode.revision);
  const person = (id: string) => {
    const result = state.contestants.find((entry) => entry.id === id);
    if (!result) throw new Error(`Unknown Versatility contestant "${id}".`);
    return result;
  };
  const link = (id: string) => (
    <Button data-contestant-id={id} onClick={() => onInspect(id)} type="link">
      {person(id).name}
    </Button>
  );
  const final = !lookingBack && episode.phase === 'complete';
  const showRanking = episode.rankRevealed && (scene?.kind === 'ranking' || final);
  const rankedIds = final
    ? [...episode.survivorIds, ...(episode.expelledId ? [episode.expelledId] : []), ...episode.eliminatedIds]
    : episode.rankedIds;
  const narrativeScene =
    scene && showRanking
      ? {
          ...scene,
          paragraphs: scene.paragraphs.filter((paragraph) => !/^\d+[.)]\s/.test(paragraph)),
          paragraphContestantIds: scene.paragraphContestantIds?.filter(
            (_, index) => !/^\d+[.)]\s/.test(scene.paragraphs[index]),
          ),
        }
      : scene;
  return (
    <EpisodeEndScreens enabled={!lookingBack} episode={7} onInspect={onInspect} state={state}>
      <CopyEpisodeRundown episode={7} state={state} />
      {!decision && (
        <AutoCompleteEpisodeButton episode={7} onCompleted={() => setHistory(null)} state={state} />
      )}
      <NarrativeStage
        episode={7}
        eyebrow={scene?.sequence ? `SEQUENCE ${scene.sequence}${lookingBack ? ' / Archive' : ''}` : undefined}
        footer={
          lookingBack ? (
            <Button onClick={() => setHistory(null)}>Return to current scene</Button>
          ) : final ? (
            <Typography.Text>
              Episode complete. Twelve continue. Episode 8 — Variety Show is next; it has not begun.
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
        title={scene?.title ?? 'Versatility'}
      >
        {!decision && actionError && <Alert role="alert" title={actionError} type="error" />}
        {showRanking && (
          <>
            <Typography.Paragraph>
              {final
                ? 'Final placements after the double elimination and expulsion.'
                : 'The announced performance ranking, before any later departure.'}
            </Typography.Paragraph>
            <ol
              aria-label={final ? 'Episode 7 final placements' : 'Episode 7 announced standings'}
              style={{ listStyle: 'none', paddingLeft: 0 }}
            >
              {rankedIds.map((id, index) => {
                const movement = episode.previousRankedIds.indexOf(id) - index;
                return (
                  <li key={id}>
                    <Space wrap>
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
                      {episode.eliminatedIds.includes(id) && (
                        <Typography.Text type="danger">Eliminated</Typography.Text>
                      )}
                      {final && episode.expelledId === id && (
                        <Typography.Text type="danger">
                          Expelled; announced rank {episode.rankedIds.indexOf(id) + 1}
                        </Typography.Text>
                      )}
                    </Space>
                  </li>
                );
              })}
            </ol>
          </>
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
            <AutoCompleteEpisodeButton episode={7} onCompleted={() => setHistory(null)} state={state} />
            {actionError && <Alert role="alert" title={actionError} type="error" />}
            {episode.phase === 'intervention' && latest && (
              <EpisodeSceneNarrative
                contestants={state.contestants}
                onInspect={onInspect}
                reactions={[]}
                scene={latest}
              />
            )}
            {episode.phase === 'intervention' ? (
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
              label: 'Details — recorded performance checks',
              children: episode.performances.flatMap((performance) =>
                performance.evaluations.map((evaluation) => (
                  <div key={evaluation.contestantId}>
                    {link(evaluation.contestantId)} — {evaluation.track}; {evaluation.grade},{' '}
                    {evaluation.finalScore.toFixed(2)}/100.
                    <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(evaluation, null, 2)}</pre>
                  </div>
                )),
              ),
            },
            {
              key: 'breakthroughs',
              label: 'Details — recorded breakthroughs',
              children: episode.breakthroughs.map((growth) => (
                <Typography.Paragraph key={growth.contestantId}>
                  {link(growth.contestantId)}: {growth.skill} {growth.before} → {growth.after}. Gate{' '}
                  {growth.gateDie}; potential check {growth.potentialDie}/{growth.potential}.
                </Typography.Paragraph>
              )),
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
    </EpisodeEndScreens>
  );
}
