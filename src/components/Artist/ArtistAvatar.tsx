import { Avatar, type AvatarProps } from 'antd';

type ArtistAvatarProps = {
  id: string;
  name: string;
  contestantImageId: string | undefined;
} & Omit<AvatarProps, 'src' | 'children'>;

export function ArtistAvatar({ id, name, contestantImageId, ...props }: ArtistAvatarProps) {
  const imageUrl = contestantImageId
    ? `images/contestants/${contestantImageId}.jpg`
    : `images/artists/${id}.jpg`;

  return (
    <Avatar src={imageUrl} {...props}>
      {name.charAt(0)}
    </Avatar>
  );
}
