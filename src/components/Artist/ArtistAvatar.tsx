import { Avatar, type AvatarProps } from 'antd';

type ArtistAvatarProps = {
  id: string;
  name: string;
} & Omit<AvatarProps, 'src' | 'children'>;

export function ArtistAvatar({ id, name, ...props }: ArtistAvatarProps) {
  const artistAvatarUrl = `images/artists/${id}.jpg`;

  return (
    <Avatar src={artistAvatarUrl} {...props}>
      {name.charAt(0)}
    </Avatar>
  );
}
