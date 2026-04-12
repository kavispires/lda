import { Avatar, type AvatarProps } from 'antd';

type ContestantAvatarProps = {
  /**
   * The contestant ID (e.g., 'szc-01')
   */
  id: string;
  /**
   * The contestant name (used for fallback display)
   */
  name: string;
} & Omit<AvatarProps, 'src' | 'children'>;

/**
 * Displays a contestant's avatar image with fallback to first letter of name
 * Avatar images are expected at `images/contestants/{id}.jpg`
 */
export function ContestantAvatar({ id, name, ...props }: ContestantAvatarProps) {
  const contestantAvatarUrl = `images/contestants/${id}.jpg`;

  return (
    <Avatar src={contestantAvatarUrl} {...props}>
      {name.charAt(0) || '?'}
    </Avatar>
  );
}
