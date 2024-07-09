import { Button, Space, Typography } from 'antd';
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
    isSaving,
    saveSong,
  } = useSongEditContext();
  const [ref, { width }] = useMeasure<HTMLElement>();

  return (
    <Content ref={ref}>
      <Typography.Title level={2}>Edit Song: {song.title}</Typography.Title>

      <EditSongStepper />

      {step === 0 && <StepCategorizer videoWidth={width / 2 - 12} />}

      {step === 1 && <StepSync videoWidth={width / 2 - 12} />}

      {step === 2 && <StepPreview />}

      {step === 3 && <StepMetadata />}

      <Space className="container-center my-10">
        <Button size="large" type="primary" loading={isSaving} onClick={saveSong}>
          Save
        </Button>
      </Space>
    </Content>
  );
}
