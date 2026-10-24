import { Alert, Button, Card, Collapse, Modal, Progress, Space, Table, Tag, Typography } from 'antd';
import { useState } from 'react';
import type { BattleAction, BattleEvaluation, BattlePhase, BattleTeam } from '../types/battle-episode';
import type { SimulationState } from '../types/simulation';
import { ContestantAvatar } from './ContestantAvatar';
import { CopyEpisodeRundown } from './CopyEpisodeRundown';
import { EpisodeContestantList, EpisodeNarrative, EpisodeSceneNarrative } from './EpisodeNarrative';
import { NarrativeStage, OpeningCredits } from './NarrativeStage';
import { ValueChange } from './SimulationChange';

interface BattleEpisodeViewProps {
  state: SimulationState;
  onAction: (action: BattleAction, revision: number) => void;
  onInspect: (id: string) => void;
  actionError?: string | null;
}

const phaseNames: Record<BattlePhase, string> = {
  dorms: 'Moving into the dorms',
  ranking: 'The first combined ranking',
  draft: 'Captain-led team draft',
  pairings: 'Battle matchups',
  preparation: 'Team preparation',
  conflict: 'A rehearsal decision',
  performance: 'On the battle stage',
  broadcast: 'Choose the broadcast',
  audience: 'Audience voting',
  saves: 'Three second chances',
  results: 'Battle results',
  mvp: 'Contestants’ MVP',
  secret: 'A secret before the credits',
  complete: 'Episode complete',
};

