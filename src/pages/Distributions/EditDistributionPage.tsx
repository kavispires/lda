import './EditDistributionPage.scss';

import { Button, Progress, Space, Typography } from 'antd';
import { Content } from 'components/Content';
import { DistributionLog } from 'components/Log/DistributionLog';
import { ControlledVideo } from 'components/Video/ControlledVideo';
import { VideoControls } from 'components/Video/VideoControls';
import { useMeasure } from 'react-use';
import { SongDistributionProvider, useSongDistributionContext } from 'services/SongDistributionProvider';

import { DistributionLiveStats } from './DistributionLiveStats';
import { SaveOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

export function EditDistributionPage() {
  return (
    <SongDistributionProvider>
      <EditDistributionContent />
    </SongDistributionProvider>
  );
}

function EditDistributionContent() {
  const { song, group, videoControls, mappingProgress, onSave, isSaving, distribution } =
    useSongDistributionContext();
  const navigate = useNavigate();
  const [ref, { width }] = useMeasure<HTMLElement>();

  return (
    <Content ref={ref}>
      <Typography.Title level={2}>
        Edit Distribution: <em>{group.name}</em> sings <em>{song.title}</em>
      </Typography.Title>

      <Space size="small" direction="vertical" className="w-100">
        <Progress percent={mappingProgress} className="w-100" />
      </Space>

      <div className="distributor">
        <div>
          <VideoControls videoControls={videoControls} className="distributor__controls" />
          <div className="distributor__metadata">
            <ControlledVideo
              width={Math.min(width / 2 - 12, 320)}
              videoId={song.videoId}
              playerRef={videoControls.playerRef}
              setPlaying={() => {}}
              setEnd={() => {}}
              className="distributor__video"
              hideControls
              onStateChange={videoControls.onStateChange}
            />
            <div className="visualizer__title">
              <h3>{song.title}</h3>
              <p>{group.name}</p>
            </div>
          </div>

          <div className="mt-4 surface">
            <DistributionLiveStats />
          </div>
        </div>

        <DistributionLog />
      </div>
      <Space className="surface my-2">
        <Button type="primary" size="large" onClick={onSave} loading={isSaving} icon={<SaveOutlined />}>
          Save
        </Button>
        <Button size="large" onClick={() => navigate(`/distributions/${distribution.id}`)}>
          View
        </Button>
      </Space>
    </Content>
  );
}
