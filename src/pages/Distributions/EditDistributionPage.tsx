import './EditDistributionPage.scss';

import { SaveOutlined } from '@ant-design/icons';
import { Content } from '@components/Content';
import { DistributionLog } from '@components/Log/DistributionLog';
import { CopyLyricsButton } from '@components/Lyrics/CopyLyricsButton';
import { ControlledVideo } from '@components/Video/ControlledVideo';
import { VideoControls } from '@components/Video/VideoControls';
import { SongDistributionProvider, useSongDistributionContext } from '@services/SongDistributionProvider';
import type { Distribution } from '@types';
import { Button, Flex, Progress, Space, Typography } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMeasure } from 'react-use';
import { DistributionLiveStats } from './DistributionLiveStats';

export function EditDistributionPage() {
  const location = useLocation();
  const draftDistribution = (location.state as { draftDistribution?: Distribution })?.draftDistribution;

  return (
    <SongDistributionProvider draftDistribution={draftDistribution}>
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
      <Flex align="center" justify="space-between">
        <Typography.Title level={2}>
          Edit Distribution: <em>{group.name}</em> sings <em>{song.title}</em>
        </Typography.Title>
        <CopyLyricsButton distribution={distribution} song={song} />
      </Flex>

      <Space className="w-100" orientation="vertical" size="small">
        <Progress className="w-100" percent={mappingProgress} />
      </Space>

      <div className="distributor">
        <div>
          <VideoControls className="distributor__controls" videoControls={videoControls} />
          <div className="distributor__metadata">
            <ControlledVideo
              className="distributor__video"
              hideControls
              onStateChange={videoControls.onStateChange}
              playerRef={videoControls.playerRef}
              setEnd={() => {}}
              setPlaying={() => {}}
              videoId={song.videoId}
              width={Math.min(width / 2 - 12, 320)}
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
      <Flex className="surface my-2" justify="space-between">
        <Space>
          <Button icon={<SaveOutlined />} loading={isSaving} onClick={onSave} size="large" type="primary">
            {distribution.id === '$draft' ? 'Create Distribution' : 'Save Changes'}
          </Button>
          <Button
            disabled={distribution.id === '$draft'}
            onClick={() => navigate(`/distributions/${distribution.id}`)}
            size="large"
          >
            View
          </Button>
        </Space>
      </Flex>
    </Content>
  );
}
