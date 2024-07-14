import './NewDistributionPage.scss';

import { Typography } from 'antd';
import { Content, ContentError } from 'components/Content';
import { useState } from 'react';
import { Song } from 'types';

// import { NewDistributionStepper } from './New/NewDistributionStepper';
// import { StepLyrics } from './New/StepLyrics';
// import { StepVideoId } from './New/StepVideoId';
import { useSongQuery } from 'hooks/useSong';
import { useQueryParams } from 'hooks/useQueryParams';

export type NewDistribution = Pick<
  Song,
  'videoId' | 'originalArtist' | 'title' | 'sectionIds' | 'content' | 'startAt' | 'endAt'
>;

export function NewDistributionPage() {
  const [step, setStep] = useState<number>(0);
  const { queryParams } = useQueryParams();
  const songId = queryParams.get('songId');
  const songQuery = useSongQuery(songId ?? '');

  if (!songId) {
    return <ContentError>You haven't selected a song</ContentError>;
  }

  return (
    <Content>
      <Typography.Title level={2}>Create Distribution</Typography.Title>

      {/* <NewDistributionStepper step={step} /> */}

      {step === 0 && <>Select artists</>}

      {step === 1 && <>Distribute</>}
    </Content>
  );
}
