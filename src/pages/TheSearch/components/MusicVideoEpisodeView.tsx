import { Alert, Button, Collapse, Modal, Space, Typography } from 'antd';
import { useState } from 'react';
import type { MusicVideoAction } from '../types/music-video-episode';
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
import { ChangeDirection, PropertyChangeValue } from './SimulationChange';

export function MusicVideoEpisodeView({
  state,
  onAction,
  onInspect,
  actionError,
}: {
  state: SimulationState;
  onAction: (action: MusicVideoAction, revision: number) => void;
  onInspect: (id: string) => void;
  actionError?: string | null;
}) {
  const [history, setHistory] = useState<{ runId: string; sceneId: string } | null>(null);
  const runtime = state.runtime;
  if (runtime?.version !== 3 || runtime.varietyShow?.phase !== 'complete') return null;
  const episode = runtime.musicVideo;
  const preparation = runtime.preparations?.[9];
  if (!episode && preparation && (!preparation.mood || preparation.requiredSelections > 0))
    return (
      <PreparationDialog
        actionError={actionError}
        key={`${runtime.runId}-9-${preparation.mood ? 'cast' : 'mood'}`}
        onAction={onAction}
        onInspect={onInspect}
        phase={preparation.mood ? 'opening-cast' : 'mood'}
        preparation={preparation}
        state={state}
      />
    );
  if (!episode)
    return (
      <NarrativeStage episode={9} title="Music Videos">
        <Typography.Paragraph>
          Ten remain. Mike announces the official music video for Squirrel Life and asks for their ideas.
        </Typography.Paragraph>
        {actionError && <Alert role="alert" title={actionError} type="error" />}
        <Space wrap>
          <Button onClick={() => onAction({ type: 'start' }, preparation?.revision ?? 0)} type="primary">
            Start Episode 9 — Music Videos
          </Button>
          <AutoCompleteEpisodeButton episode={9} state={state} />
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
  const act = (action: MusicVideoAction) => onAction(action, episode.revision);
  const person = (id: string) => {
    const result = state.contestants.find((entry) => entry.id === id);
    if (!result) throw new Error(`Unknown Music Videos contestant "${id}".`);
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
    <EpisodeEndScreens enabled={!lookingBack} episode={9} onInspect={onInspect} state={state}>
      <CopyEpisodeRundown episode={9} state={state} />
      {!decision && (
        <AutoCompleteEpisodeButton episode={9} onCompleted={() => setHistory(null)} state={state} />
      )}
      <NarrativeStage
        episode={9}
        eyebrow={scene?.sequence ? `SEQUENCE ${scene.sequence}${lookingBack ? ' / Archive' : ''}` : undefined}
        footer={
          lookingBack ? (
            <Button onClick={() => setHistory(null)}>Return to current scene</Button>
          ) : final ? (
            <Typography.Text>
              Episode complete. Nine continue. Episode 10 is next; it has not begun.
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
        title={scene?.title ?? 'Music Videos'}
      >
        {!decision && actionError && <Alert role="alert" title={actionError} type="error" />}
        {showRanking && (
          <ol aria-label="Episode 9 standings" style={{ listStyle: 'none', paddingLeft: 0 }}>
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
            <AutoCompleteEpisodeButton episode={9} onCompleted={() => setHistory(null)} state={state} />
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
              key: 'solos',
              label: 'Details — filmed solo scenes',
              children: episode.solos.map((entry) => (
                <Typography.Paragraph key={entry.contestantId}>
                  {link(entry.contestantId)} — dice {entry.rawDice.join(' + ')}; solo{' '}
                  {entry.finalScore.toFixed(2)}/100 ({entry.grade}).
                </Typography.Paragraph>
              )),
            },
            {
              key: 'takes',
              label: 'Details — actual choreography takes',
              children: episode.takes.map((take) => (
                <div key={take.id}>
                  <Typography.Text strong>
                    Take {take.scheduledTake}
                    {take.isReset ? ' reset' : ''}
                  </Typography.Text>
                  {take.evaluations.map((entry) => (
                    <Typography.Paragraph key={entry.contestantId}>
                      {link(entry.contestantId)} — dice {entry.rawDice.join(' + ')};{' '}
                      {entry.finalScore.toFixed(2)}/100 ({entry.grade}).
                    </Typography.Paragraph>
                  ))}
                </div>
              )),
            },
            ...(episode.cut
              ? [
                  {
                    key: 'cut',
                    label: 'Details — actual music-video presence',
                    children: episode.participantIds.map((id) => (
                      <Typography.Paragraph key={id}>
                        {link(id)} — {episode.cut!.presence[id].toFixed(2)}% presence: 20% shared choreography
                        and {episode.cut!.individualFocus[id].toFixed(2)}% individual focus.
                      </Typography.Paragraph>
                    )),
                  },
                ]
              : []),
            {
              key: 'panel',
              label: 'Details — five equal contributions',
              children: episode.panel.map((entry) => (
                <Typography.Paragraph key={entry.contestantId}>
                  {link(entry.contestantId)} — performance {entry.performance.toFixed(2)}, John{' '}
                  {entry.john.toFixed(2)}, Megan {entry.megan.toFixed(2)}, Michael {entry.michael.toFixed(2)},
                  Vivienne {entry.director.toFixed(2)}; equal-weight result {entry.finalScore.toFixed(2)}/100
                  ({entry.grade}).
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
