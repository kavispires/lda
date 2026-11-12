import type { ValuesOf } from '@types';
import { Tag } from 'antd';
import { MicIcon, PersonStandingIcon, ZapIcon } from 'lucide-react';
import type { TRACKS } from '../utilities/constants';

interface TrackTagProps {
  track: ValuesOf<typeof TRACKS>;
}

const TRACK_CONFIG = {
  VOCAL: {
    icon: MicIcon,
    label: 'Vocal',
  },
  RAP: {
    icon: ZapIcon,
    label: 'Rap',
  },
  DANCE: {
    icon: PersonStandingIcon,
    label: 'Dance',
  },
} as const;

export function TrackTag({ track }: TrackTagProps) {
  const config = TRACK_CONFIG[track];

  if (!config) {
    return <Tag>{track}</Tag>;
  }

  const TrackIcon = config.icon;
  return <Tag icon={<TrackIcon />}> {config.label}</Tag>;
}
