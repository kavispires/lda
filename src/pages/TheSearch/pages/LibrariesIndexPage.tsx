import { BookOutlined, HeartOutlined, UserOutlined } from '@ant-design/icons';
import { Content } from '@components/Content';
import { Card, Col, Row, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import identityCardsData from '../data/identity-cards.json';
import interestCardsData from '../data/interest-cards.json';
import personaCardsData from '../data/persona-cards.json';
import secretCardsData from '../data/secret-cards.json';
import {
  DANCE_STYLES,
  GENRE_AFFINITIES,
  LEADERSHIP_STYLES,
  RAP_STYLES,
  VISUAL_VIBES,
  VOCAL_COLORS,
  ZODIAC_SIGNS,
} from '../utilities/attribute-libraries';

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
    count: Object.keys(personaCardsData).length,
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
  {
    id: 'secrets',
    title: 'Secret Cards',
    description: 'Hidden attributes and special abilities that can influence gameplay in unexpected ways',
    icon: <BookOutlined style={{ fontSize: '48px', color: '#faad14' }} />,
    count: Object.keys(secretCardsData).length,
    path: '/the-search/libraries/secrets',
  },
  {
    id: 'specialties',
    title: 'Specialties',
    description: 'Vocal colors, dance and rap styles, visual vibes, leadership styles, and genre affinities',
    icon: <BookOutlined style={{ fontSize: '48px', color: '#13c2c2' }} />,
    count: [VOCAL_COLORS, DANCE_STYLES, RAP_STYLES, VISUAL_VIBES, LEADERSHIP_STYLES, GENRE_AFFINITIES].reduce(
      (count, library) => count + Object.keys(library).length,
      0,
    ),
    path: '/the-search/libraries/specialties',
  },
  {
    id: 'zodiac-signs',
    title: 'Zodiac Signs',
    description: 'Zodiac archetypes and their configured attributes',
    icon: <BookOutlined style={{ fontSize: '48px', color: '#fa8c16' }} />,
    count: Object.keys(ZODIAC_SIGNS).length,
    path: '/the-search/libraries/zodiac-signs',
  },
];

export function LibrariesIndexPage() {
  const navigate = useNavigate();

  return (
    <Content>
      <Typography.Title level={2}>The Search - Libraries</Typography.Title>
      <Typography.Paragraph>
        Browse card, specialty, and zodiac libraries that define contestant attributes, behaviors, and
        gameplay mechanics.
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
