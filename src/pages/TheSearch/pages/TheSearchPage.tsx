import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Popconfirm, Space, Table, Tag, Typography } from 'antd';
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
      render: (track: string) => {
        const colors = { VOCAL: 'blue', RAP: 'purple', DANCE: 'green' };
        return <Tag color={colors[track as keyof typeof colors] || 'default'}>{track}</Tag>;
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
