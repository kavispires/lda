import { Visualizer } from 'components/Visualizer/Visualizer';
import { DistributionVisualizerProvider } from 'services/DistributionVisualizerProvider';
import { SongDistributionProvider, useSongDistributionContext } from 'services/SongDistributionProvider';

export function DistributionPage() {
  return (
    <SongDistributionProvider>
      <DistributionPageContent />
    </SongDistributionProvider>
  );
}

function DistributionPageContent() {
  const { song, distribution } = useSongDistributionContext();
  return (
    <DistributionVisualizerProvider song={song} distribution={distribution}>
      <Visualizer />
    </DistributionVisualizerProvider>
  );
}
