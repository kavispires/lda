import { DeleteOutlined, EditOutlined, PlusOutlined, WarningOutlined } from '@ant-design/icons';
import { Button, Popconfirm, Space, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnType } from 'antd/es/table';
import { Content, ContentLoading } from 'components/Content';
import { useNavigate } from 'react-router-dom';
import { ContestantAvatar } from '../components/ContestantAvatar';
import { useContestantsQuery, useDeleteContestantMutation } from '../hooks/useContestants';
import type { Contestant } from '../types/contestant';

export function TheSearchPage() {
  const navigate = useNavigate();
  const { data: contestantsData, isLoading } = useContestantsQuery();
  const { mutate: deleteContestant } = useDeleteContestantMutation();

  if (isLoading) {
    return <ContentLoading />;
  }

  const contestants = contestantsData ? Object.values(contestantsData) : [];
  const sortedContestants = [...contestants].sort((a, b) => a.id.localeCompare(b.id));

  const calculateScore = (contestant: Contestant): number => {
    // Sum all core skills
    const coreSkillsTotal =
      (contestant.coreSkills?.vocals || 0) +
      (contestant.coreSkills?.rap || 0) +
      (contestant.coreSkills?.dance || 0) +
      (contestant.coreSkills?.stagePresence || 0) +
      (contestant.coreSkills?.visual || 0) +
      (contestant.coreSkills?.uniqueness || 0) +
      (contestant.coreSkills?.leadership || 0);

    // Sum all utility skills
    const utilitySkillsTotal =
      (contestant.utilitySkills?.potential || 0) +
      (contestant.utilitySkills?.memory || 0) +
      (contestant.utilitySkills?.stamina || 0) +
      (contestant.utilitySkills?.learning || 0) +
      (contestant.utilitySkills?.acrobatics || 0) +
      (contestant.utilitySkills?.consistency || 0) +
      (contestant.utilitySkills?.charisma || 0);

    // Calculate average
    return (coreSkillsTotal * 5 + utilitySkillsTotal * 2) / (7 * 5 + 7 * 2);
  };

  const checkIncomplete = (contestant: Contestant): string[] => {
    const missing: string[] = [];

    // Check basic fields
    if (!contestant.name) missing.push('Name');
    if (!contestant.track) missing.push('Track');
    if (!contestant.color) missing.push('Color');
    // if (!contestant.persona) missing.push('Persona');

    // Check appearance
    if (!contestant.appearance?.age) missing.push('Age');
    if (!contestant.appearance?.hairStyle) missing.push('Hair Style');
    if (!contestant.appearance?.hairColor) missing.push('Hair Color');
    if (!contestant.appearance?.furColor) missing.push('Fur Color');

    // Check specialties
    if (!contestant.specialties?.vocalColor) missing.push('Vocal Color');
    if (!contestant.specialties?.danceStyle) missing.push('Dance Style');
    if (!contestant.specialties?.rapStyle) missing.push('Rap Style');
    if (!contestant.specialties?.visualVibe) missing.push('Visual Vibe');
    if (!contestant.specialties?.leadershipStyle) missing.push('Leadership Style');

    return missing;
  };

  const columns: ColumnType<Contestant>[] = [
    {
      title: 'Avatar',
      dataIndex: 'id',
      key: 'avatar',
      width: 80,
      render: (id: string, record: Contestant) => <ContestantAvatar id={id} name={record.name} size={48} />,
    },
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      sorter: (a, b) => a.id.localeCompare(b.id),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Track',
      dataIndex: 'track',
      key: 'track',
      render: (track: string, record: Contestant) => {
        const colors = { VOCAL: 'red', RAP: 'blue', DANCE: 'green' };
        return (
          <Space align="center" size="small">
            <Tooltip title={record.color}>
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  backgroundColor: record.color || '#FFFFFF',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                }}
              />
            </Tooltip>
            <Tag color={colors[track as keyof typeof colors] || 'default'}>{track}</Tag>
          </Space>
        );
      },
      filters: [
        { text: 'Vocal', value: 'VOCAL' },
        { text: 'Rap', value: 'RAP' },
        { text: 'Dance', value: 'DANCE' },
      ],
      onFilter: (value, record) => record.track === value,
    },
    {
      title: 'Hair Style',
      dataIndex: ['appearance', 'hairStyle'],
      key: 'hairStyle',
      render: (hairStyle?: string) => hairStyle || '-',
      sorter: (a, b) => (a.appearance?.hairStyle || '').localeCompare(b.appearance?.hairStyle || ''),
    },
    {
      title: 'Hair Color',
      dataIndex: ['appearance', 'hairColor'],
      key: 'hairColor',
      render: (hairColor?: string) => hairColor || '-',
      sorter: (a, b) => (a.appearance?.hairColor || '').localeCompare(b.appearance?.hairColor || ''),
    },
    {
      title: 'Fur Color',
      dataIndex: ['appearance', 'furColor'],
      key: 'furColor',
      render: (furColor?: string) => furColor || '-',
      sorter: (a, b) => (a.appearance?.furColor || '').localeCompare(b.appearance?.furColor || ''),
    },
    {
      title: 'Score',
      key: 'score',
      width: 80,
      sorter: (a, b) => calculateScore(a) - calculateScore(b),
      render: (_value: unknown, record: Contestant) => {
        const score = calculateScore(record);
        return score.toFixed(2);
      },
    },
    {
      title: 'Updated',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      sorter: (a, b) => (a.updatedAt || 0) - (b.updatedAt || 0),
      defaultSortOrder: 'descend',
      render: (timestamp: number) => {
        if (!timestamp) return '-';
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      },
    },
    {
      title: <WarningOutlined />,
      key: 'incomplete',
      width: 60,
      align: 'center',
      render: (_value: unknown, record: Contestant) => {
        const missing = checkIncomplete(record);
        if (missing.length === 0) return null;

        return (
          <Tooltip title={`Missing: ${missing.join(', ')}`}>
            <WarningOutlined style={{ color: '#faad14', fontSize: '16px' }} />
          </Tooltip>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_value: unknown, record: Contestant) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => navigate(`/the-search/edit?id=${record.id}`)}
            size="small"
            type="link"
          >
            Edit
          </Button>
          <Popconfirm
            cancelText="No"
            okText="Yes"
            onConfirm={() => deleteContestant(record.id)}
            title="Delete this contestant?"
          >
            <Button danger icon={<DeleteOutlined />} size="small" type="link">
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Content>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
        }}
      >
        <Typography.Title level={2}>The Search - Contestants</Typography.Title>
        <Button
          icon={<PlusOutlined />}
          onClick={() => navigate('/the-search/new')}
          size="large"
          type="primary"
        >
          Create New Contestant
        </Button>
      </div>

      <Typography.Paragraph>
        Manage contestants for The Search survival show simulation. Total contestants: {contestants.length}
      </Typography.Paragraph>

      <Table
        columns={columns}
        dataSource={sortedContestants}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} contestants`,
        }}
        rowKey="id"
      />
    </Content>
  );
}
