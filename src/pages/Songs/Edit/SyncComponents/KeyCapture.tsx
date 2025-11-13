import { Button } from 'antd';
import { useKeyDown, useKeyUp } from 'hooks/useOnKeyPress';
import { uniqueId } from 'lodash';
import { useEffect } from 'react';
import type { Dictionary } from 'types';
import { ASSIGNEES, DEFAULT_ASSIGNEE } from 'utils/constants';

export type RecordingTimestamp = {
  startTime: number;
  endTime?: number;
  assignee: string;
  id: string;
};

const KEYS = [' ', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

const KEY_ASSIGNEE: Dictionary<string> = {
  ' ': 'X',
  0: 'X',
  1: 'A',
  2: 'B',
  3: 'C',
  4: 'D',
  5: 'E',
  6: 'F',
  7: 'G',
  8: 'H',
  9: 'I',
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
  E: 'E',
  F: 'F',
  G: 'G',
  H: 'H',
  I: 'I',
};

let playing = false;
const tempKeyPressing: Dictionary<boolean> = {};
const tempPart: Dictionary<RecordingTimestamp | null> = {};

const convertStoMS = (seconds: number) => {
  return Math.round(seconds * 1000);
};

async function handleActionDown(
  key: string,
  playerRef: { current: { internalPlayer: { getCurrentTime: () => any } } },
) {
  // Don't run if video is not playing
  if (!playing) return;
  // Don't run if this key is being captured
  if (tempKeyPressing[key]) return;
  // Don't run if a part for this key is present
  if (tempPart[key]) return;
  // Not allowed key
  if (!KEY_ASSIGNEE[key]) return;

  tempKeyPressing[key] = true;

  const newTimestamp: RecordingTimestamp = {
    startTime: convertStoMS(await playerRef.current.internalPlayer.getCurrentTime()),
    assignee: KEY_ASSIGNEE?.[key] ?? DEFAULT_ASSIGNEE,
    id: uniqueId(),
  };

  tempPart[key] = newTimestamp;
}

async function handleActionUp(
  key: string | number,
  playerRef: { current: { internalPlayer: { getCurrentTime: () => any } } },
) {
  // Don't run if video is not playing
  if (!playing) return;
  // Don't run if key is not being captured
  if (!tempKeyPressing[key]) return;
  // Don't run if a part is not present
  if (!tempPart[key]) return;
  // Not allowed key
  if (!KEY_ASSIGNEE[key]) return;

  tempPart[key]!.endTime = convertStoMS(await playerRef.current.internalPlayer.getCurrentTime());

  const copy = { ...tempPart[key] } as RecordingTimestamp;

  delete tempPart[key];
  delete tempKeyPressing[key];

  return copy;
}

type KeyboardCaptureProps = {
  playerRef: React.MutableRefObject<any | null>;
  isPlaying: boolean;
  isRecording: boolean;
  setUnassignedTimestamps: React.Dispatch<React.SetStateAction<RecordingTimestamp[]>>;
};

export function KeyCapture({
  playerRef,
  isPlaying,
  setUnassignedTimestamps,
  isRecording,
}: KeyboardCaptureProps) {
  // Work around since useKeyDown is not capturing isPlaying correctly
  useEffect(() => {
    playing = isPlaying;
  }, [isPlaying]);

  const onCaptureButtonDown = async (key: string) => {
    await handleActionDown(key, playerRef);
  };

  const onCaptureButtonUp = async (key: string) => {
    const result = await handleActionUp(key, playerRef);

    if (result?.endTime) {
      setUnassignedTimestamps((prev) => [...prev, result]);
    }
  };

  return (
    <div className="grid grid-cols-4 gap-2">
      {isRecording && (
        <KeyboardCapture
          isPlaying={isPlaying}
          isRecording={isRecording}
          playerRef={playerRef}
          setUnassignedTimestamps={setUnassignedTimestamps}
        />
      )}
      {Object.values(ASSIGNEES).map((entry, index) => (
        <Button
          className="TODO"
          disabled={!(isPlaying && isRecording)}
          key={entry.value}
          onClick={() => {}}
          onMouseDown={() => onCaptureButtonDown(entry.value)}
          onMouseUp={() => onCaptureButtonUp(entry.value)}
          style={{ backgroundColor: entry.color }}
        >
          {index + 1}
          <br />({entry.label})
        </Button>
      ))}
    </div>
  );
}

function KeyboardCapture({ playerRef, setUnassignedTimestamps }: KeyboardCaptureProps) {
  // Capture SPACE key down
  useKeyDown(KEYS, async (key) => {
    await handleActionDown(key, playerRef);
  });

  // Capture SPACE key up
  useKeyUp(KEYS, async (key) => {
    const result = await handleActionUp(key, playerRef);

    if (result?.endTime) {
      setUnassignedTimestamps((prev) => [...prev, result]);
    }
  });

  return null;
}
