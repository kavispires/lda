import './EditSongPage.scss';

import { Button, Space, Tag, Tooltip, Typography } from 'antd';
import { Content } from 'components/Content';
import { useMeasure } from 'react-use';
import { SongEditProvider, useSongEditContext } from 'services/SongEditProvider';

import { EditSongStepper } from './Edit/EditSongStepper';
import { StepCategorizer } from './Edit/StepCategorizer';
import { StepMetadata } from './Edit/StepMetadata';
import { StepPreview } from './Edit/StepPreview';
import { StepSync } from './Edit/StepSync';

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
    isReady,
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
        <div>
          <Tooltip title="A song is considered ready when every part has been assigned start and end times.">
            {isReady ? <Tag color="success">Ready</Tag> : <Tag color="error">Not Ready</Tag>}
          </Tooltip>
        </div>
        <Button size="large" type="primary" loading={isSaving} onClick={saveSong}>
          Save
        </Button>
      </Space>
    </Content>
  );
}
