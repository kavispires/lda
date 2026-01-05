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
        <Space orientation="vertical">
          <ControlledVideo
            className="surface"
            playerRef={videoControls.playerRef as React.LegacyRef<YouTube>}
            setEnd={videoControls.setEnd}
            setPlaying={videoControls.setPlaying}
            videoId={song.videoId}
            width={Math.min(videoWidth, 480)}
          />

          <Space
            className="surface"
            classNames={{ item: 'p-1' }}
            orientation="vertical"
            style={{ minWidth: 300, width: '100%' }}
          >
            <Typography.Title className="mt-1" level={5}>
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
