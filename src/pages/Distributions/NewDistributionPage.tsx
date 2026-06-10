import { useQueryClient } from '@tanstack/react-query';
import { Typography } from 'antd';
import { Content, ContentError } from 'components/Content';
import { generateDraftDistribution } from 'hooks/useCreateDistributionMutation';
import { useQueryParams } from 'hooks/useQueryParams';
import { useSongQuery } from 'hooks/useSong';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Artist, Group, Song } from 'types';
import { ArtistsSelectionStep } from './ArtistsSelectionStep';

export type NewDistribution = Pick<
  Song,
  'videoId' | 'originalArtist' | 'title' | 'sectionIds' | 'content' | 'startAt' | 'endAt'
>;

export function NewDistributionPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { queryParams } = useQueryParams();
  const songId = queryParams.get('songId');
  const songQuery = useSongQuery(songId ?? '');
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [selectedArtists, setSelectedArtists] = useState<Artist[]>([]);

  if (!songId || !songQuery.data) {
    return <ContentError>You haven't selected a song</ContentError>;
  }

  const onCreate = () => {
    if (selectedGroup) {
      // Generate draft distribution locally
      const draftDistribution = generateDraftDistribution(songQuery.data, selectedGroup, selectedArtists);

      // Invalidate any existing draft cache to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['distribution', '$draft'] });

      // Navigate to edit page with draft data in state
      navigate('/distributions/$draft/edit', {
        state: { draftDistribution },
      });
    }
  };

  return (
    <Content>
      <Typography.Title level={2}>Create Distribution for: {songQuery.data?.title}</Typography.Title>

      <ArtistsSelectionStep
        onNextStep={onCreate}
        selectedArtists={selectedArtists}
        selectedGroup={selectedGroup}
        setSelectedArtists={setSelectedArtists}
        setSelectedGroup={setSelectedGroup}
      />
    </Content>
  );
}
