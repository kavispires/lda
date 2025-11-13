import { Progress, Result, Typography } from 'antd';
import { Visualizer } from 'components/Visualizer/Visualizer';
import { useDistributionEmulator } from 'hooks/useDistributionEmulator';
import { useMemo } from 'react';
import { DistributionVisualizerProvider } from 'services/DistributionVisualizerProvider';
import { useSongEditContext } from 'services/SongEditProvider';
import { distributor } from 'utils';

export function StepPreview() {
  const { song } = useSongEditContext();

  const timeStampProgress = useMemo(() => {
    return distributor.getPartsWithDurationCompletion(song);
  }, [song]);

  return (
    <>
      <Typography.Title level={3}>Preview</Typography.Title>
      <Typography.Paragraph>
        This step is just to make sure all the parts are correctly synced with the video. You may only preview
        if every part is synced (has start and end times).
      </Typography.Paragraph>
      <Progress percent={timeStampProgress} status={timeStampProgress < 100 ? 'exception' : 'success'} />

      {timeStampProgress < 100 ? (
        <div className="surface my-6">
          <Result
            status="error"
            subTitle="Please make sure all parts have start and end times in the previous step."
            title="Not all parts are synced"
          />
        </div>
      ) : (
        <VisualizerSimulator />
      )}
    </>
  );
}

function VisualizerSimulator() {
  const { song } = useSongEditContext();
  const distributionRecord = useDistributionEmulator(song);

  return (
    <DistributionVisualizerProvider distribution={distributionRecord} song={song}>
      <Visualizer />
    </DistributionVisualizerProvider>
  );
}