export function BattleEpisodeView({ state, onAction, onInspect, actionError }: BattleEpisodeViewProps) {
  const [history, setHistory] = useState<{ runId: string; sceneId: string } | null>(null);
  const runtime = state.runtime;
  if (!runtime) return null;
  const episode = runtime.battle;
  if (!episode) {
    return runtime.audition?.phase === 'complete' ? (
      <Card title="Episode 2 — Team Battles">
        <Typography.Paragraph>
          Thirty contestants move into five production-assigned dorms. Six captains draft their teams,
          rehearse, and face three battles. Three distinct saves give losing-team contestants a second chance.
        </Typography.Paragraph>
        {actionError && <Alert title={actionError} type="error" />}
        <Button onClick={() => onAction({ type: 'start' }, 0)} size="large" type="primary">
          Start Episode 2 — Team Battles
        </Button>
      </Card>
    ) : null;
  }

  const name = (id: string) => state.contestants.find((person) => person.id === id)?.name ?? id;
  const inspect = (id: string, portrait = false) => (
    <Button key={id} onClick={() => onInspect(id)} size="small" type="link">
      {portrait && <ContestantAvatar enablePreview={false} id={id} name={name(id)} size={28} />}
      {name(id)}
    </Button>
  );
  const people = (ids: string[]) => (
    <EpisodeContestantList contestants={state.contestants} ids={ids} onInspect={onInspect} />
  );
  const narrative = (text: string) => (
    <EpisodeNarrative contestants={state.contestants} onInspect={onInspect} text={text} />
  );
  const act = (action: BattleAction) => onAction(action, episode.revision);
  const latest = episode.scenes.at(-1);
  const selected =
    episode.scenes.find((scene) => history?.runId === runtime.runId && scene.id === history.sceneId) ??
    latest;
  const lookingBack = selected?.id !== latest?.id;
  const hasScene = (kind: string) => episode.scenes.some((scene) => scene.kind === kind);
  const prepared = (team: BattleTeam) =>
    episode.scenes.some(
      (scene) => scene.kind === 'practice' && scene.contestantIds.some((id) => team.memberIds.includes(id)),
    );
  const performed = (team: BattleTeam) =>
    episode.scenes.some(
      (scene) => scene.kind === 'battles' && scene.contestantIds.some((id) => team.memberIds.includes(id)),
    );
  const audienceRevealed = hasScene('audience');
  const teamsRevealed = hasScene('draft');
  const resultsRevealed = hasScene('eliminations');
  const announcedIds = new Set(
    episode.scenes
      .filter((scene) => ['saves', 'eliminations'].includes(scene.kind))
      .flatMap((scene) => scene.contestantIds),
  );
  const visiblePerformances = episode.performances.filter((performance) => {
    const team = episode.teams.find((item) => item.id === performance.teamId);
    return team && performed(team);
  });
  const announcedWinners = ['saves', 'results', 'mvp', 'secret', 'complete'].includes(episode.phase)
    ? episode.pairings.slice(0, episode.revealedResults).flatMap((pairing) => {
        const winner = episode.teams.find((team) => team.id === pairing.winnerId);
        return winner ? [winner] : [];
      })
    : [];
  const decisionTitle =
    episode.phase === 'conflict'
      ? 'Your decision: help the rehearsal'
      : episode.phase === 'broadcast'
        ? 'Your decision: choose the broadcast'
        : episode.phase === 'saves'
          ? 'Your decision: production’s save'
          : episode.phase === 'secret'
            ? 'Your decision: investigate a secret'
            : null;

  const evaluationDetails = (evaluation: BattleEvaluation) => (
    <Space orientation="vertical" style={{ width: '100%' }}>
      {inspect(evaluation.contestantId)}
      <Typography.Paragraph>
        {narrative(
          `Raw dice: ${evaluation.rawDice.join(' + ')}. Technical ${evaluation.technicalScore.toFixed(1)} · stage ${evaluation.stageScore.toFixed(1)} · impression ${evaluation.impressionScore.toFixed(1)} · temporary stage composure ${evaluation.composure}. Final ${evaluation.finalScore.toFixed(1)} — graded ${evaluation.grade}.`,
        )}
      </Typography.Paragraph>
      <Table
        columns={[
          { title: 'Category', dataIndex: 'category' },
          { title: 'Check', dataIndex: 'skill' },
          { title: 'Skill level', dataIndex: 'skillLevel' },
          { title: 'Requirement', dataIndex: 'requiredLevel' },
          { title: 'Floor', dataIndex: 'floor' },
          { title: 'Adjusted dice', render: (_, row) => row.adjustedDice.join(' + ') },
          { title: 'Score', render: (_, row) => row.score.toFixed(1) },
          { title: 'Weight', dataIndex: 'weight' },
        ]}
        dataSource={[
          ...evaluation.technicalChecks.map((check) => ({ ...check, category: 'Technical' })),
          ...(evaluation.stageCheck ? [{ ...evaluation.stageCheck, category: 'Stage' }] : []),
          ...(evaluation.impressionChecks ?? []).map((check) => ({ ...check, category: 'Impression' })),
        ]}
        pagination={false}
        rowKey={(check) => `${check.category}-${check.skill}`}
        scroll={{ x: 650 }}
        size="small"
      />
    </Space>
  );

  const teamDetails = (team: BattleTeam) => {
    const revealed = prepared(team);
    const song = revealed
      ? runtime.definitions.battleSongs?.find((item) => item.id === team.songId)
      : undefined;
    const performance = performed(team)
      ? episode.performances.find((item) => item.teamId === team.id)
      : undefined;
    return (
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <div>Captain / leader: {inspect(team.captainId)}</div>
        {people(team.memberIds)}
        {revealed && (
          <>
            <Typography.Paragraph>
              Song: {song?.title ?? team.songId ?? 'Not yet assigned'}
              {song && ` — ${song.description} (difficulty ${song.difficulty})`}
            </Typography.Paragraph>
            {team.centerId && <div>Team-voted center: {inspect(team.centerId)}</div>}
            <Typography.Text type="secondary">
              Center ballots consider visual, stage presence, charisma and relationships. No self-votes.
              Practice is temporary preparation, not permanent skill growth.
            </Typography.Text>
            <Typography.Text>Current team coordination: {team.coordination}.</Typography.Text>
            <Table
              columns={[
                { title: 'Member', render: (_, row) => inspect(row.id) },
                { title: 'Assigned part', dataIndex: 'part' },
                { title: 'Part reaction', dataIndex: 'reaction' },
                { title: 'Center vote', render: (_, row) => (row.vote ? inspect(row.vote) : '—') },
              ]}
              dataSource={team.memberIds.map((id) => {
                const partId = team.partAssignments[id];
                return {
                  id,
                  part: song?.parts.find((part) => part.id === partId)?.name ?? partId ?? '—',
                  reaction: team.partReactions?.[id] ?? '—',
                  vote: team.centerBallots[id],
                };
              })}
              pagination={false}
              rowKey="id"
              size="small"
            />
            <Collapse
              items={team.practice.map((session) => ({
                key: String(session.session),
                label: `Practice ${session.session} — ${session.title}`,
                children: (
                  <Space orientation="vertical" style={{ width: '100%' }}>
                    <Typography.Paragraph>
                      Leadership check — {inspect(team.captainId)}: raw dice {session.leaderDice.join(' + ')};{' '}
                      {session.leadershipSuccess ? 'successful' : 'unsuccessful'}. Coordination after this
                      session:{' '}
                      {typeof session.coordinationBefore === 'number' &&
                      typeof session.coordinationAfter === 'number' ? (
                        <ValueChange after={session.coordinationAfter} before={session.coordinationBefore} />
                      ) : (
                        'Not recorded in this save'
                      )}
                    </Typography.Paragraph>
                    {session.leadershipCheck && (
                      <Typography.Paragraph type="secondary">
                        Leadership level {session.leadershipCheck.skillLevel}; requirement{' '}
                        {session.leadershipCheck.requiredLevel}; floor {session.leadershipCheck.floor}.
                        Adjusted dice: {session.leadershipCheck.adjustedDice.join(' + ')}; score{' '}
                        {session.leadershipCheck.score.toFixed(1)}; weight {session.leadershipCheck.weight}.
                        Adjusted dice total:{' '}
                        {session.leadershipCheck.adjustedDice.reduce((sum, face) => sum + face, 0)}. Success
                        requires an adjusted dice total of at least {session.leadershipCheck.successThreshold}
                        .
                      </Typography.Paragraph>
                    )}
                    {session.contestants.map((member) => (
                      <div key={member.contestantId}>
                        {inspect(member.contestantId)} — Practice{' '}
                        <ValueChange after={member.practiceAfter} before={member.practiceBefore} />
                        <Typography.Paragraph type="secondary">
                          Raw dice: {member.rawDice.join(' + ')}.
                          {member.checks.map((check) => (
                            <span key={check.skill}>
                              {' '}
                              {check.skill}:{' '}
                              {check.skillLevel !== undefined && <>level {check.skillLevel}; </>}
                              requirement {check.requiredLevel}
                              {';'}
                              {check.floor !== undefined && <> floor {check.floor};</>} adjusted dice{' '}
                              {check.adjustedDice.join(' + ')}
                              {check.weight !== undefined && <>; weight {check.weight}</>}.
                            </span>
                          ))}
                        </Typography.Paragraph>
                        {typeof member.weightedSum === 'number' && (
                          <Typography.Paragraph type="secondary">
                            Weighted utility average: {member.weightedSum.toFixed(2)} (dice totals × weight,
                            divided by total weights). This session’s Practice: {member.sessionPractice} (half
                            that average, rounded down and capped at five). Recorded preparation{' '}
                            {member.improved ? 'improved' : 'did not improve'}.
                          </Typography.Paragraph>
                        )}
                      </div>
                    ))}
                  </Space>
                ),
              }))}
            />
          </>
        )}
        {performance && (
          <>
            <Typography.Paragraph strong>
              Team performance: {performance.finalScore.toFixed(1)}. Member average{' '}
              {performance.meanScore.toFixed(1)}; coordination {performance.coordination}.
            </Typography.Paragraph>
            <Collapse
              items={performance.evaluations.map((evaluation) => ({
                key: evaluation.contestantId,
                label: `${name(evaluation.contestantId)} — scores, technical, stage and impression checks`,
                children: evaluationDetails(evaluation),
              }))}
            />
          </>
        )}
      </Space>
    );
  };

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <CopyEpisodeRundown episode={2} state={state} />
      <Modal
        centered
        closable={false}
        destroyOnHidden
        footer={null}
        keyboard={false}
        mask={{ closable: false }}
        open={decisionTitle !== null}
        styles={{ body: { maxHeight: '75vh', overflowY: 'auto' } }}
        title={decisionTitle}
        width={1000}
      >
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            description="Inspecting contestants does not close this dialog. The episode resumes only after your choice is saved."
            title="Episode paused — your decision is required."
            type="warning"
          />
          {actionError && (
            <Alert description={actionError} title="Decision could not be saved" type="error" />
          )}
          {episode.phase === 'conflict' && episode.conflict && (
            <>
              <EpisodeSceneNarrative
                contestants={state.contestants}
                onInspect={onInspect}
                reactions={[]}
                scene={{
                  id: 'practice-conflict',
                  kind: 'practice',
                  title: 'Practice conflict',
                  paragraphs: [episode.conflict.description],
                  contestantIds: episode.conflict.contestantIds,
                }}
              />
              <Space wrap>
                {(['support', 'mediate', 'push'] as const).map((choice) => (
                  <Card
                    key={choice}
                    size="small"
                    title={choice === 'support' ? 'Support' : choice === 'mediate' ? 'Mediate' : 'Push'}
                  >
                    <Typography.Paragraph>
                      {choice === 'support'
                        ? 'Support the affected contestants: build coordination while gently strengthening their relationship.'
                        : choice === 'mediate'
                          ? 'Prioritize repairing the pair’s relationship, with a smaller coordination benefit.'
                          : 'Push for the strongest coordination benefit, at the cost of the pair’s relationship.'}
                    </Typography.Paragraph>
                    <Button onClick={() => act({ type: 'conflict', choice })} type="primary">
                      {choice === 'support'
                        ? 'Support the contestants'
                        : choice === 'mediate'
                          ? 'Mediate the conflict'
                          : 'Push the rehearsal'}
                    </Button>
                  </Card>
                ))}
              </Space>
              <Typography.Text type="secondary">
                These choices affect team preparation and the involved contestants’ relationship, not
                permanent skills.
              </Typography.Text>
            </>
          )}
          {episode.phase === 'broadcast' && (
            <>
              <Typography.Paragraph>
                Everyone receives baseline coverage. Choose which actual footage receives extra emphasis;
                editing cannot change the recorded performances.
              </Typography.Paragraph>
              {episode.cuts.map((cut) => (
                <Card key={cut.id} style={{ width: '100%' }} title={cut.title}>
                  <EpisodeSceneNarrative
                    contestants={state.contestants}
                    onInspect={onInspect}
                    reactions={[]}
                    scene={{
                      id: `broadcast-${cut.id}`,
                      kind: 'broadcast',
                      title: cut.title,
                      paragraphs: [cut.description, ...cut.footage.map((footage) => footage.description)],
                      contestantIds: cut.featuredIds,
                    }}
                  />
                  <Collapse
                    items={[
                      {
                        key: 'coverage',
                        label: 'Coverage including baseline',
                        children: Object.entries(cut.exposure).map(([id, fraction]) => (
                          <div key={id}>
                            {inspect(id)}: {(fraction * 100).toFixed(1)}%
                          </div>
                        )),
                      },
                    ]}
                  />
                  <Button onClick={() => act({ type: 'broadcast', cutId: cut.id })} type="primary">
                    Air {cut.title}
                  </Button>
                </Card>
              ))}
            </>
          )}
          {episode.phase === 'saves' && (
            <>
              <Typography.Title level={4}>Announced winning teams</Typography.Title>
              <Space wrap>
                {announcedWinners.map((team) => (
                  <Tag key={team.id}>{team.name}</Tag>
                ))}
              </Space>
              <Typography.Title level={4}>The judges’ save</Typography.Title>
              {episode.judgeSaveId && announcedIds.has(episode.judgeSaveId) && people([episode.judgeSaveId])}
              <Typography.Title level={4}>The audience’s save</Typography.Title>
              {episode.audienceSaveId &&
                announcedIds.has(episode.audienceSaveId) &&
                people([episode.audienceSaveId])}
              <Typography.Paragraph>
                Choose the third, distinct save from production’s shortlist. Only these contestants are
                eligible.
              </Typography.Paragraph>
              <Space wrap>
                {episode.productionShortlist.map((id) => (
                  <Card key={id} size="small">
                    {inspect(id)}
                    <Button onClick={() => act({ type: 'production-save', contestantId: id })} type="primary">
                      Save {name(id)}
                    </Button>
                  </Card>
                ))}
              </Space>
            </>
          )}
          {episode.phase === 'secret' && (
            <>
              <Typography.Paragraph>
                Investigate one eligible contestant before the credits. A contestant may have no secret.
              </Typography.Paragraph>
              <Space wrap>
                {episode.secretCandidates.map((id) => (
                  <Card key={id} size="small">
                    {inspect(id)}
                    <Button onClick={() => act({ type: 'secret', contestantId: id })} type="primary">
                      Check {name(id)}
                    </Button>
                  </Card>
                ))}
              </Space>
            </>
          )}
        </Space>
      </Modal>
      {runtime.version === 2 ? (
        <>
          <NarrativeStage
            episode={2}
            eyebrow={lookingBack ? 'ARCHIVE' : undefined}
            footer={
              lookingBack ? (
                <Button onClick={() => setHistory(null)}>Return to current scene</Button>
              ) : decisionTitle ? (
                <Typography.Text>Your production decision is required to continue.</Typography.Text>
              ) : episode.phase === 'complete' ? (
                <Typography.Text>Episode complete. Eighteen contestants remain.</Typography.Text>
              ) : (
                <Button onClick={() => act({ type: 'advance' })} size="large" type="primary">
                  Continue — {phaseNames[episode.phase]}
                </Button>
              )
            }
            speaker={
              selected && ['ranking', 'saves', 'eliminations'].includes(selected.kind)
                ? 'Mike Philip'
                : undefined
            }
            speakerRole="Host"
            title={selected?.title ?? phaseNames[episode.phase]}
          >
            {selected?.title === 'Opening credits' ? (
              <OpeningCredits ids={selected.contestantIds} onInspect={onInspect} state={state} />
            ) : (
              selected && (
                <EpisodeSceneNarrative
                  contestants={state.contestants}
                  emphasizeMain
                  onInspect={onInspect}
                  reactions={[]}
                  scene={selected}
                />
              )
            )}
            {actionError && !decisionTitle && <Alert title={actionError} type="error" />}
          </NarrativeStage>
          <Collapse
            items={[
              {
                key: 'archive',
                label: 'Archive — saved scenes',
                children: (
                  <Space wrap>
                    {episode.scenes.map((scene) => (
                      <Button
                        key={scene.id}
                        onClick={() =>
                          setHistory(
                            scene.id === latest?.id ? null : { runId: runtime.runId, sceneId: scene.id },
                          )
                        }
                      >
                        {scene.title}
                      </Button>
                    ))}
                  </Space>
                ),
              },
            ]}
          />
        </>
      ) : (
        <Card
          extra={
            <Space wrap>
              {episode.phase !== 'complete' && <Tag>Episode 2 active</Tag>}
              <Tag color={decisionTitle ? 'gold' : 'blue'}>{phaseNames[episode.phase]}</Tag>
            </Space>
          }
          title="Episode 2 — Team Battles"
        >
          <Typography.Paragraph type="secondary">
            Run {runtime.runId} · Saved revision {episode.revision}. Continue reveals the next scene.
            Inspection and history never advance the episode.
          </Typography.Paragraph>
          <Progress
            format={() => `${visiblePerformances.length} / 6 team performances`}
            percent={(visiblePerformances.length / 6) * 100}
          />
          {episode.phase === 'dorms' && (
            <Typography.Paragraph>
              All 30 contestants are randomly assigned to five rooms of six. Placements are already fixed;
              room highlights shown: {episode.roomCursor} / 5.
            </Typography.Paragraph>
          )}
          {episode.phase === 'draft' && (
            <>
              <Typography.Paragraph>
                Draft round {episode.draftRound} / 4 — captains pick in order 1–6.
              </Typography.Paragraph>
              <Typography.Paragraph type="secondary">
                The top six from Episode 1’s overall ranking captain the teams. Picks prioritize
                relationships; charisma, average core skills, then a seeded draw break ties.
              </Typography.Paragraph>
            </>
          )}
          {episode.phase === 'results' && (
            <Typography.Paragraph>
              {episode.scenes.filter((scene) => scene.kind === 'eliminations').length} / 3 departure
              announcements revealed. Winning teams were announced before the saves.
            </Typography.Paragraph>
          )}
          {episode.scenes.length > 1 && (
            <Collapse
              items={[
                {
                  key: 'history',
                  label: 'Scene history',
                  children: (
                    <Space wrap>
                      {episode.scenes.map((scene) => (
                        <Button
                          aria-pressed={selected?.id === scene.id}
                          key={scene.id}
                          onClick={() =>
                            setHistory(
                              scene.id === latest?.id ? null : { runId: runtime.runId, sceneId: scene.id },
                            )
                          }
                        >
                          {scene.title}
                        </Button>
                      ))}
                    </Space>
                  ),
                },
              ]}
            />
          )}
          {lookingBack && (
            <Alert
              action={<Button onClick={() => setHistory(null)}>Return to current scene</Button>}
              title="Looking back — the current phase is unchanged"
              type="info"
            />
          )}
          {selected && (
            <section aria-label={selected.title}>
              <Typography.Title level={3}>{selected.title}</Typography.Title>
              {selected.kind === 'draft' &&
                selected.title.startsWith('Draft round ') &&
                !selected.paragraphContestantIds && (
                  <Typography.Paragraph type="secondary">
                    This earlier draft entry did not record its deciding tie-breaker. New picks include the
                    specific selection reason.
                  </Typography.Paragraph>
                )}
              <EpisodeSceneNarrative
                contestants={state.contestants}
                emphasizeMain
                onInspect={onInspect}
                reactions={[]}
                scene={selected}
              />
            </section>
          )}
          {decisionTitle ? (
            <Alert title="Episode paused — your decision is required." type="warning" />
          ) : episode.phase !== 'complete' && !lookingBack ? (
            <Button onClick={() => act({ type: 'advance' })} size="large" type="primary">
              Continue — {phaseNames[episode.phase]}
            </Button>
          ) : null}
          {actionError && !decisionTitle && <Alert title={actionError} type="error" />}
          {episode.phase === 'complete' && (
            <>
              <Alert
                description={`${episode.survivorIds.length} contestants remain. Episode 3 does not start automatically.`}
                title="Episode 2 complete — recap"
                type="success"
              />
              <Typography.Title level={4}>Remaining contestants</Typography.Title>
              {people(episode.survivorIds)}
            </>
          )}
        </Card>
      )}
      {runtime.version === 1 && announcedWinners.length > 0 && (
        <Card title="Announced battle winners">
          <Space orientation="vertical">
            {announcedWinners.map((team) => (
              <div key={team.id}>
                <Typography.Text strong>{team.name}</Typography.Text> — {people(team.memberIds)}
              </div>
            ))}
          </Space>
        </Card>
      )}
      <Collapse
        defaultActiveKey={runtime.version === 1 && episode.phase === 'dorms' ? ['rooms'] : []}
        items={[
          {
            key: 'rooms',
            label: 'Production-assigned dorms — five rooms of six',
            children: (
              <section aria-label="Dorm room assignments">
                {episode.rooms.map((room, index) => (
                  <Card
                    key={room.id}
                    size="small"
                    title={`Room ${index + 1} — ${room.memberIds.length} contestants`}
                  >
                    {people(room.memberIds)}
                  </Card>
                ))}
              </section>
            ),
          },
          ...(episode.phase !== 'dorms'
            ? [
                {
                  key: 'ranking',
                  label: 'Opening overall ranking — Squirrel Zone 2 debut top five',
                  children: (
                    <ol>
                      {episode.rankedIds.map((id, index) => (
                        <li key={id}>
                          {inspect(id, true)} {index < 5 && <Tag color="gold">Debut zone</Tag>}
                        </li>
                      ))}
                    </ol>
                  ),
                },
              ]
            : []),
          ...(teamsRevealed
            ? [
                {
                  key: 'teams',
                  label: 'Teams and revealed preparation',
                  children: (
                    <Collapse
                      items={episode.teams.map((team) => ({
                        key: team.id,
                        label: team.name,
                        children: teamDetails(team),
                      }))}
                    />
                  ),
                },
              ]
            : []),
          ...(hasScene('battles') ||
          [
            'pairings',
            'preparation',
            'conflict',
            'performance',
            'broadcast',
            'audience',
            'saves',
            'results',
            'mvp',
            'secret',
            'complete',
          ].includes(episode.phase)
            ? [
                {
                  key: 'pairings',
                  label: 'Battle matchups',
                  children: episode.pairings.map((pairing, index) => (
                    <Typography.Paragraph key={pairing.id}>
                      {pairing.teamIds
                        .map((id) => episode.teams.find((team) => team.id === id)?.name ?? id)
                        .join(' vs ')}
                      {index < episode.revealedResults &&
                        ['results', 'saves', 'mvp', 'secret', 'complete'].includes(episode.phase) &&
                        pairing.winnerId && (
                          <strong>
                            {' '}
                            — Winner: {episode.teams.find((team) => team.id === pairing.winnerId)?.name}
                          </strong>
                        )}
                    </Typography.Paragraph>
                  )),
                },
              ]
            : []),
          ...(audienceRevealed && episode.audience
            ? [
                {
                  key: 'audience',
                  label: 'Revealed audience votes and combined ranking',
                  children: (
                    <ol>
                      {episode.finalRankedIds.map((id) => (
                        <li key={id}>
                          {inspect(id, true)} — {episode.audience?.votes[id] ?? 0} votes
                        </li>
                      ))}
                    </ol>
                  ),
                },
              ]
            : []),
          ...(resultsRevealed
            ? [
                {
                  key: 'departures',
                  label: 'Announced departures and saves',
                  children: (
                    <>
                      <Typography.Title level={4}>Departures</Typography.Title>
                      {people(episode.eliminatedIds.filter((id) => announcedIds.has(id)))}
                      <Typography.Title level={4}>Saved</Typography.Title>
                      {people(
                        [episode.judgeSaveId, episode.audienceSaveId, episode.productionSaveId].filter(
                          (id): id is string => !!id && announcedIds.has(id),
                        ),
                      )}
                    </>
                  ),
                },
              ]
            : []),
          ...(hasScene('mvp') && episode.mvp
            ? [
                {
                  key: 'mvp',
                  label: 'Contestants’ MVP',
                  children: (
                    <>
                      {inspect(episode.mvp.winnerId)} — {episode.mvp.totals[episode.mvp.winnerId] ?? 0} peer
                      votes.
                    </>
                  ),
                },
              ]
            : []),
          ...(hasScene('secret') && episode.secret
            ? [
                {
                  key: 'secret',
                  label: episode.secret.title,
                  children: (
                    <EpisodeSceneNarrative
                      contestants={state.contestants}
                      onInspect={onInspect}
                      reactions={[]}
                      scene={{
                        id: 'closing-secret',
                        kind: 'secret',
                        title: episode.secret.title,
                        paragraphs: [episode.secret.description],
                        contestantIds: [episode.secret.contestantId],
                      }}
                    />
                  ),
                },
              ]
            : []),
        ]}
      />
    </Space>
  );
}
