import { ArtistAvatar } from 'components/Artist';
import { LyricSnapshot } from 'services/DistributionVisualizerProvider';
import { Distribution } from 'types';
import { ALL_ID, NONE_ID } from 'utils/constants';

type LyricBoxProps = {
  snapshot: LyricSnapshot;
  assignees: Distribution['assignees'];
};

export function LyricBox({ snapshot, assignees }: LyricBoxProps) {
  const isAllOrNone =
    snapshot.assigneesIds.length === 1 && [ALL_ID, NONE_ID].includes(snapshot.assigneesIds[0]);

  return (
    <div className="lyric-box">
      <div className="lyric-box__avatars">
        {snapshot.assigneesIds.map((assigneeId, index) => {
          const artist = assignees?.[assigneeId];

          return (
            <ArtistAvatar
              key={assigneeId}
              id={artist?.id ?? assigneeId}
              name={artist?.name ?? assigneeId}
              style={{
                border: `3px solid ${artist?.color ?? '#f1f1f1'}`,
                marginTop: `${index * -12}px`,
                zIndex: snapshot.assigneesIds.length - index,
                opacity: isAllOrNone ? 0 : 1,
              }}
              size="large"
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
          {snapshot.text.map((line, index) => (
            <div
              key={`${line}-${index}`}
              style={{
                background: `linear-gradient(180deg, ${snapshot.colors[index]})`,
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontStyle: isAllOrNone ? 'italic' : 'normal',
              }}
            >
              {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdlibBox({ snapshot, assignees }: LyricBoxProps) {
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
          {snapshot.text.map((line, index) => (
            <div
              key={`${line}-${index}`}
              style={{
                background: `linear-gradient(to right, ${snapshot.colors[index]})`,
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
