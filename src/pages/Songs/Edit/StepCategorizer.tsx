import { Space, Typography } from 'antd';
import { AddNewSectionCollapse } from 'components/Log/AddNewSectionCollapse';
import { EditorsLog } from 'components/Log/EditorsLog';
import { NudgeSongCollapse } from 'components/Log/NudgeSongCollapse';
import { SectionOrganizerCollapse } from 'components/Log/SectionOrganizerCollapse';
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
        <Space direction="vertical">
          <ControlledVideo
            videoId={song.videoId}
            className="surface"
            width={Math.min(videoWidth, 480)}
            playerRef={videoControls.playerRef as React.LegacyRef<YouTube>}
            setPlaying={videoControls.setPlaying}
            setEnd={videoControls.setEnd}
          />

          <Space
            className="surface"
            direction="vertical"
            style={{ minWidth: 300, width: '100%' }}
            classNames={{ item: 'p-1' }}
          >
            <Typography.Title level={5} className="mt-1">
              Actions
            </Typography.Title>
            <SectionOrganizerCollapse />

            <AddNewSectionCollapse />

            <NudgeSongCollapse />
          </Space>
        </Space>
      </div>
    </>
  );
}
