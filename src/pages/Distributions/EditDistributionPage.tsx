import './NewDistributionPage.scss';

import { Typography } from 'antd';
import { Content, ContentError } from 'components/Content';
import { useState } from 'react';

import { useSongQuery } from 'hooks/useSong';
import { useQueryParams } from 'hooks/useQueryParams';

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
