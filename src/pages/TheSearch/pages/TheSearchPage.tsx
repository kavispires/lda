import { DeleteOutlined, EditOutlined, PlusOutlined, SaveOutlined, WarningOutlined } from '@ant-design/icons';
import { Button, Input, Popconfirm, Space, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnType } from 'antd/es/table';
import { Content } from 'components/Content';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ContestantAvatar } from '../components/ContestantAvatar';
import { useContestantsContext } from '../services/ContestantsProvider';
import type { Contestant } from '../types/contestant';

export function TheSearchPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const {
    contestants: contestantsData,
    deleteLocalContestant,
    hasDirtyChanges,
    dirtyCount,
    saveAll,
    isSaving,
    discardChanges,
  } = useContestantsContext();

  const contestants = contestantsData ? Object.values(contestantsData) : [];
  const sortedContestants = [...contestants].sort((a, b) => a.id.localeCompare(b.id));

  // Filter contestants based on search query
  const filteredContestants = sortedContestants.filter((contestant) => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();

    // Search in id, name, persona
    if (
      contestant.id.toLowerCase().includes(query) ||
      contestant.name.toLowerCase().includes(query) ||
      contestant.persona?.toLowerCase().includes(query)
    ) {
      return true;
    }

    // Search in personality values
    if (contestant.personality) {
      const personalityValues = [
        contestant.personality.discipline?.toString(),
        contestant.personality.curiosity?.toString(),
        contestant.personality.extroversion?.toString(),
        contestant.personality.sensitivity?.toString(),
        contestant.personality.gentleness?.toString(),
        contestant.personality.sincerity?.toString(),
        contestant.personality.ambition?.toString(),
        contestant.personality.resilience?.toString(),
        contestant.personality.maturity?.toString(),
        contestant.personality.investment?.toString(),
      ];

      if (personalityValues.some((value) => value?.toLowerCase().includes(query))) {
        return true;
      }
    }

    return false;
  });

  const calculateScore = (contestant: Contestant): number => {
    // Sum all core skills
    const trackSKills =
      (contestant.coreSkills?.vocals || 0) +
      (contestant.coreSkills?.rap || 0) +
      (contestant.coreSkills?.dance || 0);
    const stagePresenceSkill = contestant.coreSkills?.stagePresence || 0;
    const appearanceSkills =
      (contestant.coreSkills?.visual || 0) +
      (contestant.coreSkills?.uniqueness || 0) +
      (contestant.utilitySkills?.charisma || 0);

    const leadershipSkill = contestant.coreSkills?.leadership || 0;

    // Sum all utility skills
    const utilitySkillsTotal =
      (contestant.utilitySkills?.potential || 0) +
      (contestant.utilitySkills?.memory || 0) +
      (contestant.utilitySkills?.stamina || 0) +
      (contestant.utilitySkills?.learning || 0) +
      (contestant.utilitySkills?.acrobatics || 0) +
      (contestant.utilitySkills?.consistency || 0);

    // Calculate average
    return (
      (trackSKills * 4 +
        stagePresenceSkill * 5 +
        appearanceSkills * 2 +
        leadershipSkill * 1 +
        utilitySkillsTotal * 1) /
      (12 + 5 + 6 + 1 + 6)
    ); // Total weight is 30
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
      sorter: (a, b) => Number(a.id.split('-')[1]) - Number(b.id.split('-')[1]),
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
            <Tag>{track}</Tag>
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
            onConfirm={() => deleteLocalContestant(record.id)}
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
        <Space>
          {hasDirtyChanges && (
            <>
              <Popconfirm
                cancelText="No"
                okText="Yes, Discard"
                onConfirm={discardChanges}
                title="Discard all unsaved changes?"
              >
                <Button size="large">
                  Discard {dirtyCount} Change{dirtyCount > 1 ? 's' : ''}
                </Button>
              </Popconfirm>
              <Button
                danger
                icon={<SaveOutlined />}
                loading={isSaving}
                onClick={() => saveAll()}
                size="large"
                type="primary"
              >
                Save {dirtyCount} Change{dirtyCount > 1 ? 's' : ''}
              </Button>
            </>
          )}
          <Button
            disabled
            icon={<PlusOutlined />}
            onClick={() => navigate('/the-search/new')}
            size="large"
            type={hasDirtyChanges ? 'default' : 'primary'}
          >
            Create New Contestant
          </Button>
        </Space>
      </div>

      <Typography.Paragraph>
        Manage contestants for The Search survival show simulation. Total contestants: {contestants.length}
      </Typography.Paragraph>

      <Input.Search
        allowClear
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search by ID, name, persona, or personality values..."
        size="large"
        style={{ marginBottom: '1rem' }}
        value={searchQuery}
      />

      <Table
        columns={columns}
        dataSource={filteredContestants}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total, range) =>
            `${range[0]}-${range[1]} of ${total} contestants${searchQuery ? ' (filtered)' : ''}`,
        }}
        rowKey="id"
      />
    </Content>
  );
}
