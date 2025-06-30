import './EditFormationPage.scss';

import { SaveOutlined } from '@ant-design/icons';
import { Button, Flex, Slider, Space, Typography } from 'antd';
import { Content } from 'components/Content';
import { FormationDistributionLog } from 'components/Formation/FormationDistributionLog';
import { TimelineEntry } from 'components/Formation/StageEdit';
import { ControlledVideo } from 'components/Video/ControlledVideo';
import { VideoControls } from 'components/Video/VideoControls';
import { useQueryParams } from 'hooks/useQueryParams';
import { useNavigate } from 'react-router-dom';
import { useMeasure } from 'react-use';
import { DanceFormationProvider, useDanceFormationContext } from 'services/DanceFormationProvider';
import { SongDistributionProvider, useSongDistributionContext } from 'services/SongDistributionProvider';

export function EditFormationPage() {
  return (
    <SongDistributionProvider>
      <DanceFormationProvider>
        <EditFormationContent />
      </DanceFormationProvider>
    </SongDistributionProvider>
  );
}

function EditFormationContent() {
  const { song, group, videoControls, isSaving, distribution } = useSongDistributionContext();
  const { onSave, activeTimestamp } = useDanceFormationContext();

  const navigate = useNavigate();
  const [ref, { width }] = useMeasure<HTMLElement>();
  const { queryParams, addParam } = useQueryParams();

  return (
    <Content ref={ref}>
      <Typography.Title level={2}>
        Edit Formation: <em>{group.name}</em> performs <em>{song.title}</em>
      </Typography.Title>

      {/* <Space size="small" direction="vertical" className="w-100">
        <Progress percent={mappingProgress} className="w-100" />
      </Space> */}

      <div className="formator">
        <div>
          <VideoControls videoControls={videoControls} className="formator__controls" />
          <div className="formator__metadata">
            <ControlledVideo
              width={Math.min(width / 2 - 12, 320)}
              videoId={song.videoId}
              playerRef={videoControls.playerRef}
              setPlaying={() => {}}
              setEnd={() => {}}
              className="formator__video"
              hideControls
              onStateChange={videoControls.onStateChange}
            />
            <div className="formator__title">
              <h3>{song.title}</h3>
              <p>{group.name}</p>
            </div>
          </div>

          <div className="mt-4 surface">
            <Flex gap={8} align="center">
              <Typography.Text>Stage Size</Typography.Text>
              <Slider
                value={Number(queryParams.get('stageSize') ?? 3)}
                min={2}
                max={8}
                onChange={(v) => addParam('stageSize', v)}
                style={{ width: Math.min(width / 2 - 12, 320) }}
              />
              <Typography.Text code>{queryParams.get('stageSize') ?? 3}</Typography.Text>
            </Flex>

            <Space className="surface my-2">
              <Button type="primary" onClick={onSave} loading={isSaving} icon={<SaveOutlined />}>
                Save
              </Button>
              <Button onClick={() => navigate(`/distributions/${distribution.id}`)}>
                Back to Distribution
              </Button>
            </Space>

            <FormationDistributionLog />
          </div>
        </div>
        <div className="formator__timeline">
          <TimelineEntry timestampKey={activeTimestamp} width={width} />
        </div>
      </div>
    </Content>
  );
}
