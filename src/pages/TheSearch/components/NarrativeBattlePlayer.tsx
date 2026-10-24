import { Alert, Button, Collapse, Modal, Space, Typography } from 'antd';
import { useState } from 'react';
import type { EpisodeScene } from '../types/audition-episode';
import type { BattleAction, BattleTeam } from '../types/battle-episode';
import type { SimulationState } from '../types/simulation';
import { EpisodeContestantList, EpisodeNarrative, EpisodeSceneNarrative } from './EpisodeNarrative';
import styles from './NarrativeEpisodeView.module.scss';
import { NarrativeStage, OpeningCredits } from './NarrativeStage';
import { PersonnelAvatar } from './personnel/PersonnelAvatar';

interface NarrativeBattlePlayerProps {
  state: SimulationState;
  onAction: (action: BattleAction, expectedRevision: number) => void;
  onInspect: (id: string) => void;
  actionError?: string | null;
}

export function BattleNarrativeContinue({
  onAction,
  revision,
  label = 'Continue',
}: {
  onAction: NarrativeBattlePlayerProps['onAction'];
  revision: number;
  label?: string;
}) {
  return (
    <Button onClick={() => onAction({ type: 'advance' }, revision)} size="large" type="primary">
      {label}
    </Button>
  );
}

function includesTeam(scene: EpisodeScene, team: BattleTeam): boolean {
  return scene.contestantIds.some((id) => team.memberIds.includes(id));
}

