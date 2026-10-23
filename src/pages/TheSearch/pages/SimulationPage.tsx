import { AppstoreOutlined, RocketOutlined, TableOutlined } from '@ant-design/icons';
import { Content } from '@components/Content';
import { useSelector } from '@tanstack/react-store';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Descriptions,
  Progress,
  Row,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useState } from 'react';
import type { ValuesOf } from 'types/common';
import { ContestantAvatar } from '../components/ContestantAvatar';
import { ContestantDetailModal } from '../components/ContestantDetailModal';
import { TrackTag } from '../components/TrackTag';
import secretCardsData from '../data/secret-cards.json';
import { useContestantsContext } from '../services/ContestantsProvider';
import { simulationActions, simulationStore } from '../services/SimulationStore';
import type { Contestant } from '../types/contestant';
import { processSimulationContestants } from '../utilities/card-assignment';
import type { TRACKS } from '../utilities/constants';
import { selectDiverseContestants } from '../utilities/simulation-helpers';

export function SimulationPage() {
  const { contestants: contestantsData } = useContestantsContext();
  const simulationState = useSelector(simulationStore, (state) => state);
  const [isInitializing, setIsInitializing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [useBias, setUseBias] = useState(false);

  const handleStartSimulation = async () => {
    setIsInitializing(true);
    setError(null);
    setProgress(0);

    try {
      setProgressText('Selecting 50 diverse contestants...');
      setProgress(20);
      await new Promise((resolve) => setTimeout(resolve, 300));

      const selectedIds = selectDiverseContestants(contestantsData, useBias);

      setProgressText('Assigning attribute cards and calculating influences...');
      setProgress(40);
      await new Promise((resolve) => setTimeout(resolve, 300));

      const processedContestants = processSimulationContestants(selectedIds, contestantsData);

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

  const hasSimulation = simulationState.contestants.length > 0;

  return (
    <Content>
      <Typography.Title level={1}>
        <RocketOutlined /> Simulation
      </Typography.Title>
      <Typography.Paragraph style={{ fontSize: '16px' }}>
        Initialize a new survival show simulation with 50 diverse contestants. The system will automatically
        assign personas, attributes, and calculate initial statistics.
      </Typography.Paragraph>
      <Alert
        description="You can initialize and inspect your cast. Episode simulation is being rebuilt."
        showIcon
        style={{ marginBottom: '1rem' }}
        title="Simulation Setup"
        type="info"
      />

      {error && (
        <Alert
          closable={{ onClose: () => setError(null) }}
          description={error}
          showIcon
          style={{ marginBottom: '1rem' }}
          title="Initialization Error"
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
            <Checkbox
              checked={useBias}
              onChange={(e) => setUseBias(e.target.checked)}
              style={{ marginBottom: '1rem', display: 'block' }}
            >
              Force-include bias contestants (contestants with bias=true will always be selected)
            </Checkbox>

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

      {hasSimulation && !isInitializing && (
        <>
          <Button danger onClick={handleClearSimulation} style={{ marginTop: '2rem' }}>
            Clear Simulation
          </Button>
          <SimulationOverview contestants={simulationState.contestants} />
        </>
      )}
    </Content>
  );
}

function SimulationOverview({ contestants }: { contestants: Contestant[] }) {
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

  const secretCount = contestants.filter((c) =>
    c.attributes.some((id) => Object.hasOwn(secretCardsData, id)),
  ).length;

  const columns = [
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
      render: (track: ValuesOf<typeof TRACKS>) => <TrackTag track={track} />,
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
      title: 'Persona',
      dataIndex: 'persona',
      key: 'persona',
      width: 200,
      render: (persona: string) => persona || '—',
      sorter: (a: Contestant, b: Contestant) => (a.persona || '').localeCompare(b.persona || ''),
    },
  ];

  return (
    <div style={{ marginTop: '2rem' }}>
      <Card>
        <Space align="start" orientation="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Typography.Title level={2}>Simulation Ready</Typography.Title>
            <Typography.Paragraph>
              Successfully initialized simulation with {contestants.length} contestants.
            </Typography.Paragraph>
          </div>

          <Descriptions bordered column={2}>
            <Descriptions.Item label="Total Contestants">{contestants.length}</Descriptions.Item>
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
                      <TrackTag track={contestant.track} />
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
