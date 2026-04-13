import { Avatar, type AvatarProps, Image } from 'antd';
import { useState } from 'react';

type ContestantAvatarProps = {
  /**
   * The contestant ID (e.g., 'szc-01')
   */
  id: string;
  /**
   * The contestant name (used for fallback display)
   */
  name: string;
  /**
   * Enable image preview on click (default: true)
   */
  enablePreview?: boolean;
} & Omit<AvatarProps, 'src' | 'children'>;

/**
 * Displays a contestant's avatar image with fallback to first letter of name
 * Avatar images are expected at `images/contestants/{id}.jpg`
 * Click on avatar to preview full-size image
 */
export function ContestantAvatar({ id, name, enablePreview = true, ...props }: ContestantAvatarProps) {
  const [previewVisible, setPreviewVisible] = useState(false);
  const contestantAvatarUrl = `images/contestants/${id}.jpg`;

  return (
    <>
      <Avatar
        onClick={() => enablePreview && setPreviewVisible(true)}
        src={contestantAvatarUrl}
        style={{ cursor: enablePreview ? 'pointer' : 'default' }}
        {...props}
      >
        {name.charAt(0) || '?'}
      </Avatar>
      {enablePreview && (
        <Image
          preview={{
            visible: previewVisible,
            src: contestantAvatarUrl,
            onVisibleChange: (visible) => setPreviewVisible(visible),
          }}
          src={contestantAvatarUrl}
          style={{ display: 'none' }}
        />
      )}
    </>
  );
}
