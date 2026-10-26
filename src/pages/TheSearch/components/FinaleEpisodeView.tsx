import { Alert, Button, Checkbox, Collapse, Modal, Space, Typography } from 'antd';
import { useState } from 'react';
import type { FinaleAction } from '../types/finale-episode';
import type { SimulationState } from '../types/simulation';
import { AutoCompleteEpisodeButton } from './AutoCompleteEpisodeButton';
import { ContestantAvatar } from './ContestantAvatar';
import { CopyEpisodeRundown } from './CopyEpisodeRundown';
import { EpisodeNarrative, EpisodeSceneNarrative } from './EpisodeNarrative';
import { PreparationDialog } from './NarrativeEpisodeView';
import styles from './NarrativeEpisodeView.module.scss';
import { NarrativeStage, OpeningCredits } from './NarrativeStage';
import { PersonnelAvatar } from './personnel/PersonnelAvatar';
import { EpisodeEndScreens } from './RelationshipUpdates';
import { PropertyChangeValue } from './SimulationChange';

export function FinaleEpisodeView({
  state,
  onAction,
  onInspect,
  actionError,
}: {
  state: SimulationState;
  onAction: (action: FinaleAction, revision: number) => void;
  onInspect: (id: string) => void;
  actionError?: string | null;
}) {
  const [history, setHistory] = useState<{ runId: string; sceneId: string } | null>(null);
  const [selection, setSelection] = useState<{ identity: string; ids: string[] } | null>(null);
  const runtime = state.runtime;
  if (runtime?.version !== 3 || runtime.specialties?.phase !== 'complete') return null;
  const episode = runtime.finale;
  const preparation = runtime.preparations?.[11];
  if (!episode && preparation && (!preparation.mood || preparation.requiredSelections > 0))
    return (
      <PreparationDialog
        actionError={actionError}
        key={`${runtime.runId}-11-${preparation.mood ? 'cast' : 'mood'}`}
        onAction={onAction}
        onInspect={onInspect}
        phase={preparation.mood ? 'opening-cast' : 'mood'}
        preparation={preparation}
        state={state}
      />
    );
  if (!episode)
    return (
      <NarrativeStage episode={11} title="The Finale">
        <Typography.Paragraph>
          Eight finalists. Two original songs. Five places in Squirrel Zone.
        </Typography.Paragraph>
        {actionError && <Alert role="alert" title={actionError} type="error" />}
        <Space wrap>
          <Button onClick={() => onAction({ type: 'start' }, preparation?.revision ?? 0)} type="primary">
            Start Episode 11 — The Finale
          </Button>
          <AutoCompleteEpisodeButton episode={11} state={state} />
        </Space>
      </NarrativeStage>
    );
  const latest = episode.scenes.at(-1);
  const scene =
    episode.scenes.find((entry) => history?.runId === runtime.runId && entry.id === history.sceneId) ??
    latest;
  const lookingBack = scene?.id !== latest?.id;
  const decision = episode.phase === 'executive-choice';
  const identity = `${runtime.runId}:${episode.revision}`;
  const selectedIds = selection?.identity === identity ? selection.ids : [];
  const act = (action: FinaleAction) => onAction(action, episode.revision);
  const person = (id: string) => {
    const result = state.contestants.find((entry) => entry.id === id);
    if (!result) throw new Error(`Unknown finale contestant "${id}".`);
    return result;
  };
  const link = (id: string) => (
    <Button data-contestant-id={id} onClick={() => onInspect(id)} type="link">
      {person(id).name}
    </Button>
  );
  const final = !lookingBack && episode.phase === 'complete';
  const credits = scene?.presentation === 'credits';
  return (
    <EpisodeEndScreens enabled={!lookingBack} episode={11} onInspect={onInspect} state={state}>
      <CopyEpisodeRundown episode={11} state={state} />
      {!decision && (
        <AutoCompleteEpisodeButton episode={11} onCompleted={() => setHistory(null)} state={state} />
      )}
      <NarrativeStage
        episode={11}
        eyebrow={scene?.sequence ? `SEQUENCE ${scene.sequence}${lookingBack ? ' / Archive' : ''}` : undefined}
        footer={
          lookingBack ? (
            <Button onClick={() => setHistory(null)}>Return to current scene</Button>
          ) : final ? (
            <Typography.Text>Squirrel Zone: The Search has concluded.</Typography.Text>
          ) : decision ? (
            <Typography.Text>The episode is paused for your private decision.</Typography.Text>
          ) : (
            <Button onClick={() => act({ type: 'advance' })} type="primary">
              Continue
            </Button>
          )
        }
        speaker={scene?.speaker?.name}
        speakerRole={scene?.speaker?.role}
        title={scene?.title ?? 'The Finale'}
      >
        {!decision && actionError && <Alert role="alert" title={actionError} type="error" />}
        {!credits && scene && (
          <EpisodeSceneNarrative
            contestants={state.contestants}
            onInspect={onInspect}
            reactions={[]}
            scene={scene}
          />
        )}
        {scene?.dialogues?.map((dialogue, index) => (
          <div className={styles.dialogue} key={`${scene.id}-${index}`}>
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
              <Typography.Paragraph key={`${id}-${index}`}>
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
        {!lookingBack && episode.revealedWinnerIds.length > 0 && (
          <ol aria-label="Announced Squirrel Zone members" style={{ listStyle: 'none', paddingLeft: 0 }}>
            {episode.revealedWinnerIds.map((id) => (
              <li key={id}>
                <Space wrap>
                  <Typography.Text strong>{episode.winnerIds.indexOf(id) + 1}.</Typography.Text>
                  <ContestantAvatar enablePreview={false} id={id} name={person(id).name} size={32} />
                  {link(id)}
                  {episode.centerId === id && <Typography.Text strong>Official Center</Typography.Text>}
                </Space>
              </li>
            ))}
          </ol>
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
          title="Private label decision — choose exactly three"
        >
          <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            <Typography.Paragraph>
              Label Executive access only. This choice is not broadcast or shared with the contestants. Choose
              three finalists for +0.50 production preference (capped at +1) and +50 final points each.
              Selection does not guarantee a debut place.
            </Typography.Paragraph>
            {actionError && <Alert role="alert" title={actionError} type="error" />}
            <Checkbox.Group onChange={(ids) => setSelection({ identity, ids })} value={selectedIds}>
              <Space orientation="vertical">
                {episode.participantIds.map((id) => (
                  <Space key={id}>
                    <Checkbox value={id}>{person(id).name}</Checkbox>
                    {link(id)}
                  </Space>
                ))}
              </Space>
            </Checkbox.Group>
            <Typography.Text>{selectedIds.length}/3 selected</Typography.Text>
            <Button
              disabled={selectedIds.length !== 3}
              onClick={() => act({ type: 'executive', contestantIds: selectedIds })}
              type="primary"
            >
              Confirm three executive selections
            </Button>
          </Space>
        </Modal>
      )}
      {!lookingBack && (
        <Collapse
          items={[
            {
              key: 'rehearsals',
              label: 'Details — completed finale rehearsals',
              children: episode.rehearsals.map((entry) => (
                <Typography.Paragraph key={`${entry.contestantId}-${entry.session}`}>
                  {link(entry.contestantId)} — rehearsal {entry.session}, dice {entry.rawDice.join(' + ')},
                  readiness {entry.readinessAfter}/5.
                </Typography.Paragraph>
              )),
            },
            {
              key: 'performances',
              label: 'Details — performances already seen',
              children: (
                [
                  ['Original', episode.originalPerformances],
                  ['Squirrel Life', episode.themePerformances],
                ] as const
              ).flatMap(([label, performances]) =>
                performances.map((entry) => (
                  <Typography.Paragraph key={`${label}-${entry.contestantId}`}>
                    {link(entry.contestantId)} — {label}, dice {entry.rawDice.join(' + ')}; technical result{' '}
                    {entry.technical.toFixed(2)}/100
                    {entry.breakdownPenalty ? `; breakdown adjustment −${entry.breakdownPenalty}` : ''}.
                  </Typography.Paragraph>
                )),
              ),
            },
            ...(episode.executive
              ? [
                  {
                    key: 'private',
                    label: 'Private label reference — not broadcast',
                    children: (
                      <>
                        <Typography.Paragraph>
                          Not cast knowledge or additional footage. No judging or public-vote bonus is awarded
                          for the selection.
                        </Typography.Paragraph>
                        {episode.executive.effects.map((entry) => (
                          <Typography.Paragraph key={entry.contestantId}>
                            {link(entry.contestantId)} — production preference {entry.before.toFixed(2)} →{' '}
                            {entry.after.toFixed(2)}; +{entry.rankingBonus} final points.
                          </Typography.Paragraph>
                        ))}
                      </>
                    ),
                  },
                ]
              : []),
            ...(episode.resultsPublished
              ? [
                  {
                    key: 'final-scores',
                    label: 'Viewer-only final scores — not broadcast',
                    children: (
                      <>
                        <Typography.Paragraph>
                          Original/theme 50/50. Technical/panel 50/50. All seven judges have equal weight.
                          Prior points are retained in full.
                        </Typography.Paragraph>
                        {episode.rankedIds.map((id, index) => {
                          const score = episode.rankingComponents[id];
                          const panel = episode.panel.find((entry) => entry.contestantId === id)!;
                          return (
                            <div key={id}>
                              <Typography.Paragraph>
                                {index + 1}. {link(id)} — {panel.grade}, evaluation{' '}
                                {panel.finalScore.toFixed(2)}; prior {score.prior.toFixed(2)} + performance{' '}
                                {score.performance.toFixed(2)} + votes {score.publicVotes.toFixed(2)} +
                                production {score.production.toFixed(2)} + executive{' '}
                                {score.executive.toFixed(2)} = {score.total.toFixed(2)}.
                              </Typography.Paragraph>
                              {episode.personnel.map((judge) => (
                                <Typography.Paragraph key={judge.id}>
                                  {judge.name}: {panel.judges[judge.id].score.toFixed(2)}/100.
                                </Typography.Paragraph>
                              ))}
                            </div>
                          );
                        })}
                      </>
                    ),
                  },
                ]
              : []),
          ]}
        />
      )}
      {final && episode.postSeason && (
        <section aria-label="Viewer-only post-season outcome">
          <Typography.Title level={3}>Viewer-only — after the broadcast</Typography.Title>
          <Typography.Paragraph>
            Final audience: {episode.postSeason.audience.toLocaleString()}. Satisfaction:{' '}
            {episode.postSeason.satisfaction.toFixed(2)}%. Retained group fans:{' '}
            {episode.postSeason.retainedGroupFans.toLocaleString()} (
            {(100 * episode.postSeason.retainedShare).toFixed(2)}%). Non-retained viewers:{' '}
            {episode.postSeason.nonRetainedViewers.toLocaleString()}.
          </Typography.Paragraph>
          <Typography.Paragraph type="secondary">
            Derived from audience × satisfaction, rounded down. This forecast does not change the live
            audience ledger or final results.
          </Typography.Paragraph>
        </section>
      )}
      <Collapse
        items={[
          {
            key: 'history',
            label: 'Previously aired scenes',
            children: (
              <Space orientation="vertical">
                {episode.scenes.map((entry) => (
                  <Button
                    key={entry.id}
                    onClick={() => setHistory({ runId: runtime.runId, sceneId: entry.id })}
                  >
                    {entry.sequence}. {entry.title}
                  </Button>
                ))}
              </Space>
            ),
          },
        ]}
      />
    </EpisodeEndScreens>
  );
}
