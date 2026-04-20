import { AppstoreOutlined, RocketOutlined, TableOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useStore } from '@tanstack/react-store';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Progress,
  Row,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { Content } from 'components/Content';
import { useState } from 'react';
import type { Dictionary } from 'types/common';
import { ContestantAvatar } from '../components/ContestantAvatar';
import { ContestantDetailModal } from '../components/ContestantDetailModal';
import auditionSongsData from '../data/audition-songs.json';
import secretCardsData from '../data/secret-cards.json';
import { useContestantsContext } from '../services/ContestantsProvider';
import { simulationActions, simulationStore } from '../services/SimulationStore';
import type { AttributeCard, PerformanceSong } from '../types/common';
import type { Contestant } from '../types/contestant';
import { processSimulationContestants } from '../utilities/card-assignment';
import { selectDiverseContestants } from '../utilities/simulation-helpers';

const SECRET_CARDS = secretCardsData as Dictionary<AttributeCard>;
const AUDITION_SONGS = auditionSongsData as PerformanceSong[];

export function SimulationPage() {
  const { contestants: contestantsData } = useContestantsContext();
  const simulationState = useStore(simulationStore, (state) => state);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isRunningEpisode, setIsRunningEpisode] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleStartSimulation = async () => {
    setIsInitializing(true);
    setError(null);
    setProgress(0);

    try {
      // Step 1: Select 50 diverse contestants
      setProgressText('Selecting 50 diverse contestants...');
      setProgress(20);
      await new Promise((resolve) => setTimeout(resolve, 300));

      const selectedIds = selectDiverseContestants(contestantsData);

      // Step 2: Assign cards and apply influences
      setProgressText('Assigning attribute cards and calculating influences...');
      setProgress(40);
      await new Promise((resolve) => setTimeout(resolve, 300));

      const processedContestants = processSimulationContestants(selectedIds, contestantsData);

      // Step 3: Initialize simulation
      setProgressText('Initializing simulation state...');
      setProgress(80);
      await new Promise((resolve) => setTimeout(resolve, 200));

      simulationActions.initializeSimulation(processedContestants);

      setProgressText('Simulation ready!');
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      simulationActions.setStatus('idle');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleClearSimulation = () => {
    if (window.confirm('Are you sure you want to clear the current simulation? This cannot be undone.')) {
      simulationActions.clearSimulation();
      setProgress(0);
      setProgressText('');
      setError(null);
    }
  };

  const handleRunEpisode1 = async () => {
    setIsRunningEpisode(true);
    setError(null);
    setProgress(0);

    try {
      setProgressText('Running Episode 1: Auditions...');
      setProgress(20);
      await new Promise((resolve) => setTimeout(resolve, 500));

      setProgressText('Contestants selecting songs...');
      setProgress(40);
      await new Promise((resolve) => setTimeout(resolve, 500));

      setProgressText('Calculating performances and grading...');
      setProgress(60);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Run episode
      simulationActions.runEpisode1(AUDITION_SONGS);

      setProgressText('Episode 1 complete!');
      setProgress(100);
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsRunningEpisode(false);
      setProgress(0);
      setProgressText('');
    }
  };

  const hasSimulation = simulationState.contestants.length > 0;
  const currentEpisode = simulationState.episode;

  return (
    <Content>
      <Typography.Title level={1}>
        <RocketOutlined /> Simulation
      </Typography.Title>
      <Typography.Paragraph style={{ fontSize: '16px' }}>
        Initialize a new survival show simulation with 50 diverse contestants. The system will automatically
        assign personas, attributes, and calculate initial statistics.
      </Typography.Paragraph>

      {error && (
        <Alert
          closable
          description={error}
          message="Initialization Error"
          onClose={() => setError(null)}
          showIcon
          style={{ marginBottom: '1rem' }}
          type="error"
        />
      )}

      {!hasSimulation && !isInitializing && (
        <Card style={{ marginTop: '2rem', maxWidth: '800px' }}>
          <Typography.Title level={3}>Initialization Process</Typography.Title>
          <Typography.Paragraph>When you start a new simulation, the system will:</Typography.Paragraph>
          <ul>
            <li>Select 50 diverse contestants from Firestore (~23 VOCAL, ~14 RAP, ~14 DANCE)</li>
            <li>Assign unique persona cards to each contestant</li>
            <li>Add identity, interest, and secret attribute cards</li>
            <li>Calculate influences from all cards and specialties</li>
            <li>Initialize relationships between all contestants</li>
            <li>Create baseline statistics for the competition</li>
          </ul>

          <div style={{ marginTop: '2rem' }}>
            <Button
              icon={<RocketOutlined />}
              loading={isInitializing}
              onClick={handleStartSimulation}
              size="large"
              type="primary"
            >
              Start New Simulation
            </Button>
          </div>
        </Card>
      )}

      {isInitializing && (
        <Card style={{ marginTop: '2rem', maxWidth: '800px' }}>
          <Typography.Title level={3}>Initializing Simulation...</Typography.Title>
          <Progress percent={progress} status="active" />
          <Typography.Paragraph style={{ marginTop: '1rem' }}>{progressText}</Typography.Paragraph>
        </Card>
      )}

      {isRunningEpisode && (
        <Card style={{ marginTop: '2rem', maxWidth: '800px' }}>
          <Typography.Title level={3}>Running Episode {currentEpisode + 1}...</Typography.Title>
          <Progress percent={progress} status="active" />
          <Typography.Paragraph style={{ marginTop: '1rem' }}>{progressText}</Typography.Paragraph>
        </Card>
      )}

      {hasSimulation && !isInitializing && (
        <>
          <EpisodeTimeline
            currentEpisode={currentEpisode}
            isRunningEpisode={isRunningEpisode}
            onClearSimulation={handleClearSimulation}
            onRunEpisode1={handleRunEpisode1}
          />

          <SimulationTabs contestants={simulationState.contestants} currentEpisode={currentEpisode} />
        </>
      )}
    </Content>
  );
}

interface EpisodeTimelineProps {
  currentEpisode: number;
  isRunningEpisode: boolean;
  onRunEpisode1: () => void;
  onClearSimulation: () => void;
}

function EpisodeTimeline({
  currentEpisode,
  isRunningEpisode,
  onRunEpisode1,
  onClearSimulation,
}: EpisodeTimelineProps) {
  const episodes = [
    {
      number: 1,
      title: 'Auditions',
      description: 'All 50 contestants perform their audition songs and receive grades',
      details: [
        'Contestants select songs based on skill match and personality',
        'Performance scores calculated with execution, modifiers, and RNG variance',
        "Grades assigned with producer interference and quotas (6 A's, 20 F's)",
        'Relationships updated and screen time allocated via narrative tiers',
      ],
    },
    {
      number: 2,
      title: 'Episode 2',
      description: 'Coming soon...',
      details: [],
    },
    {
      number: 3,
      title: 'Episode 3',
      description: 'Coming soon...',
      details: [],
    },
  ];

  const getEpisodeStatus = (episodeNum: number) => {
    if (episodeNum < currentEpisode) return 'completed';
    if (episodeNum === currentEpisode) return 'current';
    return 'locked';
  };

  const getStatusTag = (episodeNum: number) => {
    const status = getEpisodeStatus(episodeNum);
    if (status === 'completed') return <Tag color="green">Completed</Tag>;
    if (status === 'current') return <Tag color="blue">Available</Tag>;
    return <Tag>Locked</Tag>;
  };

  return (
    <Card style={{ marginTop: '2rem' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Typography.Title level={2}>
            <RocketOutlined /> Episode Timeline
          </Typography.Title>
          <Typography.Paragraph>
            Progress through the competition by running episodes. Each episode simulates key events and
            updates contestant stats.
          </Typography.Paragraph>
        </div>

        <Row gutter={[16, 16]}>
          {episodes.map((ep) => {
            const status = getEpisodeStatus(ep.number);
            const isAvailable = ep.number === currentEpisode + 1;
            const isImplemented = ep.number === 1; // Only Episode 1 is implemented

            return (
              <Col key={ep.number} lg={8} md={12} sm={24} xs={24}>
                <Card
                  size="small"
                  style={{
                    backgroundColor:
                      status === 'completed' ? '#f6ffed' : status === 'current' ? '#e6f7ff' : '#fafafa',
                    borderColor:
                      status === 'completed' ? '#52c41a' : status === 'current' ? '#1890ff' : '#d9d9d9',
                  }}
                  title={
                    <Space>
                      <Typography.Text strong>
                        Episode {ep.number}: {ep.title}
                      </Typography.Text>
                      {getStatusTag(ep.number)}
                    </Space>
                  }
                >
                  <Typography.Paragraph>{ep.description}</Typography.Paragraph>
                  {ep.details.length > 0 && (
                    <ul style={{ fontSize: '12px', marginBottom: '1rem', paddingLeft: '1.2rem' }}>
                      {ep.details.map((detail, idx) => (
                        <li key={idx}>{detail}</li>
                      ))}
                    </ul>
                  )}
                  {isAvailable && isImplemented && (
                    <Button
                      block
                      disabled={isRunningEpisode}
                      icon={<ThunderboltOutlined />}
                      loading={isRunningEpisode}
                      onClick={ep.number === 1 ? onRunEpisode1 : undefined}
                      type="primary"
                    >
                      Run Episode {ep.number}
                    </Button>
                  )}
                  {isAvailable && !isImplemented && (
                    <Button block disabled type="default">
                      Coming Soon
                    </Button>
                  )}
                  {status === 'completed' && (
                    <Tag color="success" style={{ width: '100%', textAlign: 'center' }}>
                      ✓ Episode Completed
                    </Tag>
                  )}
                </Card>
              </Col>
            );
          })}
        </Row>

        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '1rem' }}>
          <Space>
            <Typography.Text type="secondary">
              Current Episode: {currentEpisode} | Next: Episode {currentEpisode + 1}
            </Typography.Text>
            <Button danger onClick={onClearSimulation}>
              Clear Simulation
            </Button>
          </Space>
        </div>
      </Space>
    </Card>
  );
}

interface SimulationTabsProps {
  contestants: Contestant[];
  currentEpisode: number;
}

function SimulationTabs({ contestants, currentEpisode }: SimulationTabsProps) {
  const tabItems = [
    {
      key: 'contestants',
      label: (
        <span>
          <TableOutlined /> Contestants
        </span>
      ),
      children: <SimulationOverview contestants={contestants} episode={currentEpisode} />,
    },
  ];

  // Add episode tabs for completed episodes
  if (currentEpisode >= 1) {
    tabItems.push({
      key: 'episode-1',
      label: (
        <span>
          <RocketOutlined /> Episode 1: Auditions
        </span>
      ),
      children: <EpisodeNarrative contestants={contestants} episode={1} />,
    });
  }

  // Add placeholders for future episodes
  if (currentEpisode >= 2) {
    tabItems.push({
      key: 'episode-2',
      label: (
        <span>
          <RocketOutlined /> Episode 2
        </span>
      ),
      children: <EpisodeNarrative contestants={contestants} episode={2} />,
    });
  }

  return (
    <div style={{ marginTop: '2rem' }}>
      <Tabs defaultActiveKey="contestants" items={tabItems} size="large" type="card" />
    </div>
  );
}

interface SimulationOverviewProps {
  contestants: Contestant[];
  episode: number;
  onClear?: () => void; // Optional now since EpisodeTimeline has the main clear button
}

function SimulationOverview({ contestants, episode }: SimulationOverviewProps) {
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [selectedContestant, setSelectedContestant] = useState<Contestant | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const trackCounts = contestants.reduce(
    (acc, c) => {
      acc[c.track] = (acc[c.track] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const gradeCounts = contestants.reduce(
    (acc, c) => {
      acc[c.grade] = (acc[c.grade] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const secretCount = contestants.filter((c) => c.attributes.some((id) => SECRET_CARDS[id])).length;

  const columns = [
    {
      title: 'Rank',
      dataIndex: 'rank',
      key: 'rank',
      width: 80,
      render: (rank: number) => (rank > 0 ? `#${rank}` : '—'),
      sorter: (a: Contestant, b: Contestant) => a.rank - b.rank,
      defaultSortOrder: 'ascend' as const,
    },
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      sorter: (a: Contestant, b: Contestant) => a.id.localeCompare(b.id),
    },
    {
      title: 'Avatar',
      dataIndex: 'id',
      key: 'avatar',
      width: 80,
      render: (_: string, record: Contestant) => (
        <ContestantAvatar enablePreview={false} id={record.id} name={record.name} size={48} />
      ),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: Contestant, b: Contestant) => a.name.localeCompare(b.name),
    },
    {
      title: 'Track',
      dataIndex: 'track',
      key: 'track',
      width: 100,
      render: (track: string) => (
        <Tag color={track === 'VOCAL' ? 'blue' : track === 'RAP' ? 'orange' : 'green'}>{track}</Tag>
      ),
      sorter: (a: Contestant, b: Contestant) => a.track.localeCompare(b.track),
    },
    {
      title: 'Grade',
      dataIndex: 'grade',
      key: 'grade',
      width: 80,
      sorter: (a: Contestant, b: Contestant) => a.grade.localeCompare(b.grade),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const color =
          status === 'ACTIVE'
            ? 'green'
            : status === 'ELIMINATED'
              ? 'red'
              : status === 'WINNER'
                ? 'gold'
                : 'default';
        return <Tag color={color}>{status}</Tag>;
      },
      sorter: (a: Contestant, b: Contestant) => a.status.localeCompare(b.status),
    },
    {
      title: 'Persona',
      dataIndex: 'persona',
      key: 'persona',
      width: 200,
      render: (persona: string) => persona || '—',
      sorter: (a: Contestant, b: Contestant) => (a.persona || '').localeCompare(b.persona || ''),
    },
    {
      title: 'Score',
      dataIndex: ['aggregations', 'score'],
      key: 'score',
      width: 80,
      sorter: (a: Contestant, b: Contestant) => a.aggregations.score - b.aggregations.score,
    },
    {
      title: 'Rating',
      dataIndex: 'missionRating',
      key: 'missionRating',
      width: 80,
      render: (rating: number) => (
        <Tag color={rating >= 4 ? 'green' : rating >= 3 ? 'blue' : rating >= 2 ? 'orange' : 'red'}>
          {rating > 0 ? rating : '—'}
        </Tag>
      ),
      sorter: (a: Contestant, b: Contestant) => a.missionRating - b.missionRating,
    },
    {
      title: 'Screen Time',
      dataIndex: ['aggregations', 'screenTime'],
      key: 'screenTime',
      width: 110,
      render: (screenTime: number) => (screenTime > 0 ? `${screenTime.toFixed(1)}m` : '—'),
      sorter: (a: Contestant, b: Contestant) => a.aggregations.screenTime - b.aggregations.screenTime,
    },
    {
      title: 'Experience',
      dataIndex: ['aggregations', 'experience'],
      key: 'experience',
      width: 100,
      sorter: (a: Contestant, b: Contestant) => a.aggregations.experience - b.aggregations.experience,
    },
  ];

  return (
    <div style={{ marginTop: '2rem' }}>
      <Card>
        <Space align="start" direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Typography.Title level={2}>
              {episode === 0 ? 'Simulation Ready' : `Episode ${episode} Complete`}
            </Typography.Title>
            <Typography.Paragraph>
              {episode === 0
                ? `Successfully initialized simulation with ${contestants.length} contestants.`
                : `Episode ${episode} completed with ${contestants.length} contestants.`}
            </Typography.Paragraph>
          </div>

          <Descriptions bordered column={2}>
            <Descriptions.Item label="Total Contestants">{contestants.length}</Descriptions.Item>
            <Descriptions.Item label="Current Episode">{episode}</Descriptions.Item>
            <Descriptions.Item label="Secret Cards">{secretCount}</Descriptions.Item>
            <Descriptions.Item label="VOCAL Track">{trackCounts.VOCAL || 0}</Descriptions.Item>
            <Descriptions.Item label="RAP Track">{trackCounts.RAP || 0}</Descriptions.Item>
            <Descriptions.Item label="DANCE Track">{trackCounts.DANCE || 0}</Descriptions.Item>
            <Descriptions.Item label="Status">Ready</Descriptions.Item>
          </Descriptions>

          <div>
            <Typography.Title level={4}>Grade Distribution</Typography.Title>
            <Typography.Text>
              A: {gradeCounts.A || 0} | B: {gradeCounts.B || 0} | C: {gradeCounts.C || 0} | D:{' '}
              {gradeCounts.D || 0} | F: {gradeCounts.F || 0}
            </Typography.Text>
          </div>

          <Space style={{ marginBottom: '1rem' }}>
            <Button
              icon={<TableOutlined />}
              onClick={() => setViewMode('table')}
              type={viewMode === 'table' ? 'primary' : 'default'}
            >
              Table View
            </Button>
            <Button
              icon={<AppstoreOutlined />}
              onClick={() => setViewMode('cards')}
              type={viewMode === 'cards' ? 'primary' : 'default'}
            >
              Card View
            </Button>
          </Space>

          {viewMode === 'table' ? (
            <Table
              columns={columns}
              dataSource={contestants}
              onRow={(record) => ({
                onClick: () => setSelectedContestant(record),
                style: { cursor: 'pointer' },
              })}
              pagination={{
                pageSize,
                showSizeChanger: true,
                pageSizeOptions: [10, 20, 30, 50],
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} contestants`,
                onShowSizeChange: (_, newPageSize) => setPageSize(newPageSize),
              }}
              rowKey="id"
              scroll={{ x: 800 }}
              size="small"
            />
          ) : (
            <Row gutter={[16, 16]}>
              {contestants.map((contestant) => (
                <Col key={contestant.id} lg={6} md={8} sm={12} xs={24}>
                  <Card
                    hoverable
                    onClick={() => setSelectedContestant(contestant)}
                    style={{ textAlign: 'center' }}
                  >
                    <ContestantAvatar
                      enablePreview={false}
                      id={contestant.id}
                      name={contestant.name}
                      size={80}
                    />
                    <Typography.Title level={5} style={{ marginTop: '0.5rem', marginBottom: '0.25rem' }}>
                      {contestant.name}
                    </Typography.Title>
                    <Typography.Text type="secondary">{contestant.id}</Typography.Text>
                    <div style={{ marginTop: '0.5rem' }}>
                      <Tag
                        color={
                          contestant.track === 'VOCAL'
                            ? 'blue'
                            : contestant.track === 'RAP'
                              ? 'orange'
                              : 'green'
                        }
                      >
                        {contestant.track}
                      </Tag>
                      <Tag>{contestant.grade}</Tag>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Space>
      </Card>

      <ContestantDetailModal
        allContestants={contestants}
        contestant={selectedContestant}
        onClose={() => setSelectedContestant(null)}
      />
    </div>
  );
}

interface EpisodeNarrativeProps {
  contestants: Contestant[];
  episode: number;
}

function EpisodeNarrative({ contestants, episode }: EpisodeNarrativeProps) {
  const [selectedContestant, setSelectedContestant] = useState<Contestant | null>(null);

  // Get episode data from changeLog
  const episodeData = contestants
    .map((c) => {
      const log = c.changeLog.find((l) => l.episode === episode);
      return {
        contestant: c,
        log,
        tier: (log?.change.tier as number) || 5,
        songId: (log?.change.songId as string) || '',
        segment: (log?.change.segment as number) || 1,
        commercialBreakAfter: log?.change.commercialBreakAfter as string | undefined,
        summary: log?.summary || '',
        grade: c.grade,
        missionRating: log?.missionRating || 0,
        rank: log?.rank || 0,
      };
    })
    .filter((d) => d.log); // Only contestants with episode data

  // Group by segment instead of tier
  const segmentGroups = episodeData.reduce(
    (acc, data) => {
      const seg = data.segment;
      if (!acc[seg]) {
        acc[seg] = [];
      }
      acc[seg].push(data);
      return acc;
    },
    {} as Record<number, typeof episodeData>,
  );

  // Sort contestants within each segment by rank (edit order)
  Object.values(segmentGroups).forEach((group) => {
    group.sort((a, b) => a.rank - b.rank);
  });

  // Calculate statistics
  const gradeCounts = contestants.reduce(
    (acc, c) => {
      acc[c.grade] = (acc[c.grade] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const tierNames: Record<number, string> = {
    1.5: 'Ace Closer',
    1: 'Spotlight',
    2: 'Quad Split',
    3: 'Montage Featured',
    4: 'Montage Quick',
    5: 'Montage Flash',
  };

  const segmentNames: Record<number, string> = {
    1: 'Opening Act',
    2: 'Rising Tension',
    3: 'Building Momentum',
    4: 'Grand Finale',
  };

  // Get song info
  const songMap = AUDITION_SONGS.reduce(
    (acc, song) => {
      acc[song.id] = song.title;
      return acc;
    },
    {} as Record<string, string>,
  );

  // Check for episode ending announcement
  const episodeEndingStr = contestants[0]?.changeLog.find((l) => l.episode === episode)?.change
    .episodeEnding as string | undefined;

  const episodeEnding = episodeEndingStr
    ? (JSON.parse(episodeEndingStr) as {
        type: string;
        message: string;
        top5?: Array<{ id: string; name: string; rank: number }>;
        eliminated?: Array<{ id: string; name: string; rank: number }>;
      })
    : undefined;

  return (
    <div style={{ marginTop: '2rem' }}>
      <Card>
        <Space align="start" direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Typography.Title level={2}>Episode {episode}: Auditions - The Narrative</Typography.Title>
            <Typography.Paragraph>
              Watch the story unfold as 50 contestants take the stage, each hoping to secure their spot in the
              competition.
            </Typography.Paragraph>
          </div>

          <Card size="small" style={{ backgroundColor: '#f0f2f5' }}>
            <Typography.Title level={4}>Episode Facts</Typography.Title>
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Descriptions bordered column={3} size="small">
                  <Descriptions.Item label="Total Performances">{contestants.length}</Descriptions.Item>
                  <Descriptions.Item label="Songs Available">{AUDITION_SONGS.length}</Descriptions.Item>
                  <Descriptions.Item label="Grade A (Top Tier)">
                    {gradeCounts.A || 0} contestants
                  </Descriptions.Item>
                  <Descriptions.Item label="Grade B">{gradeCounts.B || 0} contestants</Descriptions.Item>
                  <Descriptions.Item label="Grade C">{gradeCounts.C || 0} contestants</Descriptions.Item>
                  <Descriptions.Item label="Grade D">{gradeCounts.D || 0} contestants</Descriptions.Item>
                  <Descriptions.Item label="Grade F (Bottom Tier)">
                    {gradeCounts.F || 0} contestants
                  </Descriptions.Item>
                  <Descriptions.Item label="Total Screen Time">
                    {contestants.reduce((sum, c) => sum + c.aggregations.screenTime, 0).toFixed(1)} minutes
                  </Descriptions.Item>
                </Descriptions>
              </Col>
            </Row>
          </Card>

          <div>
            <Typography.Title level={3}>The Audition Story</Typography.Title>
            <Typography.Paragraph type="secondary">
              Experience the episode as it aired, complete with commercial breaks and the dramatic flow of the
              edited show. Contestants are shown in chronological order within each segment.
            </Typography.Paragraph>
          </div>

          {[1, 2, 3, 4].map((segmentNum) => {
            const segmentData = segmentGroups[segmentNum];
            if (!segmentData || segmentData.length === 0) return null;

            // Find if there's a commercial break after this segment
            const commercialBreak = segmentData.find((d) => d.commercialBreakAfter)?.commercialBreakAfter;

            return (
              <div key={segmentNum}>
                <Card
                  size="small"
                  style={{ marginBottom: '1rem' }}
                  title={
                    <Space>
                      <Tag color="blue">Segment {segmentNum}</Tag>
                      <Typography.Text strong>{segmentNames[segmentNum]}</Typography.Text>
                      <Typography.Text type="secondary">
                        ({segmentData.length} {segmentData.length === 1 ? 'performance' : 'performances'})
                      </Typography.Text>
                    </Space>
                  }
                >
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    {segmentData.map((data) => (
                      <Card
                        hoverable
                        key={data.contestant.id}
                        onClick={() => setSelectedContestant(data.contestant)}
                        size="small"
                        style={{ cursor: 'pointer' }}
                      >
                        <Row align="middle" gutter={16}>
                          <Col>
                            <ContestantAvatar
                              enablePreview={false}
                              id={data.contestant.id}
                              name={data.contestant.name}
                              size={64}
                            />
                          </Col>
                          <Col flex="auto">
                            <Space direction="vertical" size="small" style={{ width: '100%' }}>
                              <Space>
                                <Typography.Text strong style={{ fontSize: '16px' }}>
                                  {data.contestant.name}
                                </Typography.Text>
                                <Tag
                                  color={
                                    data.contestant.track === 'VOCAL'
                                      ? 'blue'
                                      : data.contestant.track === 'RAP'
                                        ? 'orange'
                                        : 'green'
                                  }
                                >
                                  {data.contestant.track}
                                </Tag>
                                <Tag
                                  color={
                                    data.grade === 'A' || data.grade === 'B'
                                      ? 'green'
                                      : data.grade === 'C'
                                        ? 'blue'
                                        : data.grade === 'D'
                                          ? 'orange'
                                          : 'red'
                                  }
                                >
                                  Grade {data.grade}
                                </Tag>
                                <Tag color="default">{tierNames[data.tier]}</Tag>
                                {data.songId && (
                                  <Tag color="purple">🎵 {songMap[data.songId] || 'Unknown Song'}</Tag>
                                )}
                              </Space>
                              <Typography.Paragraph style={{ marginBottom: 0, fontStyle: 'italic' }}>
                                {data.summary}
                              </Typography.Paragraph>
                              <Space size="large">
                                <Typography.Text type="secondary">
                                  Screen Time: {data.contestant.aggregations.screenTime.toFixed(1)}m
                                </Typography.Text>
                                <Typography.Text type="secondary">
                                  Score: {data.contestant.aggregations.score}
                                </Typography.Text>
                                <Typography.Text type="secondary">
                                  Rating: {'⭐'.repeat(data.missionRating)}
                                </Typography.Text>
                              </Space>
                            </Space>
                          </Col>
                        </Row>
                      </Card>
                    ))}
                  </Space>
                </Card>

                {commercialBreak && (
                  <Alert
                    key={`break-${segmentNum}`}
                    message={commercialBreak}
                    showIcon
                    style={{ marginBottom: '1rem' }}
                    type="info"
                  />
                )}
              </div>
            );
          })}

          {episodeEnding && (
            <Card
              size="small"
              style={{ marginTop: '1rem', backgroundColor: '#f6ffed', borderColor: '#52c41a' }}
            >
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Alert description={episodeEnding.message} message="Episode Ending" showIcon type="success" />

                {episodeEnding.top5 && episodeEnding.top5.length > 0 && (
                  <div>
                    <Typography.Title level={5}>
                      🏆 If the show ended now, these would be the chosen ones:
                    </Typography.Title>
                    <Row gutter={[8, 8]}>
                      {episodeEnding.top5.map((contestant) => (
                        <Col key={contestant.id} span={24}>
                          <Space>
                            <ContestantAvatar
                              enablePreview={false}
                              id={contestant.id}
                              name={contestant.name}
                              size={40}
                            />
                            <Typography.Text strong>
                              #{contestant.rank} {contestant.name}
                            </Typography.Text>
                          </Space>
                        </Col>
                      ))}
                    </Row>
                  </div>
                )}

                {episodeEnding.eliminated && episodeEnding.eliminated.length > 0 && (
                  <div>
                    <Typography.Title level={5}>
                      💔 Eliminated Contestants ({episodeEnding.eliminated.length}):
                    </Typography.Title>
                    <Row gutter={[8, 8]}>
                      {episodeEnding.eliminated.map((contestant) => (
                        <Col key={contestant.id} lg={8} md={12} sm={12} xs={24}>
                          <Space>
                            <ContestantAvatar
                              enablePreview={false}
                              id={contestant.id}
                              name={contestant.name}
                              size={32}
                            />
                            <Typography.Text type="secondary">
                              #{contestant.rank} {contestant.name}
                            </Typography.Text>
                          </Space>
                        </Col>
                      ))}
                    </Row>
                  </div>
                )}
              </Space>
            </Card>
          )}
        </Space>
      </Card>

      <ContestantDetailModal
        allContestants={contestants}
        contestant={selectedContestant}
        onClose={() => setSelectedContestant(null)}
      />
    </div>
  );
}
