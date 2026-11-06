import { Alert, Button, Collapse, Modal, Space, Typography } from 'antd';
import { useState } from 'react';
import type { SimulationState } from '../types/simulation';
import type { SpecialtiesAction } from '../types/specialties-episode';
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

export function SpecialtiesEpisodeView({
  state,
  onAction,
  onInspect,
  actionError,
}: {
  state: SimulationState;
  onAction: (action: SpecialtiesAction, revision: number) => void;
  onInspect: (id: string) => void;
  actionError?: string | null;
}) {
  const [history, setHistory] = useState<{ runId: string; sceneId: string } | null>(null);
  const runtime = state.runtime;
  if (runtime?.version !== 3 || runtime.musicVideo?.phase !== 'complete') return null;
  const episode = runtime.specialties;
  const preparation = runtime.preparations?.[10];
  if (!episode && preparation && (!preparation.mood || preparation.requiredSelections > 0))
    return (
      <PreparationDialog
        actionError={actionError}
        key={`${runtime.runId}-10-${preparation.mood ? 'cast' : 'mood'}`}
        onAction={onAction}
        onInspect={onInspect}
        phase={preparation.mood ? 'opening-cast' : 'mood'}
        preparation={preparation}
        state={state}
      />
    );
  if (!episode)
    return (
      <NarrativeStage episode={10} title="Specialties">
        <Typography.Paragraph>
          Nine remain. Mike announces tailored solo stages and a test of their closest bonds.
        </Typography.Paragraph>
        {actionError && <Alert role="alert" title={actionError} type="error" />}
        <Space wrap>
          <Button onClick={() => onAction({ type: 'start' }, preparation?.revision ?? 0)} type="primary">
            Start Episode 10 — Specialties
          </Button>
          <AutoCompleteEpisodeButton episode={10} state={state} />
        </Space>
      </NarrativeStage>
    );
  const latest = episode.scenes.at(-1);
  const scene =
    episode.scenes.find((entry) => history?.runId === runtime.runId && entry.id === history.sceneId) ??
    latest;
  const lookingBack = scene?.id !== latest?.id;
  const decision = episode.phase === 'secret-choice';
  const credits = scene?.presentation === 'credits';
  const act = (action: SpecialtiesAction) => onAction(action, episode.revision);
  const person = (id: string) => {
    const result = state.contestants.find((entry) => entry.id === id);
    if (!result) throw new Error(`Unknown Specialties contestant "${id}".`);
    return result;
  };
  const link = (id: string) => (
    <Button data-contestant-id={id} onClick={() => onInspect(id)} type="link">
      {person(id).name}
    </Button>
  );
  const final = !lookingBack && episode.phase === 'complete';
  const showRanking = episode.rankRevealed && (scene?.kind === 'ranking' || final);
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
    <EpisodeEndScreens enabled={!lookingBack} episode={10} onInspect={onInspect} state={state}>
      <CopyEpisodeRundown episode={10} state={state} />
      {!decision && (
        <AutoCompleteEpisodeButton episode={10} onCompleted={() => setHistory(null)} state={state} />
      )}
      <NarrativeStage
        episode={10}
        eyebrow={scene?.sequence ? `SEQUENCE ${scene.sequence}${lookingBack ? ' / Archive' : ''}` : undefined}
        footer={
          lookingBack ? (
            <Button onClick={() => setHistory(null)}>Return to current scene</Button>
          ) : final ? (
            <Typography.Text>
              Episode complete. Eight reach the upcoming finale; it has not begun.
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
        title={scene?.title ?? 'Specialties'}
      >
        {!decision && actionError && <Alert role="alert" title={actionError} type="error" />}
        {showRanking && (
          <ol aria-label="Episode 10 standings" style={{ listStyle: 'none', paddingLeft: 0 }}>
            {episode.rankedIds.map((id, index) => {
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
                    {episode.eliminatedId === id && (
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
          title="Your decision: investigate a secret"
        >
          <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            <AutoCompleteEpisodeButton episode={10} onCompleted={() => setHistory(null)} state={state} />
            {actionError && <Alert role="alert" title={actionError} type="error" />}
            {episode.secretCandidates.map((id) => (
              <Space key={id}>
                {link(id)}
                <Button onClick={() => act({ type: 'secret', contestantId: id })} type="primary">
                  Investigate {person(id).name}
                </Button>
              </Space>
            ))}
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
              key: 'rehearsals',
              label: 'Details — completed solo rehearsals',
              children: episode.rehearsals.map((entry) => (
                <Typography.Paragraph key={`${entry.contestantId}-${entry.session}`}>
                  {link(entry.contestantId)} — rehearsal {entry.session}, dice {entry.rawDice.join(' + ')};
                  readiness {entry.practiceAfter}/5
                  {entry.enduranceStruggle ? '; endurance struggle (−5)' : ''}.
                </Typography.Paragraph>
              )),
            },
            {
              key: 'performances',
              label: 'Details — performed solo stages',
              children: episode.performances.map((entry) => (
                <Typography.Paragraph key={entry.contestantId}>
                  {link(entry.contestantId)} — dice {entry.rawDice.join(' + ')}; track{' '}
                  {entry.technical.toFixed(2)}, matched visual {entry.matchedVisual.toFixed(2)}; observed
                  performance {entry.observedScore.toFixed(2)}/100, before peer rankings.
                </Typography.Paragraph>
              )),
            },
            ...(episode.panel.length
              ? [
                  {
                    key: 'panel',
                    label: 'Details — track 3, judges 1 each, peers 2',
                    children: episode.panel.map((entry) => (
                      <Typography.Paragraph key={entry.contestantId}>
                        {link(entry.contestantId)} — track {entry.performance.toFixed(2)}, John{' '}
                        {entry.john.toFixed(2)}, Megan {entry.megan.toFixed(2)}, Michael{' '}
                        {entry.michael.toFixed(2)}, received peer average {entry.peer.toFixed(2)}; weighted
                        result {entry.finalScore.toFixed(2)}/100 ({entry.grade}).
                      </Typography.Paragraph>
                    )),
                  },
                ]
              : []),
            ...(episode.peer
              ? [
                  {
                    key: 'peer-reference',
                    label: 'Viewer-only — secret peer rankings (not broadcast)',
                    children: (
                      <>
                        <Typography.Paragraph type="secondary">
                          Contestants learn received averages only. These individual ballots and motives are
                          viewer reference, not host dialogue or knowledge shared with the cast.
                        </Typography.Paragraph>
                        {episode.peer.ballots.map((ballot) => (
                          <div key={ballot.voterId}>
                            <Typography.Paragraph>
                              {link(ballot.voterId)} — {ballot.profile}
                            </Typography.Paragraph>
                            <ol>
                              {ballot.rankedIds.map((id) => (
                                <li key={id}>{link(id)}</li>
                              ))}
                            </ol>
                            {ballot.reasons.map((reason, index) => (
                              <Typography.Paragraph key={index}>{reason}</Typography.Paragraph>
                            ))}
                          </div>
                        ))}
                      </>
                    ),
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
