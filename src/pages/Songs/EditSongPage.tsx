import { Typography } from 'antd';
import { EditSongStepper } from './Edit/EditSongStepper';

import './EditSongPage.scss';
import { Content } from 'components/Content';
import { SongEditProvider, useSongEditContext } from 'services/SongEditProvider';
import { StepCategorizer } from './Edit/StepCategorizer';
import { StepSync } from './Edit/StepSync';
import { StepPreview } from './Edit/StepPreview';
import { StepMetadata } from './Edit/StepMetadata';
import { useMeasure } from 'react-use';

export function EditSongPage() {
  return (
    <SongEditProvider>
      <EditSongContent />
    </SongEditProvider>
  );
}

function EditSongContent() {
  const {
    song,
    stepper: { step },
  } = useSongEditContext();
  const [ref, { width, height }] = useMeasure<HTMLElement>();
  console.log({ height });
  return (
    <Content ref={ref}>
      <Typography.Title level={2}>Edit Song: {song.title}</Typography.Title>

      <EditSongStepper />

      {step === 0 && <StepCategorizer videoWidth={width / 2 - 12} />}

      {step === 1 && <StepSync />}

      {step === 2 && <StepPreview />}

      {step === 3 && <StepMetadata />}
    </Content>
  );
}
