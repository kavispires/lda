import { Alert, Button, Collapse, Image, Modal, Space, Typography } from 'antd';
import { useState } from 'react';
import type { MegaGroupsAction } from '../types/mega-groups-episode';
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

export function MegaGroupsEpisodeView({
  state,
  onAction,
  onInspect,
  actionError,
}: {
  state: SimulationState;
  onAction: (action: MegaGroupsAction, revision: number) => void;
  onInspect: (id: string) => void;
  actionError?: string | null;
}) {
  const [history, setHistory] = useState<{ runId: string; sceneId: string } | null>(null);
  const runtime = state.runtime;
  if (!runtime || runtime.version !== 3 || runtime.bootcamp?.phase !== 'complete') return null;
  const episode = runtime.megaGroups;
  const preparation = runtime.preparations?.[4];
  if (!episode && preparation && (!preparation.mood || preparation.requiredSelections > 0))
    return (
      <PreparationDialog
        actionError={actionError}
        key={`${runtime.runId}-4-${preparation.mood ? 'cast' : 'mood'}`}
        onAction={onAction}
        onInspect={onInspect}
        phase={preparation.mood ? 'opening-cast' : 'mood'}
        preparation={preparation}
        state={state}
      />
    );
  if (!episode)
    return (
      <NarrativeStage episode={4} title="Mega Groups">
        <AutoCompleteEpisodeButton episode={4} state={state} />
        <Typography.Paragraph>
          Eighteen survivors face a blind image test, new teams and two songs each.
        </Typography.Paragraph>
        {actionError && <Alert role="alert" title={actionError} type="error" />}
        <Button onClick={() => onAction({ type: 'start' }, preparation?.revision ?? 0)} type="primary">
          Start Episode 4 — Mega Groups
        </Button>
      </NarrativeStage>
    );
  const latest = episode.scenes.at(-1);
  const scene =
    episode.scenes.find((entry) => history?.runId === runtime.runId && history.sceneId === entry.id) ??
    latest;
  const lookingBack = scene?.id !== latest?.id;
  const visibleScenes = scene ? episode.scenes.slice(0, episode.scenes.indexOf(scene) + 1) : [];
  const illustrations =
    scene?.sequence === 4
      ? visibleScenes.find((entry) => entry.illustrations?.length)?.illustrations
      : undefined;
  const act = (action: MegaGroupsAction) => onAction(action, episode.revision);
  const decision = episode.phase === 'intervention' || episode.phase === 'secret-choice';
  const credits = scene?.presentation === 'credits' || scene?.sequence === 2;
  const name = (id: string) => state.contestants.find((person) => person.id === id)?.name ?? id;
  const person = (id: string) => (
    <Button data-contestant-id={id} onClick={() => onInspect(id)} type="link">
      {name(id)}
    </Button>
  );
  const ranking = (final: boolean) => (
    <ol
      aria-label={final ? 'Episode 4 final placements' : 'Episode 4 announced ranking'}
      style={{ listStyle: 'none', paddingLeft: 0 }}
    >
      {(final ? episode.finalRankedIds : episode.rankedIds).map((id, index) => {
        const movement = episode.previousRankedIds.indexOf(id) - index;
        return (
          <li key={id}>
            <Space>
              <Typography.Text strong>{index + 1}.</Typography.Text>
              {!final && movement !== 0 && (
                <Typography.Text
                  aria-label={`${movement > 0 ? 'Up' : 'Down'} ${Math.abs(movement)} places`}
                  type={movement > 0 ? 'success' : 'danger'}
                >
                  <ChangeDirection change={movement} /> {Math.abs(movement)}
                </Typography.Text>
              )}
              <ContestantAvatar enablePreview={false} id={id} name={name(id)} size={28} />
              {person(id)}
              {final && id === episode.withdrawnId && <Typography.Text>Withdrew</Typography.Text>}
              {final && id === episode.eliminatedId && <Typography.Text>Eliminated</Typography.Text>}
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
      <CopyEpisodeRundown episode={4} state={state} />
      {!decision && (
        <AutoCompleteEpisodeButton episode={4} onCompleted={() => setHistory(null)} state={state} />
      )}
      <NarrativeStage
        episode={4}
        eyebrow={scene?.sequence ? `SEQUENCE ${scene.sequence}${lookingBack ? ' / Archive' : ''}` : undefined}
        footer={
          lookingBack ? (
            <Button onClick={() => setHistory(null)}>Return to current scene</Button>
          ) : episode.phase === 'complete' ? (
            <Typography.Text>
              Episode complete. Episode 5 — The Photoshoot is unlocked as the next episode.
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
        title={scene?.title ?? 'Mega Groups'}
      >
        {!decision && actionError && <Alert role="alert" title={actionError} type="error" />}
        {illustrations && (
          <Space align="start" aria-label="Blind image choices" size="large" wrap>
            {illustrations.map((image) => (
              <Space align="center" key={image.src} orientation="vertical">
                <Image alt={image.label} height={128} preview={false} src={image.src} width={128} />
                <Typography.Text strong>{image.label}</Typography.Text>
              </Space>
            ))}
          </Space>
        )}
        {episode.rankRevealed && scene?.kind === 'ranking' && ranking(false)}
        {!lookingBack && episode.phase === 'complete' && ranking(true)}
        {!credits && narrativeScene && (
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
              ? 'Your decision: help the rehearsal'
              : 'Your decision: investigate a secret'
          }
        >
          <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            <AutoCompleteEpisodeButton episode={4} onCompleted={() => setHistory(null)} state={state} />
            {actionError && <Alert role="alert" title={actionError} type="error" />}
            {episode.phase === 'intervention' ? (
              <>
                <Typography.Paragraph>
                  <EpisodeNarrative
                    contestants={state.contestants}
                    onInspect={onInspect}
                    text={episode.conflict?.description ?? 'Choose how to help this team rehearse.'}
                  />
                </Typography.Paragraph>
                <Space wrap>
                  <Button onClick={() => act({ type: 'conflict', choice: 'support' })}>Support</Button>
                  <Button onClick={() => act({ type: 'conflict', choice: 'mediate' })}>Mediate</Button>
                  <Button onClick={() => act({ type: 'conflict', choice: 'push' })}>Push</Button>
                </Space>
              </>
            ) : (
              episode.secretCandidates.map((id) => (
                <Space key={id}>
                  {person(id)}
                  <Button onClick={() => act({ type: 'secret', contestantId: id })} type="primary">
                    Investigate {name(id)}
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
      {scene?.contestantChanges && (
        <Collapse
          items={[
            {
              key: 'scene-relationships',
              label: 'Details — relationship changes in this scene',
              children: Object.entries(scene.contestantChanges).flatMap(([id, changes]) =>
                changes
                  .filter((change) => change.path.startsWith('relationships.'))
                  .map((change, index) => (
                    <div key={`${id}-relationship-${index}`}>
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
              key: 'ballots',
              label: 'Details — recorded team ballots (viewer knowledge)',
              children: (
                <Space orientation="vertical" style={{ width: '100%' }}>
                  {episode.transfer && (
                    <div>
                      <Typography.Title level={5}>Secret transfer nominations</Typography.Title>
                      {Object.entries(episode.transfer.ballots).map(([voter, choices]) => (
                        <div key={voter}>
                          {person(voter)} nominates{' '}
                          {choices.map((id) => (
                            <span key={id}>{person(id)} </span>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                  {episode.teams.map((team) => (
                    <div key={team.id}>
                      <Typography.Title level={5}>{team.name}</Typography.Title>
                      {(['leader', 'center'] as const).map((role) => (
                        <div key={role}>
                          <Typography.Text strong>
                            {role === 'leader' ? 'Leader' : 'Center'} ballots
                          </Typography.Text>
                          {Object.entries(role === 'leader' ? team.leaderBallots : team.centerBallots).map(
                            ([voter, choice]) => (
                              <div key={voter}>
                                {person(voter)} votes for {person(choice)}
                              </div>
                            ),
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </Space>
              ),
            },
            {
              key: 'evidence',
              label: 'Details — recorded Mega Groups performances',
              children: episode.performances.map((performance) => (
                <div key={`${performance.teamId}-${performance.songId}`}>
                  <Typography.Title level={5}>
                    {
                      runtime.definitions.megaGroupSongs?.find((song) => song.id === performance.songId)
                        ?.title
                    }
                  </Typography.Title>
                  {performance.evaluations.map((evaluation) => (
                    <div key={evaluation.contestantId}>
                      {person(evaluation.contestantId)} — {evaluation.grade};{' '}
                      {evaluation.finalScore.toFixed(2)}/100. Dice: {evaluation.rawDice.join(' + ')}.
                    </div>
                  ))}
                </div>
              )),
            },
          ]}
        />
      )}
      <Collapse
        items={[
          {
            key: 'history',
            label: 'Read-only scene history',
            children: episode.scenes.map((entry) => (
              <div key={entry.id}>
                <Button onClick={() => setHistory({ runId: runtime.runId, sceneId: entry.id })} type="link">
                  {entry.sequence ? `${entry.sequence}. ` : ''}
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
