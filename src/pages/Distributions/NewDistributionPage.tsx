import { Typography } from 'antd';
import { Content, ContentError } from 'components/Content';
import { useCreateDistributionMutation } from 'hooks/useCreateDistributionMutation';
import { useQueryParams } from 'hooks/useQueryParams';
import { useSongQuery } from 'hooks/useSong';
import { useState } from 'react';
import { Artist, Group, Song } from 'types';

import { ArtistsSelectionStep } from './ArtistsSelectionStep';
import { useNavigate } from 'react-router-dom';

export type NewDistribution = Pick<
  Song,
  'videoId' | 'originalArtist' | 'title' | 'sectionIds' | 'content' | 'startAt' | 'endAt'
>;

export function NewDistributionPage() {
  const navigate = useNavigate();
  const { queryParams } = useQueryParams();
  const songId = queryParams.get('songId');
  const songQuery = useSongQuery(songId ?? '');
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [selectedArtists, setSelectedArtists] = useState<Artist[]>([]);
  const { mutate: saveNewDistribution } = useCreateDistributionMutation();

  if (!songId || !songQuery.data) {
    return <ContentError>You haven't selected a song</ContentError>;
  }

  const onCreate = () => {
    if (selectedGroup) {
      saveNewDistribution(
        {
          song: songQuery.data,
          group: selectedGroup!,
          selectedArtists,
        },
        {
          onSuccess: (newDistribution) => {
            navigate(`/distributions/${newDistribution.id}/edit `);
          },
        }
      );
    }
  };

  return (
    <Content>
      <Typography.Title level={2}>Create Distribution for: {songQuery.data?.title}</Typography.Title>

      <ArtistsSelectionStep
        selectedArtists={selectedArtists}
        setSelectedArtists={setSelectedArtists}
        selectedGroup={selectedGroup}
        setSelectedGroup={setSelectedGroup}
        onNextStep={onCreate}
      />
    </Content>
  );
}
