import { Typography } from 'antd';
import { EditorsLog } from 'components/Log/EditorsLog';
import { ControlledVideo } from 'components/Video/ControlledVideo';
import { useVideoControls } from 'hooks/useVideoControls';
import type YouTube from 'react-youtube';
import { useSongEditContext } from 'services/SongEditProvider';

type StepCategorizerProps = {
  videoWidth: number;
};

export function StepCategorizer({ videoWidth }: StepCategorizerProps) {
  const { song } = useSongEditContext();
  const videoControls = useVideoControls();

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

          <div className="mt-4 surface">
            <span>TODO: Add section</span>
            <span>TODO: Add merge options</span>
          </div>
        </div>
      </div>
    </>
  );
}
