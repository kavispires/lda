import { Typography } from 'antd';
import { ContestantAvatar } from '../ContestantAvatar';

type ContestantHeaderProps = {
  id?: string;
  name?: string;
  track?: string;
  color?: string;
};

/**
 * Header component displaying contestant avatar and basic info with gradient background
 */
export function ContestantHeader({ id, name, track, color = '#FFFFFF' }: ContestantHeaderProps) {
  if (!id || !name) return null;

  return (
    <div
      style={{
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '1rem',
        borderRadius: '12px',
        background: `linear-gradient(135deg, ${color} 0%, transparent 25%)`,
        // border: '1px solid #d9d9d9',
      }}
    >
      <ContestantAvatar id={id} name={name} size={96} />
      <div>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {name}
        </Typography.Title>
        <Typography.Text type="secondary">
          {id} • {track}
        </Typography.Text>
      </div>
    </div>
  );
}
