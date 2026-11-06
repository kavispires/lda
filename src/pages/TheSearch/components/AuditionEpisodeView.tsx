import {
  Alert,
  Button,
  Card,
  Col,
  Collapse,
  Form,
  Modal,
  Progress,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useState } from 'react';
import type { AuditionEvaluation, AuditionSkillCheck } from '../types/audition';
import type { AuditionAction, MoodChoices } from '../types/audition-episode';
import type { Specialties } from '../types/contestant';
import type { SimulationState } from '../types/simulation';
import { AutoCompleteEpisodeButton } from './AutoCompleteEpisodeButton';
import { ContestantAvatar } from './ContestantAvatar';
import { CopyEpisodeRundown } from './CopyEpisodeRundown';
import { EpisodeContestantList, EpisodeSceneNarrative } from './EpisodeNarrative';
import { EpisodeEndScreens } from './RelationshipUpdates';
import { ChangeDirection, ValueChange } from './SimulationChange';

const moodFields: { key: keyof Specialties; label: string }[] = [
  { key: 'vocalColor', label: 'Vocal color' },
  { key: 'danceStyle', label: 'Dance style' },
  { key: 'rapStyle', label: 'Rap style' },
  { key: 'visualVibe', label: 'Visual vibe' },
  { key: 'leadershipStyle', label: 'Leadership style' },
  { key: 'genreAffinity', label: 'Genre affinity' },
];

interface AuditionEpisodeViewProps {
  state: SimulationState;
  onAction: (action: AuditionAction, revision: number) => void;
  onInspect: (id: string) => void;
  actionError?: string | null;
}

