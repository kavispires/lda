import { BookOutlined, RocketOutlined, TeamOutlined, TrophyOutlined } from '@ant-design/icons';
import { Card, Col, Row, Typography } from 'antd';
import { Content } from 'components/Content';
import { useNavigate } from 'react-router-dom';

const navigationCards = [
  {
    id: 'contestants',
    title: 'Contestants',
    description: 'View, create, and manage all contestants in The Search survival show',
    icon: <TeamOutlined style={{ fontSize: '64px', color: '#1890ff' }} />,
    path: '/the-search/contestants',
    color: '#e6f7ff',
  },
  {
    id: 'libraries',
    title: 'Libraries',
    description: 'Browse card libraries including identity cards, persona cards, and more',
    icon: <BookOutlined style={{ fontSize: '64px', color: '#52c41a' }} />,
    path: '/the-search/libraries',
    color: '#f6ffed',
  },
  {
    id: 'simulation',
    title: 'Simulation',
    description: 'Initialize and run survival show simulations with 50 contestants',
    icon: <RocketOutlined style={{ fontSize: '64px', color: '#722ed1' }} />,
    path: '/the-search/simulation',
    color: '#f9f0ff',
  },
  {
    id: 'rankings',
    title: 'Rankings',
    description: 'View contestant rankings, statistics, and performance analytics (Coming Soon)',
    icon: <TrophyOutlined style={{ fontSize: '64px', color: '#faad14' }} />,
    path: '#',
    color: '#fffbe6',
    disabled: true,
  },
];

export function TheSearchPage() {
  const navigate = useNavigate();

  return (
    <Content>
      <Typography.Title level={1}>The Search</Typography.Title>
      <Typography.Paragraph style={{ fontSize: '16px' }}>
        A survival show simulation where contestants compete in challenges, build relationships, and fight for
        the top spot. Manage contestants, explore card libraries, and simulate dramatic episodes.
      </Typography.Paragraph>

      <Row gutter={[24, 24]} style={{ marginTop: '3rem' }}>
        {navigationCards.map((card) => (
          <Col key={card.id} lg={12} md={12} xs={24}>
            <Card
              hoverable={!card.disabled}
              onClick={() => !card.disabled && navigate(card.path)}
              style={{
                height: '100%',
                cursor: card.disabled ? 'not-allowed' : 'pointer',
                backgroundColor: card.color,
                opacity: card.disabled ? 0.6 : 1,
              }}
            >
              <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <div style={{ marginBottom: '24px' }}>{card.icon}</div>
                <Typography.Title level={3} style={{ marginBottom: '12px' }}>
                  {card.title}
                </Typography.Title>
                <Typography.Paragraph
                  style={{ fontSize: '15px', margin: 0 }}
                  type={card.disabled ? 'secondary' : undefined}
                >
                  {card.description}
                </Typography.Paragraph>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </Content>
  );
}
