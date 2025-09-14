import { Button, Space, Typography } from 'antd';
import { AddNewSectionCollapse } from 'components/Log/AddNewSectionCollapse';
import { EditorsLog } from 'components/Log/EditorsLog';
import { NudgeSongCollapse } from 'components/Log/NudgeSongCollapse';
import { ControlledVideo } from 'components/Video/ControlledVideo';
import { useSongActions } from 'hooks/useSongActions';
import { useVideoControls } from 'hooks/useVideoControls';
import { useMemo } from 'react';
import type YouTube from 'react-youtube';
import { useSongEditContext } from 'services/SongEditProvider';
import { NULL } from 'utils/constants';
import { getSection } from 'utils/song';

type StepCategorizerProps = {
  videoWidth: number;
};

export function StepCategorizer({ videoWidth }: StepCategorizerProps) {
  const { song } = useSongEditContext();
  const videoControls = useVideoControls();
  const { onNumberSections, onAddNewSection } = useSongActions();

  const isAnySectionKindNull = useMemo(() => {
    return song.sectionIds.some((id) => {
      const section = getSection(id, song);
      return section.kind === NULL;
    });
  }, [song]);

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
            <Button
              block
              icon={<i className="fi fi-ss-arrow-progress" />}
              onClick={onNumberSections}
              disabled={isAnySectionKindNull}
            >
              Number Sections
            </Button>

            <AddNewSectionCollapse />

            <NudgeSongCollapse />
          </Space>
        </Space>
      </div>
    </>
  );
}
