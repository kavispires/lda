import { ArrowDownOutlined, ArrowUpOutlined, MinusOutlined } from '@ant-design/icons';
import {
  Button,
  Col,
  Descriptions,
  Modal,
  Rate,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { useState } from 'react';
import type { Dictionary } from 'types/common';
import identityCardsData from '../data/identity-cards.json';
import interestCardsData from '../data/interest-cards.json';
import personaCardsData from '../data/persona-cards.json';
import secretCardsData from '../data/secret-cards.json';
import type { AttributeCard } from '../types/common';
import type { Contestant } from '../types/contestant';
import {
  DANCE_STYLES,
  LEADERSHIP_STYLES,
  RAP_STYLES,
  VISUAL_VIBES,
  VOCAL_COLORS,
} from '../utilities/attribute-libraries';
import { ContestantAvatar } from './ContestantAvatar';

const PERSONA_CARDS = personaCardsData as Dictionary<AttributeCard>;
const IDENTITY_CARDS = identityCardsData as Dictionary<AttributeCard>;
const INTEREST_CARDS = interestCardsData as Dictionary<AttributeCard>;
const SECRET_CARDS = secretCardsData as Dictionary<AttributeCard>;

const ALL_CARDS = {
  ...PERSONA_CARDS,
  ...IDENTITY_CARDS,
  ...INTEREST_CARDS,
  ...SECRET_CARDS,
};

const ALL_SPECIALTIES = {
  ...VOCAL_COLORS,
  ...DANCE_STYLES,
  ...RAP_STYLES,
  ...VISUAL_VIBES,
  ...LEADERSHIP_STYLES,
};

const PERSONALITY_DESCRIPTIONS: Record<string, string> = {
  discipline: '10: Workaholic/Organized | -10: Reckless/Lazy. Affects growth speed.',
  curiosity: '10: Creative/Experimental | -10: Prosaic/Safe. Affects concept fit.',
  extroversion: '10: Assertive/Sociable | -10: Reserved/Shy. Affects screen time.',
  sensitivity: '10: Empathetic/Anxious | -10: Thick-skinned/Calm. Affects relationship impact.',
  gentleness: '10: Cooperative/Peacekeeper | -10: Antagonistic/Stubborn. Affects synergy.',
  sincerity: '10: Authentic/Modest | -10: Calculative/Pretentious. Affects fandom loyalty.',
  ambition: '10: Ruthless/Competitive | -10: Passive/Participatory. Triggers role conflicts.',
  resilience: '10: Stoic/Unshakable | -10: Fragile/Reactive. Affects mentalCondition decay.',
  maturity: '10: Professional/Composed | -10: Childish/Impulsive. Affects drama triggers.',
  investment:
    '10: Devoted/Committed | -10: Opportunistic/Detached. Affects likelihood of quitting or burnout events.',
};

interface ContestantDetailModalProps {
  contestant: Contestant | null;
  allContestants: Contestant[];
  onClose: () => void;
}

export function ContestantDetailModal({ contestant, allContestants, onClose }: ContestantDetailModalProps) {
  if (!contestant) return null;

  const tabItems = [
    {
      key: 'basic',
      label: 'Basic Info',
      children: <BasicInfoTab contestant={contestant} />,
    },
    {
      key: 'skills',
      label: 'Skills & Specialties',
      children: <SkillsTab contestant={contestant} />,
    },
    {
      key: 'personality',
      label: 'Personality & Attributes',
      children: <PersonalityTab contestant={contestant} />,
    },
    {
      key: 'relationships',
      label: 'Relationships',
      children: <RelationshipsTab allContestants={allContestants} contestant={contestant} />,
    },
    {
      key: 'changelog',
      label: 'Change Log',
      children: <ChangeLogTab contestant={contestant} />,
    },
  ];

  return (
    <Modal
      footer={[
        <Button key="close" onClick={onClose} type="primary">
          Close
        </Button>,
      ]}
      onCancel={onClose}
      open={!!contestant}
      title={
        <Space>
          <ContestantAvatar enablePreview={false} id={contestant.id} name={contestant.name} size={48} />
          <div>
            <Typography.Text strong>{contestant.name}</Typography.Text>
            <br />
            <Typography.Text style={{ fontSize: '12px' }} type="secondary">
              {contestant.id}
            </Typography.Text>
          </div>
        </Space>
      }
      width={900}
    >
      <Tabs items={tabItems} />
    </Modal>
  );
}

// Tab 1: Basic Information and Statistics
function BasicInfoTab({ contestant }: { contestant: Contestant }) {
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Basic Info */}
      <div>
        <Typography.Title level={5}>Basic Information</Typography.Title>
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="Track">
            <Tag
              color={contestant.track === 'VOCAL' ? 'blue' : contestant.track === 'RAP' ? 'orange' : 'green'}
            >
              {contestant.track}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Grade">{contestant.grade}</Descriptions.Item>
          <Descriptions.Item label="Status">{contestant.status}</Descriptions.Item>
          <Descriptions.Item label="Rank">{contestant.rank || 'N/A'}</Descriptions.Item>
          <Descriptions.Item label="Alignment">{contestant.alignment}</Descriptions.Item>
          <Descriptions.Item label="Zodiac Sign">{contestant.zodiacSign}</Descriptions.Item>
        </Descriptions>
      </div>

      {/* Statistics */}
      <div>
        <Typography.Title level={5}>Statistics</Typography.Title>
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="Score">{contestant.aggregations.score}</Descriptions.Item>
          <Descriptions.Item label="Experience">{contestant.aggregations.experience}</Descriptions.Item>
          <Descriptions.Item label="Screen Time">{contestant.aggregations.screenTime}</Descriptions.Item>
          <Descriptions.Item label="Contestants Likeness">
            {contestant.aggregations.contestantsLikeness}
          </Descriptions.Item>
          <Descriptions.Item label="Audience Ratio">
            {(contestant.aggregations.audienceRatio * 100).toFixed(1)}%
          </Descriptions.Item>
          <Descriptions.Item label="Production Ratio">
            {(contestant.aggregations.productionRatio * 100).toFixed(1)}%
          </Descriptions.Item>
          <Descriptions.Item label="Fanbase Ratio">
            {(contestant.aggregations.fanbaseRatio * 100).toFixed(1)}%
          </Descriptions.Item>
          <Descriptions.Item label="Center Count">{contestant.aggregations.center}</Descriptions.Item>
          <Descriptions.Item label="Leader Count">{contestant.aggregations.leader}</Descriptions.Item>
          <Descriptions.Item label="MVP Count">{contestant.aggregations.mvp}</Descriptions.Item>
        </Descriptions>
      </div>
    </Space>
  );
}

