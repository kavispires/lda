import { FastForwardOutlined } from '@ant-design/icons';
import { Alert, Button, Space, Tooltip } from 'antd';
import { useState } from 'react';
import { type EpisodeNumber, isEpisodeComplete } from '../engine/episode-auto-complete';
import { simulationActions } from '../services/SimulationStore';
import type { SimulationState } from '../types/simulation';

export function AutoCompleteEpisodeButton({
  state,
  episode,
  onCompleted,
}: {
  state: SimulationState;
  episode: EpisodeNumber;
  onCompleted?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runtime = state.runtime;
  if (
    !runtime ||
    state.status !== 'ready' ||
    isEpisodeComplete(state, episode) ||
    (episode === 2 && !isEpisodeComplete(state, 1)) ||
    (episode === 3 && (runtime.version !== 3 || !isEpisodeComplete(state, 2))) ||
    (episode === 4 && (runtime.version !== 3 || !isEpisodeComplete(state, 3)))
  )
    return null;

  return (
    <Space orientation="vertical">
      <Tooltip title="Finish this episode now, automatically choosing any remaining decisions. Existing choices and results are kept.">
        <Button
          icon={<FastForwardOutlined />}
          loading={loading}
          onClick={async () => {
            setLoading(true);
            setError(null);
            try {
              await simulationActions.autoCompleteEpisode(episode, state);
              onCompleted?.();
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Could not auto-complete the episode.');
            } finally {
              setLoading(false);
            }
          }}
        >
          Auto-complete episode
        </Button>
      </Tooltip>
      {error && <Alert role="alert" title={error} type="error" />}
    </Space>
  );
}
