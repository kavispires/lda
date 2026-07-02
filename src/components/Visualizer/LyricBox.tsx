import { ArtistAvatar } from '@components/Artist';
import type { LyricSnapshot } from '@services/DistributionVisualizerProvider';
import type { Distribution } from '@types';
import { ALL_ID, NONE_ID } from '@utils/constants';
import { motion } from 'motion/react';
import { memo } from 'react';

type LyricBoxProps = {
  snapshot: LyricSnapshot;
  assignees: Distribution['assignees'];
  timestamp: number;
};

export const LyricBox = memo(function LyricBox({ snapshot, assignees, timestamp }: LyricBoxProps) {
  const isAllOrNone =
    snapshot.assigneesIds.length === 1 && [ALL_ID, NONE_ID].includes(snapshot.assigneesIds[0]);

  return (
    <div className="lyric-box">
      <div className="lyric-box__avatars">
        {snapshot.assigneesIds.map((assigneeId, index) => {
          const artist = assignees?.[assigneeId];

          return (
            <ArtistAvatar
              id={artist?.id ?? assigneeId}
              key={assigneeId}
              name={artist?.name ?? assigneeId}
              size="large"
              style={{
                border: `3px solid ${artist?.color ?? '#f1f1f1'}`,
                marginTop: `${index * -12}px`,
                zIndex: snapshot.assigneesIds.length - index,
                opacity: isAllOrNone ? 0 : 1,
              }}
            />
          );
        })}
      </div>
      <div className="lyric-box__content">
        <div className="lyric-box__speakers">
          {!isAllOrNone &&
            snapshot.assigneesIds.map((assigneeId) => {
              const artist = assignees?.[assigneeId];

              return (
                <span
                  key={assigneeId}
                  style={{
                    color: artist?.color ?? '#f1f1f1',
                  }}
                >
                  {artist?.name ?? assigneeId}
                </span>
              );
            })}
        </div>
        <div className="lyric-box__text">
          {snapshot.lines.map((line, lineIndex) => (
            <div className="lyric-box__line" key={`line-${lineIndex}`}>
              {line.parts.map((part, partIndex) => {
                const { text, colors, startTime, endTime } = part;

                // Check if this word is currently active
                const isActive = timestamp >= startTime;

                // Duration in seconds (timestamps are in 100ms units)
                const animationDuration = (endTime - startTime) * 0.1;

                return (
                  <span
                    key={`${text}-${partIndex}`}
                    style={{
                      display: 'inline-block',
                      position: 'relative',
                      marginRight: '0.5em',
                      fontStyle: isAllOrNone ? 'italic' : 'normal',
                    }}
                  >
                    {/* Background (unsung) text */}
                    <span
                      style={{
                        background: `linear-gradient(180deg, ${colors.join(', ')})`,
                        backgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        opacity: 0.3,
                      }}
                    >
                      {text}
                    </span>
                    {/* Foreground (sung) text with clip-path */}
                    <motion.span
                      animate={{
                        clipPath: isActive ? 'inset(0 0% 0 0)' : 'inset(0 100% 0 0)',
                      }}
                      initial={{
                        clipPath: 'inset(0 100% 0 0)',
                      }}
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        background: `linear-gradient(180deg, ${colors.join(', ')})`,
                        backgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        fontWeight: 900,
                      }}
                      transition={{
                        clipPath: { duration: isActive ? animationDuration : 0, ease: 'linear' },
                      }}
                    >
                      {text}
                    </motion.span>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

export const AdlibBox = memo(function AdlibBox({ snapshot, assignees }: Omit<LyricBoxProps, 'timestamp'>) {
  const isAllOrNone =
    snapshot.assigneesIds.length === 1 && [ALL_ID, NONE_ID].includes(snapshot.assigneesIds[0]);

  return (
    <div className="adlib-box">
      <div className="adlib-box__content">
        <div className="adlib-box__speakers">
          {!isAllOrNone &&
            snapshot.assigneesIds.map((assigneeId) => {
              const artist = assignees?.[assigneeId];

              return (
                <span
                  key={assigneeId}
                  style={{
                    color: artist?.color ?? '#f1f1f1',
                  }}
                >
                  {artist?.name ?? assigneeId}
                </span>
              );
            })}
        </div>
        <div className="adlib-box__text">
          {snapshot.lines.map((line, lineIndex) => (
            <div className="adlib-box__line" key={`line-${lineIndex}`}>
              {line.parts.map((part, partIndex) => (
                <span
                  key={`${part.text}-${partIndex}`}
                  style={{
                    background: `linear-gradient(to right, ${part.colors.join(', ')})`,
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {part.text}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