// Tab 2: Core Skills, Utility Skills, Specialties
function SkillsTab({ contestant }: { contestant: Contestant }) {
  const getSpecialtyTooltip = (specialtyId: string | undefined): string => {
    if (!specialtyId) return '';
    const specialty = ALL_SPECIALTIES[specialtyId];
    return specialty?.description || '';
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Core Skills and Utility Skills Side by Side */}
      <Row gutter={16}>
        {/* Core Skills */}
        <Col span={12}>
          <Typography.Title level={5}>Core Skills</Typography.Title>
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Vocals">
              <Rate allowHalf count={5} disabled value={contestant.coreSkills.vocals} />
              <span style={{ marginLeft: '8px' }}>{contestant.coreSkills.vocals}</span>
            </Descriptions.Item>
            <Descriptions.Item label="Rap">
              <Rate allowHalf count={5} disabled value={contestant.coreSkills.rap} />
              <span style={{ marginLeft: '8px' }}>{contestant.coreSkills.rap}</span>
            </Descriptions.Item>
            <Descriptions.Item label="Dance">
              <Rate allowHalf count={5} disabled value={contestant.coreSkills.dance} />
              <span style={{ marginLeft: '8px' }}>{contestant.coreSkills.dance}</span>
            </Descriptions.Item>
            <Descriptions.Item label="Stage Presence">
              <Rate allowHalf count={5} disabled value={contestant.coreSkills.stagePresence} />
              <span style={{ marginLeft: '8px' }}>{contestant.coreSkills.stagePresence}</span>
            </Descriptions.Item>
            <Descriptions.Item label="Visual">
              <Rate allowHalf count={5} disabled value={contestant.coreSkills.visual} />
              <span style={{ marginLeft: '8px' }}>{contestant.coreSkills.visual}</span>
            </Descriptions.Item>
            <Descriptions.Item label="Uniqueness">
              <Rate allowHalf count={5} disabled value={contestant.coreSkills.uniqueness} />
              <span style={{ marginLeft: '8px' }}>{contestant.coreSkills.uniqueness}</span>
            </Descriptions.Item>
            <Descriptions.Item label="Leadership">
              <Rate allowHalf count={5} disabled value={contestant.coreSkills.leadership} />
              <span style={{ marginLeft: '8px' }}>{contestant.coreSkills.leadership}</span>
            </Descriptions.Item>
          </Descriptions>
        </Col>

        {/* Utility Skills */}
        <Col span={12}>
          <Typography.Title level={5}>Utility Skills</Typography.Title>
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Potential">
              <Rate allowHalf count={5} disabled value={contestant.utilitySkills.potential} />
              <span style={{ marginLeft: '8px' }}>{contestant.utilitySkills.potential}</span>
            </Descriptions.Item>
            <Descriptions.Item label="Memory">
              <Rate allowHalf count={5} disabled value={contestant.utilitySkills.memory} />
              <span style={{ marginLeft: '8px' }}>{contestant.utilitySkills.memory}</span>
            </Descriptions.Item>
            <Descriptions.Item label="Stamina">
              <Rate allowHalf count={5} disabled value={contestant.utilitySkills.stamina} />
              <span style={{ marginLeft: '8px' }}>{contestant.utilitySkills.stamina}</span>
            </Descriptions.Item>
            <Descriptions.Item label="Learning">
              <Rate allowHalf count={5} disabled value={contestant.utilitySkills.learning} />
              <span style={{ marginLeft: '8px' }}>{contestant.utilitySkills.learning}</span>
            </Descriptions.Item>
            <Descriptions.Item label="Acrobatics">
              <Rate allowHalf count={5} disabled value={contestant.utilitySkills.acrobatics} />
              <span style={{ marginLeft: '8px' }}>{contestant.utilitySkills.acrobatics}</span>
            </Descriptions.Item>
            <Descriptions.Item label="Consistency">
              <Rate allowHalf count={5} disabled value={contestant.utilitySkills.consistency} />
              <span style={{ marginLeft: '8px' }}>{contestant.utilitySkills.consistency}</span>
            </Descriptions.Item>
            <Descriptions.Item label="Charisma">
              <Rate allowHalf count={5} disabled value={contestant.utilitySkills.charisma} />
              <span style={{ marginLeft: '8px' }}>{contestant.utilitySkills.charisma}</span>
            </Descriptions.Item>
          </Descriptions>
        </Col>
      </Row>

      {/* Specialties */}
      <div>
        <Typography.Title level={5}>Specialties</Typography.Title>
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="Vocal Color">
            {contestant.specialties.vocalColor ? (
              <Tooltip title={getSpecialtyTooltip(contestant.specialties.vocalColor)}>
                <span style={{ cursor: 'help', borderBottom: '1px dotted' }}>
                  {contestant.specialties.vocalColor}
                </span>
              </Tooltip>
            ) : (
              'N/A'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Dance Style">
            {contestant.specialties.danceStyle ? (
              <Tooltip title={getSpecialtyTooltip(contestant.specialties.danceStyle)}>
                <span style={{ cursor: 'help', borderBottom: '1px dotted' }}>
                  {contestant.specialties.danceStyle}
                </span>
              </Tooltip>
            ) : (
              'N/A'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Rap Style">
            {contestant.specialties.rapStyle ? (
              <Tooltip title={getSpecialtyTooltip(contestant.specialties.rapStyle)}>
                <span style={{ cursor: 'help', borderBottom: '1px dotted' }}>
                  {contestant.specialties.rapStyle}
                </span>
              </Tooltip>
            ) : (
              'N/A'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Visual Vibe">
            {contestant.specialties.visualVibe ? (
              <Tooltip title={getSpecialtyTooltip(contestant.specialties.visualVibe)}>
                <span style={{ cursor: 'help', borderBottom: '1px dotted' }}>
                  {contestant.specialties.visualVibe}
                </span>
              </Tooltip>
            ) : (
              'N/A'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Leadership Style" span={2}>
            {contestant.specialties.leadershipStyle ? (
              <Tooltip title={getSpecialtyTooltip(contestant.specialties.leadershipStyle)}>
                <span style={{ cursor: 'help', borderBottom: '1px dotted' }}>
                  {contestant.specialties.leadershipStyle}
                </span>
              </Tooltip>
            ) : (
              'N/A'
            )}
          </Descriptions.Item>
        </Descriptions>
      </div>
    </Space>
  );
}

// Tab 3: Appearance, Assigned Attributes, and Personality
function PersonalityTab({ contestant }: { contestant: Contestant }) {
  const getCardTooltip = (cardId: string): string => {
    const card = ALL_CARDS[cardId];
    if (!card) return '';
    return card.description || '';
  };

  const getPersonaDescription = (): string => {
    if (!contestant.persona) return '';
    const persona = PERSONA_CARDS[contestant.persona];
    return persona?.description || '';
  };

  const renderPersonalityTrait = (label: string, value: number, key: string) => {
    return (
      <Descriptions.Item label={label}>
        <Tooltip title={PERSONALITY_DESCRIPTIONS[key]}>
          <span style={{ cursor: 'help', borderBottom: '1px dotted' }}>{value}</span>
        </Tooltip>
      </Descriptions.Item>
    );
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Appearance */}
      <div>
        <Typography.Title level={5}>Appearance</Typography.Title>
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="Age">{contestant.appearance.age}</Descriptions.Item>
          <Descriptions.Item label="Height">{contestant.appearance.height || 'N/A'}</Descriptions.Item>
          <Descriptions.Item label="Build">{contestant.appearance.build || 'N/A'}</Descriptions.Item>
          <Descriptions.Item label="Hair Style">{contestant.appearance.hairStyle || 'N/A'}</Descriptions.Item>
          <Descriptions.Item label="Hair Color">{contestant.appearance.hairColor || 'N/A'}</Descriptions.Item>
          <Descriptions.Item label="Fur Color">{contestant.appearance.furColor || 'N/A'}</Descriptions.Item>
        </Descriptions>
      </div>

      {/* Assigned Attributes */}
      <div>
        <Typography.Title level={5}>Assigned Attributes</Typography.Title>
        {contestant.persona && (
          <div style={{ marginBottom: '1rem' }}>
            <Typography.Text strong>Persona: </Typography.Text>
            <Tooltip title={getPersonaDescription()}>
              <Tag color="magenta" style={{ cursor: 'help' }}>
                {contestant.persona}
              </Tag>
            </Tooltip>
          </div>
        )}
        <Space wrap>
          {contestant.attributes
            .filter((id) => id !== contestant.persona)
            .map((attrId) => (
              <Tooltip key={attrId} title={getCardTooltip(attrId)}>
                <Tag
                  color={
                    attrId.startsWith('IDENTITY_')
                      ? 'blue'
                      : attrId.startsWith('INTEREST_')
                        ? 'green'
                        : attrId.startsWith('SECRET_')
                          ? 'red'
                          : 'purple'
                  }
                  style={{ cursor: 'help' }}
                >
                  {attrId}
                </Tag>
              </Tooltip>
            ))}
          {contestant.attributes.length === 0 && (
            <Typography.Text type="secondary">No attributes assigned</Typography.Text>
          )}
        </Space>
      </div>

      {/* Personality */}
      <div>
        <Typography.Title level={5}>Personality</Typography.Title>
        <Descriptions bordered column={2} size="small">
          {renderPersonalityTrait('Discipline', contestant.personality.discipline, 'discipline')}
          {renderPersonalityTrait('Curiosity', contestant.personality.curiosity, 'curiosity')}
          {renderPersonalityTrait('Extroversion', contestant.personality.extroversion, 'extroversion')}
          {renderPersonalityTrait('Sensitivity', contestant.personality.sensitivity, 'sensitivity')}
          {renderPersonalityTrait('Gentleness', contestant.personality.gentleness, 'gentleness')}
          {renderPersonalityTrait('Sincerity', contestant.personality.sincerity, 'sincerity')}
          {renderPersonalityTrait('Ambition', contestant.personality.ambition, 'ambition')}
          {renderPersonalityTrait('Resilience', contestant.personality.resilience, 'resilience')}
          {renderPersonalityTrait('Maturity', contestant.personality.maturity, 'maturity')}
          {renderPersonalityTrait('Investment', contestant.personality.investment, 'investment')}
        </Descriptions>
      </div>
    </Space>
  );
}

// Tab 4: Relationships
function RelationshipsTab({
  contestant,
  allContestants,
}: {
  contestant: Contestant;
  allContestants: Contestant[];
}) {
  const [sortBy, setSortBy] = useState<'id' | 'name' | 'value'>('value');

  const contestantsMap = allContestants.reduce(
    (acc, c) => {
      acc[c.id] = c;
      return acc;
    },
    {} as Record<string, Contestant>,
  );

  const getRelationshipChange = (values: number[]): 'up' | 'down' | 'same' => {
    if (values.length < 2) return 'same';
    const current = values[values.length - 1];
    const previous = values[values.length - 2];
    if (current > previous) return 'up';
    if (current < previous) return 'down';
    return 'same';
  };

  const relationships = Object.entries(contestant.relationships || {}).map(([id, values]) => ({
    id,
    name: contestantsMap[id]?.name || 'Unknown',
    value: values[values.length - 1] || 50,
    change: getRelationshipChange(values),
  }));

  const sortedRelationships = [...relationships].sort((a, b) => {
    if (sortBy === 'value') return b.value - a.value;
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return a.id.localeCompare(b.id);
  });

  const columns = [
    {
      title: 'Avatar',
      dataIndex: 'id',
      key: 'avatar',
      width: 80,
      render: (id: string) => {
        const c = contestantsMap[id];
        return c ? <ContestantAvatar enablePreview={false} id={c.id} name={c.name} size={40} /> : null;
      },
    },
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Relationship',
      dataIndex: 'value',
      key: 'value',
      width: 120,
      render: (value: number) => (
        <Tag color={value >= 70 ? 'green' : value >= 40 ? 'blue' : value >= 20 ? 'orange' : 'red'}>
          {value}
        </Tag>
      ),
    },
    {
      title: 'Change',
      dataIndex: 'change',
      key: 'change',
      width: 80,
      render: (change: 'up' | 'down' | 'same') => {
        if (change === 'up') return <ArrowUpOutlined style={{ color: '#52c41a' }} />;
        if (change === 'down') return <ArrowDownOutlined style={{ color: '#ff4d4f' }} />;
        return <MinusOutlined style={{ color: '#8c8c8c' }} />;
      },
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Space
          align="center"
          style={{ marginBottom: '1rem', width: '100%', justifyContent: 'space-between' }}
        >
          <div>
            <Typography.Title level={5} style={{ margin: 0 }}>
              Relationships ({relationships.length})
            </Typography.Title>
            <Typography.Text type="secondary">
              Values: 0 (hostile) to 100 (very close). Start at 50.
            </Typography.Text>
          </div>
          <Space>
            <Typography.Text>Sort by:</Typography.Text>
            <Select
              onChange={(value) => setSortBy(value)}
              options={[
                { label: 'Relationship Value', value: 'value' },
                { label: 'Name', value: 'name' },
                { label: 'ID', value: 'id' },
              ]}
              style={{ width: 180 }}
              value={sortBy}
            />
          </Space>
        </Space>
        {relationships.length > 0 ? (
          <Table
            columns={columns}
            dataSource={sortedRelationships}
            pagination={{ pageSize: 10 }}
            rowKey="id"
            size="small"
          />
        ) : (
          <Typography.Text type="secondary">No relationships initialized</Typography.Text>
        )}
      </div>
    </Space>
  );
}

// Tab 5: Change Log
function ChangeLogTab({ contestant }: { contestant: Contestant }) {
  const columns = [
    {
      title: 'Episode',
      dataIndex: 'episode',
      key: 'episode',
      width: 80,
    },
    {
      title: 'Rank',
      dataIndex: 'rank',
      key: 'rank',
      width: 80,
    },
    {
      title: 'Score',
      dataIndex: 'score',
      key: 'score',
      width: 80,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => <Tag>{status}</Tag>,
    },
    {
      title: 'Summary',
      dataIndex: 'summary',
      key: 'summary',
      ellipsis: true,
    },
    {
      title: 'Events',
      dataIndex: 'events',
      key: 'events',
      width: 100,
      render: (events: string[]) => events.length,
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Typography.Title level={5}>Change Log ({contestant.changeLog.length} entries)</Typography.Title>
        <Typography.Paragraph type="secondary">
          Historical record of the contestant's journey through the competition.
        </Typography.Paragraph>
        <Table
          columns={columns}
          dataSource={contestant.changeLog}
          expandable={{
            expandedRowRender: (record) => (
              <div style={{ padding: '8px' }}>
                <Typography.Text strong>Events: </Typography.Text>
                {record.events.length > 0 ? (
                  <Space wrap>
                    {record.events.map((event) => (
                      <Tag color="purple" key={event}>
                        {event}
                      </Tag>
                    ))}
                  </Space>
                ) : (
                  <Typography.Text type="secondary">No events</Typography.Text>
                )}
                <br />
                <br />
                <Typography.Text strong>Changes: </Typography.Text>
                <pre style={{ marginTop: '8px', fontSize: '12px' }}>
                  {JSON.stringify(record.change, null, 2)}
                </pre>
              </div>
            ),
          }}
          pagination={false}
          rowKey={(record) => `${record.episode}`}
          size="small"
        />
      </div>
    </Space>
  );
}