export function NarrativeBattlePlayer({
  state,
  onAction,
  onInspect,
  actionError,
}: NarrativeBattlePlayerProps) {
  const [history, setHistory] = useState<{ runId: string; sceneId: string } | null>(null);
  const runtime = state.runtime;
  if (!runtime) return null;
  const episode = runtime.battle;
  if (!episode) {
    return runtime.audition?.phase === 'complete' ? (
      <NarrativeStage episode={2} title="The Battles">
        <Typography.Paragraph>
          Thirty contestants move into production-assigned dorms. Six captains will draft teams, rehearse, and
          face three head-to-head battles.
        </Typography.Paragraph>
        {actionError && <Alert role="alert" title={actionError} type="error" />}
        <Button onClick={() => onAction({ type: 'start' }, 0)} size="large" type="primary">
          Start Episode 2 — The Battles
        </Button>
      </NarrativeStage>
    ) : null;
  }
  const story = episode.story;
  if (!story) return null;
  const latest = episode.scenes.at(-1);
  const scene =
    episode.scenes.find((entry) => history?.runId === runtime.runId && entry.id === history.sceneId) ??
    latest;
  const lookingBack = scene?.id !== latest?.id;
  const visibleScenes = scene ? episode.scenes.slice(0, episode.scenes.indexOf(scene) + 1) : [];
  const name = (id: string) => state.contestants.find((person) => person.id === id)?.name ?? id;
  const inspect = (id: string) => (
    <Button data-contestant-id={id} onClick={() => onInspect(id)} type="link">
      {name(id)}
    </Button>
  );
  const act = (action: BattleAction) => onAction(action, episode.revision);
  const intervention = story.stage === 'intervention';
  const productionSave = story.stage === 'production-save';
  const secretChoice = story.stage === 'secret-choice';
  const decision = intervention || productionSave || secretChoice;
  const credits = scene?.sequence === 2 || (!lookingBack && story.stage === 'credits');
  const continueLabels: Partial<Record<typeof story.stage, string>> = {
    dorms:
      episode.roomCursor < episode.rooms.length ? 'Continue to the next dorm' : 'Play the opening credits',
    credits: 'Continue to the challenge',
    challenge: 'Meet the six captains',
    captains: 'Begin the team draft',
    draft: story.draftPick < 24 ? 'Continue the team draft' : 'Meet the opponents',
    pairings: story.pairingCursor < 3 ? 'See the next pairing' : 'Enter the rehearsal room',
    rehearsal: 'See the captain’s spotlight',
    leadership: 'Watch the center ballot',
    center: 'Choose a rehearsal intervention',
    'intervention-result': 'Watch the team perform',
    performance: 'Continue backstage',
    'opponent-reaction': 'Watch the rehearsal flashback',
    reviews: 'Continue the panel’s review',
    'save-result': 'Continue to the farewells',
    mvp: 'Investigate a secret',
    'secret-result': 'Hear Mike’s final announcement',
    'ranking-rule': 'Reveal the first full ranking',
    ranking: 'See the placement reactions',
    'rank-reactions': 'Close Episode 2',
  };
  const prepared = (team: BattleTeam) =>
    visibleScenes.some((entry) => entry.kind === 'practice' && includesTeam(entry, team));
  const performed = (team: BattleTeam) => !lookingBack && story.creditedTeamIds.includes(team.id);
  const detailsTeams = episode.teams.filter(
    (team) => scene && includesTeam(scene, team) && (prepared(team) || performed(team)),
  );
  const resultShown = (team: BattleTeam) =>
    !lookingBack &&
    episode.pairings.slice(0, episode.revealedResults).some((pairing) => pairing.teamIds.includes(team.id));
  const narrative = (text: string) => (
    <EpisodeNarrative contestants={state.contestants} onInspect={onInspect} text={text} />
  );

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      {actionError && <Alert role="alert" title={actionError} type="error" />}
      <NarrativeStage
        episode={2}
        eyebrow={`Sequence ${scene?.sequence ?? story.sequence}${lookingBack ? ' / Archive' : ''}`}
        footer={
          lookingBack ? (
            <>
              <Typography.Text type="secondary">Read-only archive</Typography.Text>
              <Button onClick={() => setHistory(null)} type="primary">
                Return to current scene
              </Button>
            </>
          ) : story.stage === 'complete' ? (
            <Typography.Text>Episode 2 complete. The next episode has not started.</Typography.Text>
          ) : decision ? (
            <Typography.Text type="secondary">
              The episode is paused until your decision is saved.
            </Typography.Text>
          ) : (
            <BattleNarrativeContinue
              label={continueLabels[story.stage] ?? 'Continue'}
              onAction={onAction}
              revision={episode.revision}
            />
          )
        }
        speaker={scene?.speaker?.name}
        speakerRole={scene?.speaker?.role}
        title={scene?.title ?? 'The Battles'}
      >
        {credits ? (
          <OpeningCredits ids={runtime.openingCast ?? []} onInspect={onInspect} state={state} />
        ) : scene ? (
          <>
            <EpisodeSceneNarrative
              contestants={state.contestants}
              emphasizeMain
              onInspect={onInspect}
              reactions={[]}
              scene={scene}
            />
            {scene.dialogues?.map((dialogue, index) => (
              <div className={styles.dialogue} key={`${scene.id}-dialogue-${index}`}>
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
          </>
        ) : null}
      </NarrativeStage>

      {detailsTeams.length > 0 && (
        <Collapse
          items={[
            {
              key: `${scene?.id}-details`,
              label: 'Details — revealed rehearsal and performance evidence',
              children: detailsTeams.map((team) => {
                const performance = performed(team)
                  ? episode.performances.find((entry) => entry.teamId === team.id)
                  : undefined;
                const centerVisible = !!performance || (!lookingBack && story.stage === 'center');
                const song = runtime.definitions.battleSongs?.find((entry) => entry.id === team.songId);
                return (
                  <section aria-label={`${team.name} evidence`} key={team.id}>
                    <Typography.Title level={5}>{team.name}</Typography.Title>
                    {prepared(team) && (
                      <>
                        <Typography.Paragraph>
                          Song: {song?.title ?? team.songId}. Captain: {inspect(team.captainId)}.
                        </Typography.Paragraph>
                        {team.memberIds.map((id) => (
                          <Typography.Paragraph key={id}>
                            {inspect(id)} —{' '}
                            {song?.parts.find((part) => part.id === team.partAssignments[id])?.name ??
                              team.partAssignments[id] ??
                              'Part not recorded'}
                            ; {team.partReactions[id]}.
                          </Typography.Paragraph>
                        ))}
                        {team.practice.map((session) => (
                          <div key={session.session}>
                            <Typography.Paragraph>
                              Practice {session.session}: leadership{' '}
                              {session.leadershipSuccess ? 'succeeded' : 'failed'}; dice{' '}
                              {session.leaderDice.join(' + ')}; coordination {session.coordinationBefore} →{' '}
                              {session.coordinationAfter}.
                            </Typography.Paragraph>
                            {session.contestants.map((person) => (
                              <Typography.Paragraph key={person.contestantId}>
                                {inspect(person.contestantId)} — practice {person.practiceBefore} →{' '}
                                {person.practiceAfter}; dice {person.rawDice.join(' + ')}.
                              </Typography.Paragraph>
                            ))}
                          </div>
                        ))}
                      </>
                    )}
                    {centerVisible && team.centerId && (
                      <>
                        <Typography.Paragraph>
                          Center: {inspect(team.centerId)}. Temporary stage-presence bonus: +1.
                        </Typography.Paragraph>
                        {Object.entries(team.centerBallots).map(([voter, target]) => (
                          <Typography.Paragraph key={voter}>
                            {inspect(voter)} voted for {inspect(target)}.
                          </Typography.Paragraph>
                        ))}
                      </>
                    )}
                    {performance && (
                      <>
                        {resultShown(team) && (
                          <Typography.Paragraph>
                            Team score: {performance.finalScore.toFixed(1)}
                            {performance.baseScore !== undefined &&
                              `; base score: ${performance.baseScore.toFixed(1)}`}
                            ; coordination: {performance.coordination}.
                          </Typography.Paragraph>
                        )}
                        {performance.evaluations.map((evaluation) => (
                          <Typography.Paragraph key={evaluation.contestantId}>
                            {inspect(evaluation.contestantId)} — Grade {evaluation.grade}; final{' '}
                            {evaluation.finalScore.toFixed(1)}. Technical{' '}
                            {evaluation.technicalScore.toFixed(1)}, stage {evaluation.stageScore.toFixed(1)},
                            impression {evaluation.impressionScore.toFixed(1)}. Raw dice:{' '}
                            {evaluation.rawDice.join(' + ')}.
                          </Typography.Paragraph>
                        ))}
                        {resultShown(team) &&
                          performance.judging &&
                          Object.entries(performance.judging).map(([judge, evidence]) => (
                            <Typography.Paragraph key={judge}>
                              {judge}: {evidence.comment} Score {evidence.score.toFixed(1)}; bonus{' '}
                              {evidence.bonus.toFixed(2)}.
                            </Typography.Paragraph>
                          ))}
                      </>
                    )}
                  </section>
                );
              }),
            },
          ]}
        />
      )}

      {episode.scenes.length > 1 && (
        <Collapse
          items={[
            {
              key: 'archive',
              label: 'Previously shown scenes — read-only archive',
              children: (
                <Space orientation="vertical">
                  {episode.scenes.map((entry) => (
                    <Button
                      aria-current={scene?.id === entry.id ? 'step' : undefined}
                      key={entry.id}
                      onClick={() => setHistory({ runId: runtime.runId, sceneId: entry.id })}
                      type="link"
                    >
                      {entry.sequence ? `Sequence ${entry.sequence} — ` : ''}
                      {entry.title}
                    </Button>
                  ))}
                </Space>
              ),
            },
          ]}
        />
      )}

      {decision && (
        <Modal
          centered
          closable={false}
          footer={null}
          keyboard={false}
          mask={{ closable: false }}
          open
          title={
            intervention
              ? 'Your decision: help the rehearsal'
              : productionSave
                ? 'Your decision: production’s save'
                : 'Your decision: investigate a secret'
          }
        >
          <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            {actionError && <Alert role="alert" title={actionError} type="error" />}
            {intervention ? (
              <>
                <Typography.Paragraph>
                  {narrative(episode.conflict?.description ?? 'Choose how to help this team rehearse.')}
                </Typography.Paragraph>
                <EpisodeContestantList
                  contestants={state.contestants}
                  ids={episode.conflict?.contestantIds ?? []}
                  onInspect={onInspect}
                />
                <Space wrap>
                  <Button onClick={() => act({ type: 'conflict', choice: 'support' })}>
                    Support (+2 coordination, +1 relationships)
                  </Button>
                  <Button onClick={() => act({ type: 'conflict', choice: 'mediate' })}>
                    Mediate (+1 coordination, +2 relationships)
                  </Button>
                  <Button onClick={() => act({ type: 'conflict', choice: 'push' })}>
                    Push (+3 coordination, −3 relationships)
                  </Button>
                </Space>
              </>
            ) : (
              (productionSave ? episode.productionShortlist : episode.secretCandidates).map((id) => (
                <Space key={id}>
                  {inspect(id)}
                  <Button
                    onClick={() =>
                      act({ type: productionSave ? 'production-save' : 'secret', contestantId: id })
                    }
                    type="primary"
                  >
                    {productionSave ? 'Save' : 'Investigate'} {name(id)}
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
    </Space>
  );
}
