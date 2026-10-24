import { Alert, Button, Collapse, Modal, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import type { AuditionEvaluation } from '../types/audition';
import type { AuditionAction, EpisodeScene, MoodChoices } from '../types/audition-episode';
import type { BattleAction } from '../types/battle-episode';
import type { EpisodePreparation, JudgeId, PreparationAction } from '../types/narrative';
import type { SimulationState } from '../types/simulation';
import { BattleEpisodeView } from './BattleEpisodeView';
import { ContestantAvatar } from './ContestantAvatar';
import { CopyEpisodeRundown } from './CopyEpisodeRundown';
import { EpisodeSceneNarrative } from './EpisodeNarrative';
import { NarrativeBattlePlayer } from './NarrativeBattlePlayer';
import styles from './NarrativeEpisodeView.module.scss';
import { NarrativeStage, OpeningCredits } from './NarrativeStage';
import { PersonnelAvatar } from './personnel/PersonnelAvatar';

export { NarrativeStage, OpeningCredits } from './NarrativeStage';

interface NarrativeProps<Action> {
  state: SimulationState;
  onAction: (action: Action, expectedRevision: number) => void;
  onInspect: (id: string) => void;
  actionError?: string | null;
}

const judges: Record<JudgeId, { name: string; role: string; focus: string }> = {
  john: { name: 'John Stan', role: 'Music producer', focus: 'The song’s vocal, rap and dance demands.' },
  megan: { name: 'Megan Ryder', role: 'Veteran artist', focus: 'Stage presence, potential and uniqueness.' },
  michael: {
    name: 'Michael Lion',
    role: 'Record-label executive',
    focus: 'Visual, consistency and leadership.',
  },
};
const moodFields: { key: keyof MoodChoices; label: string }[] = [
  { key: 'vocalColor', label: 'Vocal color' },
  { key: 'danceStyle', label: 'Dance style' },
  { key: 'rapStyle', label: 'Rap style' },
  { key: 'visualVibe', label: 'Visual vibe' },
  { key: 'leadershipStyle', label: 'Leadership style' },
  { key: 'genreAffinity', label: 'Genre affinity' },
];
const emptyMood: MoodChoices = {
  vocalColor: '',
  danceStyle: '',
  rapStyle: '',
  visualVibe: '',
  leadershipStyle: '',
  genreAffinity: '',
};

export function NarrativeContinue({
  onAction,
  revision,
  label = 'Continue',
}: {
  onAction: (action: { type: 'advance' }, expectedRevision: number) => void;
  revision: number;
  label?: string;
}) {
  return (
    <Button onClick={() => onAction({ type: 'advance' }, revision)} size="large" type="primary">
      {label}
    </Button>
  );
}

export function PreparationDialog({
  state,
  preparation,
  phase,
  onAction,
  onInspect,
  actionError,
}: NarrativeProps<PreparationAction> & {
  preparation: EpisodePreparation;
  phase: 'opening-cast' | 'mood';
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [draft, setDraft] = useState<{ choices: MoodChoices; randomized: MoodChoices | null }>({
    choices: preparation.randomizedMood ?? emptyMood,
    randomized: preparation.randomizedMood,
  });
  const [validationError, setValidationError] = useState('');
  const mood =
    draft.randomized === preparation.randomizedMood
      ? draft.choices
      : (preparation.randomizedMood ?? emptyMood);
  const act = (action: PreparationAction) => onAction(action, preparation.revision);
  const cast = phase === 'opening-cast';
  return (
    <Modal
      centered
      closable={false}
      footer={null}
      keyboard={false}
      mask={{ closable: false }}
      open
      styles={{ body: { maxHeight: '75vh', overflowY: 'auto' } }}
      title={cast ? 'Choose the opening cast' : 'Set this episode’s opening mood'}
      width={880}
    >
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <Typography.Paragraph>
          {cast
            ? `Fill ${preparation.requiredSelections} opening ${preparation.requiredSelections === 1 ? 'slot' : 'slots'}. Your retained cast keeps its place.`
            : 'Choose one taste in each category. These audience spotlights apply to this episode, not the judges’ scoring.'}
        </Typography.Paragraph>
        {(actionError || validationError) && (
          <Alert role="alert" title={actionError || validationError} type="error" />
        )}
        {cast ? (
          <>
            <div aria-label="Five opening slots" className={styles.slots} role="group">
              {preparation.slots.map((id, index) => {
                const filled =
                  id ?? selected[preparation.slots.slice(0, index).filter((slot) => slot === null).length];
                const name = state.contestants.find((person) => person.id === filled)?.name;
                return (
                  <div className={styles.slot} key={`slot-${index + 1}`}>
                    <small>Slot {index + 1}</small>
                    {filled ? (
                      <>
                        <ContestantAvatar enablePreview={false} id={filled} name={name ?? filled} size={44} />
                        <span>{name ?? filled}</span>
                      </>
                    ) : (
                      <span>Open</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div aria-label="Opening candidates" className={styles.candidates} role="group">
              {preparation.shortlist.map((id) => {
                const name = state.contestants.find((person) => person.id === id)?.name ?? id;
                return (
                  <div className={styles.candidate} key={id}>
                    <Button
                      aria-checked={selected.includes(id)}
                      className={styles.choice}
                      disabled={!selected.includes(id) && selected.length >= preparation.requiredSelections}
                      onClick={() =>
                        setSelected((previous) =>
                          previous.includes(id)
                            ? previous.filter((entry) => entry !== id)
                            : [...previous, id],
                        )
                      }
                      role="checkbox"
                      type={selected.includes(id) ? 'primary' : 'default'}
                    >
                      <ContestantAvatar enablePreview={false} id={id} name={name} size={42} />
                      {selected.includes(id) ? 'Selected' : 'Select'}
                    </Button>
                    <Button onClick={() => onInspect(id)} type="link">
                      {name}
                    </Button>
                  </div>
                );
              })}
            </div>
            <Button
              onClick={() => {
                if (
                  selected.length !== preparation.requiredSelections ||
                  selected.some((id) => !preparation.shortlist.includes(id))
                ) {
                  setValidationError(`Select exactly ${preparation.requiredSelections} contestants.`);
                  return;
                }
                setValidationError('');
                act({ type: 'opening-cast', contestantIds: selected });
              }}
              type="primary"
            >
              Confirm opening cast ({selected.length}/{preparation.requiredSelections})
            </Button>
          </>
        ) : (
          <>
            <div className={styles.moodFields}>
              {moodFields.map(({ key, label }) => (
                <fieldset className={styles.field} key={key}>
                  <legend>{label}</legend>
                  <Space wrap>
                    {preparation.moodOptions[key].map((id) => (
                      <Button
                        aria-pressed={mood[key] === id}
                        key={id}
                        onClick={() =>
                          setDraft({
                            randomized: preparation.randomizedMood,
                            choices: { ...mood, [key]: id },
                          })
                        }
                        type={mood[key] === id ? 'primary' : 'default'}
                      >
                        {state.runtime?.definitions.specialties[key][id]?.name ?? id}
                      </Button>
                    ))}
                  </Space>
                </fieldset>
              ))}
            </div>
            <Space wrap>
              <Button onClick={() => act({ type: 'randomize-mood' })}>Randomize</Button>
              <Button
                onClick={() => {
                  if (!moodFields.every(({ key }) => preparation.moodOptions[key].includes(mood[key]))) {
                    setValidationError('Choose one option in all six categories.');
                    return;
                  }
                  setValidationError('');
                  act({ type: 'mood', choices: { ...mood } });
                }}
                type="primary"
              >
                Confirm opening mood
              </Button>
            </Space>
          </>
        )}
        <Typography.Text type="secondary">
          The episode is paused until your decision is saved.
        </Typography.Text>
      </Space>
    </Modal>
  );
}

function StoredEvaluation({ evaluation }: { evaluation: AuditionEvaluation }) {
  return (
    <Space orientation="vertical">
      <Typography.Text>
        <Tag>Grade {evaluation.grade}</Tag> Final {evaluation.finalScore.toFixed(1)}
      </Typography.Text>
      {evaluation.panel?.track && (
        <div>
          Song track — {evaluation.panel.track.skill}: {evaluation.panel.track.score.toFixed(1)} · weight 3
        </div>
      )}
      {evaluation.panel &&
        Object.entries(evaluation.panel.scores).map(([id, score]) => (
          <div key={id}>
            {judges[id as JudgeId].name}: {score.toFixed(1)}
            {id === evaluation.panel?.lead ? ' · leading judge (double weight)' : ''}
          </div>
        ))}
      <Typography.Text type="secondary">
        Raw dice: {evaluation.rawDice.join(' + ')} · <Tag>Composure {evaluation.composure}</Tag>
      </Typography.Text>
      <Typography.Text>Song checks within the technical evaluation:</Typography.Text>
      {evaluation.technical.checks.map((check) => (
        <div key={check.skill}>
          {check.skill}: {check.score.toFixed(1)} · skill {check.skillLevel}, requirement{' '}
          {check.requiredLevel}, floor {check.floor}, adjusted dice {check.adjustedDice.join(' + ')}, weight{' '}
          {check.weight} within technical scoring
        </div>
      ))}
      <div>Stage presence: {evaluation.stagePresence.score.toFixed(1)}</div>
      {Object.entries(evaluation.impressions).map(([key, check]) => (
        <div key={key}>
          {key}: {check.score.toFixed(1)}
        </div>
      ))}
      {evaluation.panel && (
        <>
          <div>Consistency: {evaluation.panel.consistency.toFixed(1)}</div>
          <div>Leadership: {evaluation.panel.leadership.toFixed(1)}</div>
          {[evaluation.panel.consistencyCheck, evaluation.panel.leadershipCheck].map((check) => (
            <div key={check.skill}>
              {check.skill}: skill {check.skillLevel}, requirement {check.requiredLevel}, floor {check.floor},
              adjusted dice {check.adjustedDice.join(' + ')}, ceiling {check.ceiling}
            </div>
          ))}
        </>
      )}
    </Space>
  );
}

export function NarrativeAuditionView({
  state,
  onAction,
  onInspect,
  actionError,
}: NarrativeProps<AuditionAction>) {
  const [history, setHistory] = useState<{ runId: string; sceneId: string } | null>(null);
  const runtime = state.runtime;
  if (!runtime) return null;
  const episode = runtime.audition;
  if (!episode)
    return (
      <NarrativeStage
        episode={1}
        footer={
          <Button onClick={() => onAction({ type: 'start' }, 0)} type="primary">
            Start Episode 1 — Auditions
          </Button>
        }
        speaker="Mike Philip"
        speakerRole="Host"
        title="Auditions"
      >
        <p>Fifty contestants. Five places in the next Squirrel Zone. The search starts here.</p>
        {actionError && <Alert title={actionError} type="error" />}
      </NarrativeStage>
    );
  const preparation = runtime.preparations?.[1];
  const preparing = episode.phase === 'opening-cast' || episode.phase === 'mood';
  const latest = episode.scenes.at(-1);
  const archived = episode.scenes.find(
    (scene) => history?.runId === runtime.runId && scene.id === history.sceneId,
  );
  const selected = archived ?? latest;
  const lookingBack = !!archived;
  const presentation = selected?.presentation ?? (lookingBack ? undefined : episode.story?.presentation);
  const evaluation =
    presentation === 'performance'
      ? episode.evaluations.find((entry) => selected?.contestantIds.includes(entry.contestantId))
      : undefined;
  const panel = evaluation?.panel;
  const host = !!selected?.speaker || presentation === 'host' || presentation === 'results';
  const blocking = preparing || episode.phase === 'secret';
  const act = (action: AuditionAction) => onAction(action, episode.revision);
  const renderScene = (scene: EpisodeScene) => (
    <EpisodeSceneNarrative
      contestants={state.contestants}
      onInspect={onInspect}
      reactions={episode.reactions}
      scene={scene}
    />
  );
  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <CopyEpisodeRundown episode={1} state={state} />
      {preparing && preparation && (
        <PreparationDialog
          actionError={actionError}
          key={`${runtime.runId}-1-${episode.phase}`}
          onAction={(action) => onAction(action, episode.revision)}
          onInspect={onInspect}
          phase={episode.phase === 'opening-cast' ? 'opening-cast' : 'mood'}
          preparation={preparation}
          state={state}
        />
      )}
      <Modal
        centered
        closable={false}
        footer={null}
        keyboard={false}
        mask={{ closable: false }}
        open={episode.phase === 'secret'}
        title="Investigate a secret"
      >
        <Space orientation="vertical">
          <p>Choose one contestant to investigate before the episode closes.</p>
          {actionError && <Alert title={actionError} type="error" />}
          {episode.secretCandidates.map((id) => (
            <Space key={id}>
              <Button onClick={() => act({ type: 'secret', contestantId: id })}>
                Investigate {state.contestants.find((person) => person.id === id)?.name ?? id}
              </Button>
              <Button onClick={() => onInspect(id)} type="link">
                View details
              </Button>
            </Space>
          ))}
        </Space>
      </Modal>
      <NarrativeStage
        episode={1}
        eyebrow={lookingBack ? 'ARCHIVE' : episode.story ? `SEQUENCE ${episode.story.sequence}` : undefined}
        footer={
          lookingBack ? (
            <>
              <Typography.Text type="secondary">Read-only episode archive</Typography.Text>
              <Button onClick={() => setHistory(null)}>Return to current scene</Button>
            </>
          ) : episode.phase === 'complete' ? (
            <Typography.Text>Episode complete · Thirty contestants continue their journey.</Typography.Text>
          ) : !blocking ? (
            <NarrativeContinue
              label={
                episode.phase === 'host-intro'
                  ? 'Play the opening sequence'
                  : episode.phase === 'credits'
                    ? 'Meet the judges'
                    : episode.phase === 'introduction'
                      ? 'Watch the audition'
                      : episode.phase === 'live' && episode.cursor === 50
                        ? 'Hear the judges’ decision'
                        : episode.phase === 'judges' || episode.phase === 'live'
                          ? 'Meet the next contestants'
                          : episode.phase === 'eliminations'
                            ? 'Reveal the next departures'
                            : episode.phase === 'mvp'
                              ? episode.mvp
                                ? 'Investigate a secret'
                                : 'Hear the survivors’ MVP'
                              : 'Continue the episode'
              }
              onAction={onAction}
              revision={episode.revision}
            />
          ) : (
            <Typography.Text type="secondary">
              Your production decision is required to continue.
            </Typography.Text>
          )
        }
        speaker={host ? (selected?.speaker?.name ?? 'Mike Philip') : undefined}
        speakerRole={host ? (selected?.speaker?.role ?? 'Host') : undefined}
        title={selected?.title ?? (preparing ? 'Before the curtain rises' : 'Auditions')}
      >
        {actionError && !blocking && <Alert title={actionError} type="error" />}
        {presentation === 'credits' && (
          <OpeningCredits ids={selected?.contestantIds ?? []} onInspect={onInspect} state={state} />
        )}
        {presentation === 'judges' && (
          <div className={styles.judges}>
            {Object.values(judges).map((judge) => (
              <article key={judge.name}>
                <PersonnelAvatar name={judge.name} />
                <h3>{judge.name}</h3>
                <small>{judge.role}</small>
                <p>{judge.focus}</p>
              </article>
            ))}
          </div>
        )}
        {selected ? (
          presentation !== 'credits' && renderScene(selected)
        ) : (
          <p>
            The opening cast and mood are chosen before the first performance. No audition has been judged
            yet.
          </p>
        )}
        {selected?.introductions && (
          <Collapse
            items={Object.entries(selected.introductions).map(([id, paragraphs]) => ({
              key: id,
              label: `Meet ${state.contestants.find((entry) => entry.id === id)?.name ?? id}`,
              children: renderScene({
                id: `profile-${id}`,
                kind: 'choices',
                title: 'Public introduction',
                paragraphs,
                contestantIds: [id],
                paragraphContestantIds: paragraphs.map(() => [id]),
              }),
            }))}
          />
        )}
        {episode.evaluations.length === 0 && !preparing && (
          <Typography.Text type="secondary">Before the first performance · No grade yet</Typography.Text>
        )}
        {evaluation && panel && (
          <div className={styles.judgeComment}>
            <Tag>Grade {evaluation.grade}</Tag>
            <div className={styles.dialogue}>
              <div className={styles.speaker}>
                <PersonnelAvatar name={judges[panel.lead].name} />
                <strong>{judges[panel.lead].name}</strong>
                <small>{judges[panel.lead].role}</small>
              </div>
              <blockquote className={styles.bubble}>{panel.comment}</blockquote>
            </div>
          </div>
        )}
      </NarrativeStage>
      <Collapse
        items={[
          {
            key: 'details',
            label: 'Details — performed auditions',
            children: episode.evaluations.length ? (
              <Collapse
                items={episode.evaluations.map((item) => ({
                  key: item.contestantId,
                  label:
                    state.contestants.find((person) => person.id === item.contestantId)?.name ??
                    item.contestantId,
                  children: (
                    <Space orientation="vertical" style={{ width: '100%' }}>
                      <StoredEvaluation evaluation={item} />
                      <Collapse
                        items={[
                          {
                            key: 'reactions',
                            label: 'All recorded audition reactions',
                            children: (
                              <EpisodeSceneNarrative
                                contestants={state.contestants}
                                onInspect={onInspect}
                                reactions={[]}
                                scene={{
                                  id: `reactions-${item.contestantId}`,
                                  kind: 'auditions',
                                  title: 'Recorded reactions',
                                  paragraphs: episode.reactions
                                    .filter((entry) => entry.performerId === item.contestantId)
                                    .map((entry) => entry.narrative),
                                  paragraphContestantIds: episode.reactions
                                    .filter((entry) => entry.performerId === item.contestantId)
                                    .map((entry) => [entry.observerId, entry.performerId]),
                                  contestantIds: [],
                                }}
                              />
                            ),
                          },
                        ]}
                      />
                    </Space>
                  ),
                }))}
              />
            ) : (
              <p>No performances have been judged.</p>
            ),
          },
          {
            key: 'archive',
            label: 'Archive — saved scenes',
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

export function NarrativeBattleView({
  state,
  onAction,
  onInspect,
  actionError,
}: NarrativeProps<BattleAction>) {
  const runtime = state.runtime;
  if (!runtime) return null;
  const preparation = runtime.preparations?.[2];
  const episode = runtime.battle;
  if (!episode && preparation && (!preparation.mood || preparation.requiredSelections > 0))
    return (
      <PreparationDialog
        actionError={actionError}
        key={`${runtime.runId}-2-${preparation.mood ? 'cast' : 'mood'}`}
        onAction={onAction}
        onInspect={onInspect}
        phase={!preparation.mood ? 'mood' : 'opening-cast'}
        preparation={preparation}
        state={state}
      />
    );
  if (runtime.version === 3)
    return (
      <NarrativeBattlePlayer
        actionError={actionError}
        onAction={onAction}
        onInspect={onInspect}
        state={state}
      />
    );
  const latest = episode?.scenes.at(-1);
  if (episode && latest?.title === 'Opening credits')
    return (
      <NarrativeStage
        episode={2}
        footer={
          <NarrativeContinue
            label="The next morning — to the stage"
            onAction={onAction}
            revision={episode.revision}
          />
        }
        title="Opening credits"
      >
        {actionError && <Alert title={actionError} type="error" />}
        <OpeningCredits ids={runtime.openingCast ?? []} onInspect={onInspect} state={state} />
      </NarrativeStage>
    );
  return (
    <BattleEpisodeView actionError={actionError} onAction={onAction} onInspect={onInspect} state={state} />
  );
}
