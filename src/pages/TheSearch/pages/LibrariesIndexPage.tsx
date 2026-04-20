import { BookOutlined, HeartOutlined, UserOutlined } from '@ant-design/icons';
import { Card, Col, Row, Typography } from 'antd';
import { Content } from 'components/Content';
import { useNavigate } from 'react-router-dom';
import identityCardsData from '../data/identity-cards.json';
import interestCardsData from '../data/interest-cards.json';
import personaCardsData from '../data/persona-cards.json';

const libraryCards = [
  {
    id: 'identity',
    title: 'Identity Cards',
    description:
      'Personality archetypes and character traits that define how contestants behave and interact',
    icon: <UserOutlined style={{ fontSize: '48px', color: '#1890ff' }} />,
    count: Object.keys(identityCardsData).length,
    path: '/the-search/libraries/identity',
  },
  {
    id: 'persona',
    title: 'Persona Cards',
    description: 'Public-facing personas and audience-targeted character concepts for contestants',
    icon: <BookOutlined style={{ fontSize: '48px', color: '#52c41a' }} />,
    count: personaCardsData.length,
    path: '/the-search/libraries/persona',
  },
  {
    id: 'interest',
    title: 'Interest Cards',
    description: 'Hobbies, passions, and background interests that add depth to contestant personalities',
    icon: <HeartOutlined style={{ fontSize: '48px', color: '#eb2f96' }} />,
    count: Object.keys(interestCardsData).length,
    path: '/the-search/libraries/interest',
  },
];

export function LibrariesIndexPage() {
  const navigate = useNavigate();

  return (
    <Content>
      <Typography.Title level={2}>The Search - Libraries</Typography.Title>
      <Typography.Paragraph>
        Browse and manage card libraries that define contestant attributes, behaviors, and gameplay mechanics.
      </Typography.Paragraph>

      <Row gutter={[16, 16]} style={{ marginTop: '2rem' }}>
        {libraryCards.map((library) => (
          <Col key={library.id} lg={8} md={12} xs={24}>
            <Card
              hoverable
              onClick={() => navigate(library.path)}
              style={{
                textAlign: 'center',
                height: '100%',
                cursor: 'pointer',
              }}
            >
              <div style={{ marginBottom: '16px' }}>{library.icon}</div>
              <Typography.Title level={4}>{library.title}</Typography.Title>
              <Typography.Paragraph type="secondary">{library.description}</Typography.Paragraph>
              <Typography.Text strong>
                {library.count} {library.count === 1 ? 'card' : 'cards'}
              </Typography.Text>
            </Card>
          </Col>
        ))}
      </Row>
    </Content>
  );
}
