import { Progress, Typography } from 'antd';
import { EditorsLog } from 'components/Log/EditorsLog';
import { PlaybackVideo } from 'components/Video/PlaybackVideo';
import { useSongEditContext } from 'services/SongEditProvider';

type StepCategorizerProps = {
  videoWidth: number;
};

export function StepCategorizer({ videoWidth }: StepCategorizerProps) {
  const {
    song: { videoId },
  } = useSongEditContext();
  return (
    <>
      <Typography.Title level={3}>Categorize Sections</Typography.Title>
      <Typography.Paragraph>
        Click on each section, line, and part to add additional metadata, categorization or even add new
        seconds and parts.
      </Typography.Paragraph>

      <div className="grid grid-cols-2 gap-2">
        <EditorsLog />
        <div>
          <PlaybackVideo videoId={videoId} width={videoWidth} />
        </div>
      </div>
      <Progress percent={50} />
    </>
  );
}
