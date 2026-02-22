import moment from 'moment';

type TimestampProps = {
  timestamp?: number;
};

export function Timestamp({ timestamp }: TimestampProps) {
  // If timestamp is 0 or undefined, display mdash
  if (!timestamp || timestamp === 0) {
    return <span>—</span>;
  }

  const now = moment();
  const timestampMoment = moment(timestamp);
  const daysDifference = now.diff(timestampMoment, 'days');

  // If within 10 days, show 'ago' format
  if (daysDifference <= 10 && daysDifference >= 0) {
    return <span>{timestampMoment.fromNow()}</span>;
  }

  // Otherwise, show formatted date
  return <span>{timestampMoment.format('YYYY-MM-DD HH:mm')}</span>;
}
