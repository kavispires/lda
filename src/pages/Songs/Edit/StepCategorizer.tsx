import { Button, Space, Typography } from 'antd';
import { EditorsLog } from 'components/Log/EditorsLog';
import { ControlledVideo } from 'components/Video/ControlledVideo';
import { useSongActions } from 'hooks/useSongActions';
import { useVideoControls } from 'hooks/useVideoControls';
import type YouTube from 'react-youtube';
import { useSongEditContext } from 'services/SongEditProvider';

type StepCategorizerProps = {
  videoWidth: number;
};

export function StepCategorizer({ videoWidth }: StepCategorizerProps) {
  const { song } = useSongEditContext();
  const videoControls = useVideoControls();
  const { onNumberSections } = useSongActions();

  return (
    <>
      <Typography.Title level={3}>Categorize Sections</Typography.Title>
      <Typography.Paragraph>
        Click on each section, line, and part to add additional metadata, categorization or even add new
        seconds and parts.
      </Typography.Paragraph>

      <div className="grid grid-cols-2 gap-2">
        <EditorsLog key={song.updatedAt} videoControls={videoControls} />
        <div>
          <ControlledVideo
            videoId={song.videoId}
            width={Math.min(videoWidth, 480)}
            playerRef={videoControls.playerRef as React.LegacyRef<YouTube>}
            setPlaying={videoControls.setPlaying}
            setEnd={videoControls.setEnd}
          />

          <Space className="mt-4 surface" direction="vertical">
            <span>TODO: Add section</span>

            <Button block onClick={onNumberSections} icon={<i className="fi fi-rr-arrow-progress" />}>
              Number Sections
            </Button>
          </Space>
        </div>
      </div>
    </>
  );
}