export function AuditionEpisodeView({ state, onAction, onInspect, actionError }: AuditionEpisodeViewProps) {
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [mood, setMood] = useState<MoodChoices>({
    vocalColor: '',
    danceStyle: '',
    rapStyle: '',
    visualVibe: '',
    leadershipStyle: '',
    genreAffinity: '',
  });
  const [moodError, setMoodError] = useState(false);
  const runtime = state.runtime;
  if (!runtime) return null;
  const episode = runtime.audition;
  if (!episode) {
    return runtime.episode === 0 ? (
      <Card title="Episode 1 — Auditions">
        <AutoCompleteEpisodeButton episode={1} state={state} />
        <Typography.Paragraph>
          Fifty contestants, one first impression. Lock the opening mood, watch their song choices and
          performances unfold, then choose the broadcast. The judges send twenty home; the audience decides
          who starts building a following.
        </Typography.Paragraph>
        <Button onClick={() => onAction({ type: 'start' }, 0)} type="primary">
          Start Episode 1 — Auditions
        </Button>
      </Card>
    ) : null;
  }

  const cast = new Map(state.contestants.map((contestant) => [contestant.id, contestant]));
  const name = (id: string) => cast.get(id)?.name ?? id;
  const song = (id: string) => episode.pool.find((item) => item.id === id);
  const inspect = (id: string, portrait = false) => (
    <Button onClick={() => onInspect(id)} size="small" type="link">
      {portrait && <ContestantAvatar enablePreview={false} id={id} name={name(id)} size={28} />}
      {name(id)}
    </Button>
  );
  const people = (ids: string[]) => (
    <EpisodeContestantList contestants={state.contestants} ids={ids} onInspect={onInspect} />
  );
  const action = (value: AuditionAction) => onAction(value, episode.revision);
  const continueButton = (label: string) => (
    <Button onClick={() => action({ type: 'advance' })} type="primary">
      {label}
    </Button>
  );
  const latestScene = episode.scenes.at(-1);
  const selectedScene = episode.scenes.find((scene) => scene.id === historyId);
  const lookingBack = !!selectedScene && selectedScene.id !== latestScene?.id;
  const scene = lookingBack ? selectedScene : latestScene;
  const afterEliminations = ['mvp', 'secret', 'complete'].includes(episode.phase);
  const activeBatch = episode.batches.at(-1);
  const decisionTitle =
    episode.phase === 'mood'
      ? 'Your decision: set the opening mood'
      : episode.phase === 'broadcast'
        ? 'Your decision: choose the broadcast'
        : episode.phase === 'secret'
          ? 'Your decision: choose a secret check'
          : null;

  const evaluationDetails = (evaluation: AuditionEvaluation) => {
    const checks: { label: string; check: AuditionSkillCheck; weight: string }[] = [
      ...evaluation.technical.checks.map((check) => ({
        label: check.skill,
        check,
        weight: `Technical weight ${check.weight}`,
      })),
      { label: 'Stage presence', check: evaluation.stagePresence, weight: '35% of final' },
      ...Object.entries(evaluation.impressions).map(([label, check]) => ({
        label,
        check,
        weight:
          label === evaluation.preferences.visualOrUniqueness ||
          label === evaluation.preferences.potentialOrCharisma
            ? '10% of final'
            : 'Observed, not scored',
      })),
    ];
    return (
      <Space orientation="vertical" style={{ width: '100%' }}>
        <Typography.Text>
          Raw dice: {evaluation.rawDice.join(' + ')}. Technical {evaluation.technical.score.toFixed(1)} × 55%;
          stage presence {evaluation.stagePresence.score.toFixed(1)} × 35%;{' '}
          {evaluation.preferences.visualOrUniqueness} and {evaluation.preferences.potentialOrCharisma} × 10%
          each. Final capped at 100; unrounded values determine grades and results.
        </Typography.Text>
        <Space wrap>
          <Tag color="purple">Composure</Tag>
          <ChangeDirection change={evaluation.composure} />
          <span>
            {evaluation.composure > 0 ? '+' : ''}
            {evaluation.composure}
          </span>
          <Tag>Stage presence</Tag>
          <ValueChange after={evaluation.stagePresence.skillLevel} before={evaluation.baseStagePresence} />
        </Space>
        <Table
          columns={[
            { title: 'Check', dataIndex: 'label' },
            { title: 'Contribution', dataIndex: 'weight' },
            {
              title: 'Skill / requirement',
              render: (_, row) => `${row.check.skillLevel} / ${row.check.requiredLevel}`,
            },
            { title: 'Floor', render: (_, row) => row.check.floor },
            { title: 'Adjusted dice', render: (_, row) => row.check.adjustedDice.join(' + ') },
            { title: 'Score', render: (_, row) => row.check.score.toFixed(1) },
          ]}
          dataSource={checks}
          pagination={false}
          rowKey="label"
          scroll={{ x: 650 }}
          size="small"
        />
        {people([evaluation.contestantId])}
      </Space>
    );
  };

  return (
    <EpisodeEndScreens enabled={!lookingBack} episode={1} onInspect={onInspect} state={state}>
      <CopyEpisodeRundown episode={1} state={state} />
      <AutoCompleteEpisodeButton episode={1} onCompleted={() => setHistoryId(null)} state={state} />
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
        width={1040}
      >
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <AutoCompleteEpisodeButton episode={1} onCompleted={() => setHistoryId(null)} state={state} />
          <Alert
            description="Choose below to continue. Nothing advances until your decision is saved."
            showIcon
            title="Episode paused — your decision is required"
            type="warning"
          />
          {actionError && (
            <Alert
              description={actionError}
              showIcon
              title="Your decision could not be saved. Please try again."
              type="error"
            />
          )}
          {episode.phase === 'mood' && (
            <>
              <Typography.Paragraph>
                Set six opening spotlights. These are audience tastes for this episode, not a promise of
                success or a change to the judges' scoring.
              </Typography.Paragraph>
              <Form
                layout="vertical"
                onFinish={() => {
                  if (!moodFields.every(({ key }) => episode.moodOptions[key].includes(mood[key]))) {
                    setMoodError(true);
                    return;
                  }
                  setMoodError(false);
                  action({ type: 'mood', choices: { ...mood } });
                }}
                style={{ width: '100%' }}
              >
                <Row gutter={16}>
                  {moodFields.map(({ key, label }) => (
                    <Col key={key} md={8} sm={12} xs={24}>
                      <Form.Item label={label} required>
                        <Space aria-label={label} role="group" wrap>
                          {episode.moodOptions[key].map((id) => (
                            <Button
                              aria-pressed={mood[key] === id}
                              key={id}
                              onClick={() => setMood((previous) => ({ ...previous, [key]: id }))}
                              style={{ height: 'auto', whiteSpace: 'normal' }}
                              type={mood[key] === id ? 'primary' : 'default'}
                            >
                              {runtime.definitions.specialties[key][id]?.name ?? id}
                            </Button>
                          ))}
                        </Space>
                      </Form.Item>
                    </Col>
                  ))}
                </Row>
                {moodError && <Alert showIcon title="Choose one option in each category." type="error" />}
                <Button htmlType="submit" type="primary">
                  Lock opening mood and continue
                </Button>
              </Form>
              <Collapse
                items={[
                  {
                    key: 'inspect-cast',
                    label: 'Inspect the cast before deciding',
                    children: people(state.contestants.map((contestant) => contestant.id)),
                  },
                ]}
                style={{ width: '100%' }}
              />
            </>
          )}
          {episode.phase === 'broadcast' && (
            <>
              <Typography.Paragraph>
                Choose one complete broadcast package. The footage shapes attention, enjoyment and following —
                it cannot change the performances the judges already saw. Airing a package confirms your
                decision and continues the episode.
              </Typography.Paragraph>
              <Row gutter={[16, 16]} style={{ width: '100%' }}>
                {episode.cuts.map((cut) => (
                  <Col key={cut.id} md={8} xs={24}>
                    <Card title={cut.title}>
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
                      <Button onClick={() => action({ type: 'broadcast', cutId: cut.id })} type="primary">
                        Air {cut.title}
                      </Button>
                    </Card>
                  </Col>
                ))}
              </Row>
            </>
          )}
          {episode.phase === 'secret' && (
            <>
              <Typography.Paragraph>
                Choose one contestant to investigate before the credits. They may have no secret. Checking
                someone confirms your decision and finishes the episode; it cannot be undone.
              </Typography.Paragraph>
              <Space wrap>
                {episode.secretCandidates.map((id) => (
                  <Card key={id} size="small">
                    {people([id])}
                    <Button onClick={() => action({ type: 'secret', contestantId: id })} type="primary">
                      Check {name(id)}
                    </Button>
                  </Card>
                ))}
              </Space>
            </>
          )}
        </Space>
      </Modal>
      <Card
        extra={
          <Tag color={decisionTitle ? 'gold' : undefined}>
            {decisionTitle
              ? 'Paused — your decision'
              : episode.phase === 'complete'
                ? 'Episode complete'
                : episode.phase}
          </Tag>
        }
        title="Episode 1 — Auditions"
      >
        <Typography.Paragraph type="secondary">
          Player decisions pause the episode in a dialog. Continue watches and saves the next story scene.
          Inspecting contestants or looking back never advances the show. Season standings stay hidden until
          Episode 3.
        </Typography.Paragraph>
        {episode.relationshipPolicy === 'reactions-only' && (
          <Alert
            description="This saved episode keeps its original relationship rules. Start a new simulation for everyone to form an opinion of every audition."
            showIcon
            style={{ marginBottom: 16 }}
            title="Earlier Auditions rules"
            type="info"
          />
        )}
        {episode.scenes.length > 1 && (
          <Collapse
            items={[
              {
                key: 'scenes',
                label: 'Look back at a scene',
                children: (
                  <Space aria-label="Episode scenes" role="group" wrap>
                    {episode.scenes.map((item) => (
                      <Button
                        aria-pressed={scene?.id === item.id}
                        key={item.id}
                        onClick={() => setHistoryId(item.id === latestScene?.id ? null : item.id)}
                        type={scene?.id === item.id ? 'primary' : 'default'}
                      >
                        {item.title}
                      </Button>
                    ))}
                  </Space>
                ),
              },
            ]}
            style={{ marginBottom: 16 }}
          />
        )}
        {lookingBack && (
          <Alert
            action={<Button onClick={() => setHistoryId(null)}>Return to current scene</Button>}
            showIcon
            title="Looking back — the current phase is unchanged"
            type="info"
          />
        )}
        {scene && (
          <section aria-label={scene.title}>
            <Typography.Title level={3}>{scene.title}</Typography.Title>
            <EpisodeSceneNarrative
              contestants={state.contestants}
              onInspect={onInspect}
              reactions={episode.reactions}
              scene={scene}
            />
          </section>
        )}

        {!lookingBack && (
          <Space orientation="vertical" size="middle" style={{ width: '100%', marginTop: 16 }}>
            {episode.phase === 'choices' && (
              <>
                <Typography.Paragraph>
                  The contestants have chosen for themselves. Off-track choices trade familiarity for a chance
                  to stand out; every arrangement tests its listed skills.
                </Typography.Paragraph>
                {continueButton('Continue to live auditions')}
              </>
            )}
            {episode.phase === 'live' && (
              <>
                <Progress
                  format={() => `${episode.cursor} / ${episode.order.length} auditions`}
                  percent={(episode.cursor / Math.max(1, episode.order.length)) * 100}
                />
                {activeBatch && (
                  <Typography.Paragraph>
                    Judging batch {episode.batches.length} of 4: bonus attention on{' '}
                    <strong>{activeBatch.preferences.visualOrUniqueness}</strong> and{' '}
                    <strong>{activeBatch.preferences.potentialOrCharisma}</strong>. Preferences are locked for
                    the whole batch.
                  </Typography.Paragraph>
                )}
                {continueButton('Continue auditions')}
              </>
            )}
            {episode.phase === 'audience' && episode.audience && (
              <>
                <Row gutter={[24, 16]} style={{ width: '100%' }}>
                  <Col>
                    <Statistic title="Show audience" value={runtime.show.audience} />
                  </Col>
                  <Col>
                    <Statistic
                      prefix={<ChangeDirection change={episode.audience.newViewers} />}
                      title="New viewers"
                      value={episode.audience.newViewers}
                    />
                  </Col>
                  <Col>
                    <Statistic title="General viewers" value={runtime.show.general} />
                  </Col>
                  <Col>
                    <Statistic
                      precision={1}
                      suffix="/ 100"
                      title="Viewer satisfaction"
                      value={episode.audience.satisfactionAfter}
                    />
                  </Col>
                  <Col>
                    <Statistic
                      precision={1}
                      prefix={
                        <ChangeDirection
                          change={episode.audience.satisfactionAfter - episode.audience.satisfactionBefore}
                        />
                      }
                      title="Satisfaction change"
                      value={episode.audience.satisfactionAfter - episode.audience.satisfactionBefore}
                    />
                  </Col>
                  <Col>
                    <Statistic title="Voting population" value={episode.audience.votingPopulation} />
                  </Col>
                </Row>
                <Alert
                  showIcon
                  title="Audience votes build popularity. The judges' bottom-twenty cut is unchanged."
                  type="info"
                />
                <Table
                  columns={[
                    { title: 'Contestant', dataIndex: 'id', render: (id: string) => inspect(id, true) },
                    { title: 'Raw votes', dataIndex: 'votes' },
                    {
                      title: 'New fans',
                      dataIndex: 'fans',
                      render: (fans: number) => (
                        <Space size={4}>
                          <ChangeDirection change={fans} />
                          {fans}
                        </Space>
                      ),
                    },
                  ]}
                  dataSource={Object.entries(episode.audience.votes)
                    .map(([id, votes]) => ({
                      id,
                      votes,
                      fans: episode.audience?.newFans[id] ?? 0,
                    }))
                    .sort((a, b) => b.votes - a.votes)}
                  pagination={{ pageSize: 10 }}
                  rowKey="id"
                  size="small"
                />
                {continueButton('Continue to eliminations')}
              </>
            )}
            {episode.phase === 'eliminations' && (
              <>
                <Typography.Paragraph>
                  {episode.revealedEliminations} of 20 departures announced. Each Continue reveals the next
                  group.
                </Typography.Paragraph>
                {people(episode.eliminatedIds.slice(0, episode.revealedEliminations))}
                {continueButton(
                  episode.revealedEliminations < 20
                    ? 'Reveal next departures'
                    : 'Continue to peer recognition',
                )}
              </>
            )}
            {episode.phase === 'mvp' && (
              <>
                <Typography.Paragraph>
                  Thirty survivors now recognize the peer who impressed them. This is their choice, not a
                  production award.
                </Typography.Paragraph>
                {continueButton('Reveal the contestants’ MVP')}
              </>
            )}
            {(episode.phase === 'secret' || episode.phase === 'complete') && episode.mvp && (
              <Card size="small" title="Contestants’ MVP">
                {people([episode.mvp.winnerId])}
                <Typography.Paragraph>
                  {episode.mvp.totals[episode.mvp.winnerId] ?? 0} peer votes.
                  {episode.mvp.tiedIds.length > 1 &&
                    ' A tied vote was resolved using the episode’s recorded tiebreak.'}
                </Typography.Paragraph>
              </Card>
            )}
            {episode.phase === 'complete' && (
              <>
                {episode.secret && (
                  <Alert
                    description={
                      <EpisodeSceneNarrative
                        contestants={state.contestants}
                        onInspect={onInspect}
                        reactions={[]}
                        scene={{
                          id: 'closing-secret',
                          kind: 'secret',
                          title: episode.secret.title,
                          paragraphs: [
                            episode.secret.description,
                            ...(episode.secret.deferred.length
                              ? ['Recorded consequences will apply at the next episode opening.']
                              : []),
                          ],
                          contestantIds: [episode.secret.contestantId],
                        }}
                      />
                    }
                    showIcon
                    title={`${episode.secret.cardId ? 'Secret revealed' : 'No secret found'}: ${episode.secret.title}`}
                    type={episode.secret.cardId ? 'warning' : 'info'}
                  />
                )}
                <Typography.Title level={4}>Episode complete</Typography.Title>
                <Typography.Paragraph>
                  {episode.survivorIds.length} remain; {episode.eliminatedIds.length} depart. The episode and
                  every audition are saved. Episode 2 is not available yet.
                </Typography.Paragraph>
              </>
            )}
            {afterEliminations && (
              <Collapse
                items={[
                  {
                    key: 'survivors',
                    label: `${episode.survivorIds.length} survivors`,
                    children: people(episode.survivorIds),
                  },
                  {
                    key: 'departures',
                    label: `${episode.eliminatedIds.length} departures`,
                    children: people(episode.eliminatedIds),
                  },
                ]}
                style={{ width: '100%' }}
              />
            )}
          </Space>
        )}
      </Card>

      {Object.keys(episode.songChoices).length > 0 && (
        <Collapse
          defaultActiveKey={episode.phase === 'choices' ? ['choices'] : []}
          items={[
            {
              key: 'choices',
              label: `Locked song choices (${Object.keys(episode.songChoices).length})`,
              children: (
                <Table
                  columns={[
                    { title: 'Contestant', dataIndex: 'id', render: (id: string) => inspect(id, true) },
                    { title: 'Song', dataIndex: 'songId', render: (id: string) => song(id)?.title ?? id },
                    {
                      title: 'Arrangement',
                      render: (_, row) =>
                        song(row.songId)
                          ?.part.testedSkills.map((check) => `${check.skill} ${check.requiredLevel}/5`)
                          .join(', '),
                    },
                    {
                      title: 'Choice',
                      render: (_, row) =>
                        cast.get(row.id)?.track === song(row.songId)?.track ? 'Own track' : 'Off-track',
                    },
                  ]}
                  dataSource={Object.entries(episode.songChoices).map(([id, songId]) => ({ id, songId }))}
                  expandable={{
                    expandedRowRender: (row) => (
                      <Typography.Paragraph>{song(row.songId)?.description}</Typography.Paragraph>
                    ),
                  }}
                  pagination={{ pageSize: 10 }}
                  rowKey="id"
                  scroll={{ x: 650 }}
                  size="small"
                />
              ),
            },
          ]}
        />
      )}
      {episode.evaluations.length > 0 && (
        <Collapse
          items={[
            {
              key: 'performances',
              label: `Resolved auditions (${episode.evaluations.length} / 50)`,
              children: (
                <>
                  <Typography.Paragraph type="secondary">
                    In performance order, not season rank. Expand an audition for its dice and weighted
                    checks.
                  </Typography.Paragraph>
                  <Table
                    columns={[
                      { title: 'Contestant', dataIndex: 'contestantId', render: (id: string) => inspect(id) },
                      { title: 'Song', dataIndex: 'songId', render: (id: string) => song(id)?.title ?? id },
                      {
                        title: 'Judged score',
                        dataIndex: 'finalScore',
                        render: (score: number) => score.toFixed(1),
                      },
                      { title: 'Grade', dataIndex: 'grade', render: (grade: string) => <Tag>{grade}</Tag> },
                    ]}
                    dataSource={episode.evaluations}
                    expandable={{ expandedRowRender: evaluationDetails }}
                    pagination={{ pageSize: 10 }}
                    rowKey="contestantId"
                    scroll={{ x: 550 }}
                    size="small"
                  />
                </>
              ),
            },
          ]}
        />
      )}
      {episode.reactions.length > 0 && (
        <Collapse
          items={[
            {
              key: 'reactions',
              label: 'Backstage reactions',
              children: (
                <EpisodeSceneNarrative
                  contestants={state.contestants}
                  onInspect={onInspect}
                  reactions={[]}
                  scene={{
                    id: 'backstage-reactions',
                    kind: 'recap',
                    title: 'Backstage reactions',
                    paragraphs: episode.reactions.map((reaction) => reaction.narrative),
                    contestantIds: episode.reactions.flatMap((reaction) => [
                      reaction.observerId,
                      reaction.performerId,
                    ]),
                  }}
                />
              ),
            },
          ]}
        />
      )}
    </EpisodeEndScreens>
  );
}
