import { Card, Progress, Space, Typography } from 'antd';
import type { Contestant } from '../types/contestant';

type ContestantStatsProps = {
  existingContestants: Contestant[];
  currentContestant?: Partial<Contestant>;
};

/**
 * Displays statistics and percentages for all contestant attributes
 */
export function ContestantStats({ existingContestants, currentContestant }: ContestantStatsProps) {
  const total = existingContestants.length;

  if (total === 0) {
    return (
      <Card size="small" style={{ marginBottom: '1rem' }} title="📊 Contestant Statistics">
        <Typography.Text type="secondary">No contestants created yet. You'll be the first!</Typography.Text>
      </Card>
    );
  }

  // Track statistics
  const trackCounts = {
    VOCAL: existingContestants.filter((c) => c.track === 'VOCAL').length,
    RAP: existingContestants.filter((c) => c.track === 'RAP').length,
    DANCE: existingContestants.filter((c) => c.track === 'DANCE').length,
  };

  // Grade statistics
  const gradeCounts = {
    A: existingContestants.filter((c) => c.grade === 'A').length,
    B: existingContestants.filter((c) => c.grade === 'B').length,
    C: existingContestants.filter((c) => c.grade === 'C').length,
    D: existingContestants.filter((c) => c.grade === 'D').length,
    F: existingContestants.filter((c) => c.grade === 'F').length,
  };

  // Specialty statistics (only count non-empty values)
  const vocalColorCounts: Record<string, number> = {};
  const danceStyleCounts: Record<string, number> = {};
  const rapStyleCounts: Record<string, number> = {};
  const visualVibeCounts: Record<string, number> = {};

  for (const contestant of existingContestants) {
    if (contestant.specialties.vocalColor) {
      vocalColorCounts[contestant.specialties.vocalColor] =
        (vocalColorCounts[contestant.specialties.vocalColor] || 0) + 1;
    }
    if (contestant.specialties.danceStyle) {
      danceStyleCounts[contestant.specialties.danceStyle] =
        (danceStyleCounts[contestant.specialties.danceStyle] || 0) + 1;
    }
    if (contestant.specialties.rapStyle) {
      rapStyleCounts[contestant.specialties.rapStyle] =
        (rapStyleCounts[contestant.specialties.rapStyle] || 0) + 1;
    }
    if (contestant.specialties.visualVibe) {
      visualVibeCounts[contestant.specialties.visualVibe] =
        (visualVibeCounts[contestant.specialties.visualVibe] || 0) + 1;
    }
  }

  const renderStatRow = (label: string, count: number, highlight = false) => (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.25rem 0',
        fontWeight: highlight ? 'bold' : 'normal',
        backgroundColor: highlight ? '#f0f0f0' : 'transparent',
        paddingLeft: highlight ? '0.5rem' : 0,
        paddingRight: highlight ? '0.5rem' : 0,
        borderRadius: '4px',
      }}
    >
      <Typography.Text style={{ fontSize: '0.85rem' }}>{label}</Typography.Text>
      <Space size="small">
        <Typography.Text style={{ fontSize: '0.85rem' }}>{count}</Typography.Text>
        <Progress
          percent={Math.round((count / total) * 100)}
          showInfo={false}
          size="small"
          strokeColor={highlight ? '#1890ff' : undefined}
          style={{ width: '60px' }}
        />
        <Typography.Text style={{ fontSize: '0.75rem', color: '#999', width: '35px', textAlign: 'right' }}>
          {Math.round((count / total) * 100)}%
        </Typography.Text>
      </Space>
    </div>
  );

  const renderSpecialtyStats = (title: string, counts: Record<string, number>, currentValue?: string) => {
    const entries = Object.entries(counts);
    if (entries.length === 0) {
      return null;
    }

    return (
      <div style={{ marginTop: '1rem' }}>
        <Typography.Text strong style={{ fontSize: '0.9rem' }}>
          {title}
        </Typography.Text>
        {entries
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([key, count]) => (
            <div key={key}>{renderStatRow(key, count, currentValue === key)}</div>
          ))}
      </div>
    );
  };

  return (
    <Card size="small" style={{ marginBottom: '1rem' }} title={`📊 Statistics (${total} contestants)`}>
      <div>
        <Typography.Text strong>Track Distribution</Typography.Text>
        {renderStatRow('Vocal', trackCounts.VOCAL, currentContestant?.track === 'VOCAL')}
        {renderStatRow('Rap', trackCounts.RAP, currentContestant?.track === 'RAP')}
        {renderStatRow('Dance', trackCounts.DANCE, currentContestant?.track === 'DANCE')}
      </div>

      <div style={{ marginTop: '1rem' }}>
        <Typography.Text strong>Grade Distribution</Typography.Text>
        {renderStatRow('A', gradeCounts.A, currentContestant?.grade === 'A')}
        {renderStatRow('B', gradeCounts.B, currentContestant?.grade === 'B')}
        {renderStatRow('C', gradeCounts.C, currentContestant?.grade === 'C')}
        {renderStatRow('D', gradeCounts.D, currentContestant?.grade === 'D')}
        {renderStatRow('F', gradeCounts.F, currentContestant?.grade === 'F')}
      </div>

      {renderSpecialtyStats('Top Vocal Colors', vocalColorCounts, currentContestant?.specialties?.vocalColor)}
      {renderSpecialtyStats('Top Dance Styles', danceStyleCounts, currentContestant?.specialties?.danceStyle)}
      {renderSpecialtyStats('Top Rap Styles', rapStyleCounts, currentContestant?.specialties?.rapStyle)}
      {renderSpecialtyStats('Top Visual Vibes', visualVibeCounts, currentContestant?.specialties?.visualVibe)}
    </Card>
  );
}
