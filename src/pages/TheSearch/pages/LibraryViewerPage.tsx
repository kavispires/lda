import {
  ArrowLeftOutlined,
  CopyOutlined,
  DownloadOutlined,
  FilterOutlined,
  SortAscendingOutlined,
  TableOutlined,
} from '@ant-design/icons';
import {
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Flex,
  Input,
  Modal,
  message,
  Row,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd';
import { Content } from 'components/Content';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
// Import JSON data
import identityCardsData from '../data/identity-cards.json';
import interestCardsData from '../data/interest-cards.json';
import personaCardsData from '../data/persona-cards.json';
import secretCardsData from '../data/secret-cards.json';
import type { AttributeCard } from '../types/common';

type LibraryType = 'identity' | 'persona' | 'interest' | 'secrets';

type LibraryConfig = {
  title: string;
  description: string;
  data: AttributeCard[];
};

const libraryConfigs: Record<LibraryType, LibraryConfig> = {
  identity: {
    title: 'Identity Cards',
    description: 'Personality archetypes and character traits that define contestant behavior',
    data: Object.values(identityCardsData) as unknown as AttributeCard[],
  },
  persona: {
    title: 'Persona Cards',
    description: 'Public-facing personas and audience-targeted character concepts',
    data: Object.values(personaCardsData) as unknown as AttributeCard[],
  },
  interest: {
    title: 'Interest Cards',
    description: 'Hobbies, passions, and background interests that add depth to contestant personalities',
    data: Object.values(interestCardsData) as unknown as AttributeCard[],
  },
  secrets: {
    title: 'Secret Cards',
    description:
      "Hidden backstories, scandals, and personal struggles that can dramatically impact a contestant's journey",
    data: Object.values(secretCardsData) as unknown as AttributeCard[],
  },
};

export function LibraryViewerPage() {
  const navigate = useNavigate();
  const { type } = useParams<{ type: LibraryType }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');
  const [selectedCard, setSelectedCard] = useState<AttributeCard | null>(null);

  const config = type ? libraryConfigs[type] : null;

  // Reset filters when library type changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: We only want to reset when the type changes, not when other dependencies change
  useEffect(() => {
    setSearchQuery('');
    setSelectedGroup('all');
    setSortBy('name');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // Get unique groups from the data
  const groups = useMemo(() => {
    if (!config) return [];
    const uniqueGroups = new Set(config.data.map((card) => card.group));
    return Array.from(uniqueGroups).sort();
  }, [config]);

  // Filter and sort cards
  const filteredAndSortedCards = useMemo(() => {
    if (!config) return [];

    let result = [...config.data];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (card) =>
          card.name.toLowerCase().includes(query) ||
          card.id.toLowerCase().includes(query) ||
          card.description.toLowerCase().includes(query) ||
          card.group.toLowerCase().includes(query),
      );
    }

    // Apply group filter
    if (selectedGroup !== 'all') {
      result = result.filter((card) => card.group === selectedGroup);
    }

    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'id':
          return a.id.localeCompare(b.id);
        case 'occurrence':
          return (b.occurrence || 0) - (a.occurrence || 0);
        case 'group':
          return a.group.localeCompare(b.group);
        default:
          return 0;
      }
    });

    return result;
  }, [config, searchQuery, selectedGroup, sortBy]);

  const handleCopy = () => {
    const dataObject = filteredAndSortedCards.reduce(
      (acc, card) => {
        acc[card.id] = card;
        return acc;
      },
      {} as Record<string, AttributeCard>,
    );

    const jsonString = JSON.stringify(dataObject, null, 2);
    navigator.clipboard
      .writeText(jsonString)
      .then(() => {
        message.success(`Copied ${filteredAndSortedCards.length} cards to clipboard`);
      })
      .catch(() => {
        message.error('Failed to copy to clipboard');
      });
  };

  const handleDownload = () => {
    const dataObject = filteredAndSortedCards.reduce(
      (acc, card) => {
        acc[card.id] = card;
        return acc;
      },
      {} as Record<string, AttributeCard>,
    );

    const jsonString = JSON.stringify(dataObject, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-cards-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    message.success(`Downloaded ${filteredAndSortedCards.length} cards`);
  };

  if (!type || !config) {
    return (
      <Content>
        <Typography.Title level={2}>Library Not Found</Typography.Title>
        <Typography.Paragraph>The requested library could not be found.</Typography.Paragraph>
        <Button onClick={() => navigate('/the-search/libraries')} type="primary">
          Back to Libraries
        </Button>
      </Content>
    );
  }

  const renderCardModal = () => {
    if (!selectedCard) return null;

    return (
      <Modal
        footer={null}
        onCancel={() => setSelectedCard(null)}
        open={!!selectedCard}
        title={selectedCard.name}
        width={800}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Typography.Title level={5}>Details</Typography.Title>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="ID">{selectedCard.id}</Descriptions.Item>
              <Descriptions.Item label="Type">{selectedCard.type}</Descriptions.Item>
              <Descriptions.Item label="Group">
                <Tag color="blue">{selectedCard.group}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Description">{selectedCard.description}</Descriptions.Item>
              <Descriptions.Item label="Occurrence">{selectedCard.occurrence || 0}</Descriptions.Item>
            </Descriptions>
          </div>

          {selectedCard.set && Object.keys(selectedCard.set).length > 0 && (
            <div>
              <Typography.Title level={5}>Base Values (Set)</Typography.Title>
              <Card size="small">
                {Object.entries(selectedCard.set).map(([key, value]) => (
                  <div key={key} style={{ marginBottom: '8px' }}>
                    <Typography.Text code>{key}</Typography.Text>
                    <Typography.Text strong style={{ marginLeft: '8px' }}>
                      = {value}
                    </Typography.Text>
                  </div>
                ))}
              </Card>
            </div>
          )}

          {selectedCard.influences && Object.keys(selectedCard.influences).length > 0 && (
            <div>
              <Typography.Title level={5}>Influences</Typography.Title>
              <Card size="small">
                {Object.entries(selectedCard.influences).map(([key, value]) => {
                  const numValue = typeof value === 'number' ? value : 0;
                  const isPositive = numValue > 0;
                  return (
                    <div key={key} style={{ marginBottom: '8px' }}>
                      <Typography.Text code>{key}</Typography.Text>
                      <Tag
                        color={isPositive ? 'green' : numValue < 0 ? 'red' : 'default'}
                        style={{ marginLeft: '8px' }}
                      >
                        {isPositive ? '+' : ''}
                        {value}
                      </Tag>
                    </div>
                  );
                })}
              </Card>
            </div>
          )}

          {selectedCard.consequence && Object.keys(selectedCard.consequence).length > 0 && (
            <div>
              <Typography.Title level={5}>Consequences</Typography.Title>
              <Card size="small">
                {Object.entries(selectedCard.consequence).map(([key, value]) => {
                  const numValue = typeof value === 'number' ? value : 0;
                  const isPositive = numValue > 0;
                  return (
                    <div key={key} style={{ marginBottom: '8px' }}>
                      <Typography.Text code>{key}</Typography.Text>
                      <Tag
                        color={isPositive ? 'green' : numValue < 0 ? 'red' : 'default'}
                        style={{ marginLeft: '8px' }}
                      >
                        {isPositive ? '+' : ''}
                        {value}
                      </Tag>
                    </div>
                  );
                })}
              </Card>
            </div>
          )}
        </Space>
      </Modal>
    );
  };

  return (
    <Content>
      <Flex align="center" gap="middle" style={{ marginBottom: '1rem' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/the-search/libraries')}>
          Back
        </Button>
        <div style={{ flex: 1 }}>
          <Typography.Title level={2} style={{ margin: 0 }}>
            {config.title}
          </Typography.Title>
          <Typography.Text type="secondary">{config.description}</Typography.Text>
        </div>
        <Button icon={<CopyOutlined />} onClick={handleCopy}>
          Copy
        </Button>
        <Button icon={<DownloadOutlined />} onClick={handleDownload}>
          Download
        </Button>
      </Flex>

      {/* Filters and Search */}
      <Card style={{ marginBottom: '1rem' }}>
        <Flex gap="middle" wrap="wrap">
          <Input.Search
            allowClear
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, ID, description, or group..."
            style={{ flex: 1, minWidth: '300px' }}
            value={searchQuery}
          />

          <Select
            onChange={setSelectedGroup}
            placeholder="Filter by group"
            prefix={<FilterOutlined />}
            style={{ width: '200px' }}
            value={selectedGroup}
          >
            <Select.Option value="all">All Groups</Select.Option>
            {groups.map((group) => (
              <Select.Option key={group} value={group}>
                {group}
              </Select.Option>
            ))}
          </Select>

          <Select
            onChange={setSortBy}
            placeholder="Sort by"
            prefix={<SortAscendingOutlined />}
            style={{ width: '200px' }}
            value={sortBy}
          >
            <Select.Option value="name">Name (A-Z)</Select.Option>
            <Select.Option value="id">ID (A-Z)</Select.Option>
            <Select.Option value="occurrence">Occurrence (High to Low)</Select.Option>
            <Select.Option value="group">Group (A-Z)</Select.Option>
          </Select>

          <Badge count={filteredAndSortedCards.length} showZero>
            <Button icon={<TableOutlined />}>Results</Button>
          </Badge>
        </Flex>
      </Card>

      {/* Card Grid */}
      {filteredAndSortedCards.length === 0 ? (
        <Empty
          description={
            searchQuery || selectedGroup !== 'all'
              ? 'No cards match your filters'
              : 'No cards available in this library'
          }
        />
      ) : (
        <Row gutter={[16, 16]}>
          {filteredAndSortedCards.map((card) => {
            const influenceCount = card.influences ? Object.keys(card.influences).length : 0;
            const consequenceCount = card.consequence ? Object.keys(card.consequence).length : 0;
            const hasSet = card.set && Object.keys(card.set).length > 0;

            return (
              <Col key={card.id} lg={8} md={12} xs={24}>
                <Card
                  hoverable
                  onClick={() => setSelectedCard(card)}
                  size="small"
                  style={{ height: '100%' }}
                  title={
                    <Space>
                      <Typography.Text strong>{card.name}</Typography.Text>
                      {card.occurrence > 1 && <Tag color="blue">×{card.occurrence}</Tag>}
                    </Space>
                  }
                >
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <div>
                      <Typography.Text code style={{ fontSize: '11px' }}>
                        {card.id}
                      </Typography.Text>
                    </div>
                    <Tag>{card.group}</Tag>
                    <Typography.Paragraph ellipsis={{ rows: 3 }} style={{ margin: 0 }} type="secondary">
                      {card.description}
                    </Typography.Paragraph>
                    <Flex gap="small" wrap="wrap">
                      {hasSet && <Tag color="purple">Set Values</Tag>}
                      {influenceCount > 0 && <Tag color="green">{influenceCount} Influences</Tag>}
                      {consequenceCount > 0 && <Tag color="orange">{consequenceCount} Consequences</Tag>}
                    </Flex>
                  </Space>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {renderCardModal()}
    </Content>
  );
}
