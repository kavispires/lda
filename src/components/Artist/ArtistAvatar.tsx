import { Avatar, AvatarProps } from 'antd';

type ArtistAvatarProps = {
  id: string;
  name: string;
} & Omit<AvatarProps, 'src' | 'children'>;

export function ArtistAvatar({ id, name, ...props }: ArtistAvatarProps) {
  const artistAvatarUrl = `${process.env.PUBLIC_URL}/images/artists/${id}.jpg`;

  return (
    <Avatar src={artistAvatarUrl} {...props}>
      {name.charAt(0)}
    </Avatar>
  );
}
