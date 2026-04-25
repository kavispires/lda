import { Tag } from 'antd';
import type { ValuesOf } from 'types';
import type { TRACKS } from '../utilities/constants';

interface TrackTagProps {
  track: ValuesOf<typeof TRACKS>;
}

const TRACK_CONFIG = {
  VOCAL: {
    icon: 'fi fi-rr-microphone',
    label: 'Vocal',
  },
  RAP: {
    icon: 'fi fi-rr-bolt',
    label: 'Rap',
  },
  DANCE: {
    icon: 'fi fi-rr-running',
    label: 'Dance',
  },
} as const;

export function TrackTag({ track }: TrackTagProps) {
  const config = TRACK_CONFIG[track];

  if (!config) {
    return <Tag>{track}</Tag>;
  }

  return <Tag icon={<i className={config.icon} />}> {config.label}</Tag>;
}
