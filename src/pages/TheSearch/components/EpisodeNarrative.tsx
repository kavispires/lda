import { Tag, Typography } from 'antd';
import type { ReactNode } from 'react';
import type { AuditionReaction, EpisodeScene } from '../types/audition-episode';
import { selectAuditionHighlights } from '../utilities/audition-highlights';
import { ValueChange } from './SimulationChange';

const gradeColors: Record<string, string> = {
  A: 'green',
  B: 'blue',
  C: 'gold',
  D: 'orange',
  F: 'red',
};

export function EpisodeNarrative({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const tokens =
    /\bgraded\s+([ABCDF])\b|\b(composure|relationships?)\b|(-?\d+(?:\.\d+)?)\s*(?:\u2192|->)\s*(-?\d+(?:\.\d+)?)/gi;
  let cursor = 0;
  for (const match of text.matchAll(tokens)) {
    parts.push(text.slice(cursor, match.index));
    if (match[1]) {
      parts.push(
        <Tag color={gradeColors[match[1].toUpperCase()]} key={match.index}>
          {match[0]}
        </Tag>,
      );
    } else if (match[2]) {
      parts.push(
        <Tag color={match[2].toLowerCase() === 'composure' ? 'purple' : 'cyan'} key={match.index}>
          {match[0]}
        </Tag>,
      );
    } else {
      parts.push(<ValueChange after={Number(match[4])} before={Number(match[3])} key={match.index} />);
    }
    cursor = match.index + match[0].length;
  }
  parts.push(text.slice(cursor));
  return <>{parts}</>;
}

export function EpisodeSceneNarrative({
  scene,
  reactions,
}: {
  scene: EpisodeScene;
  reactions: readonly AuditionReaction[];
}) {
  const reactionNotes = new Set(reactions.map((reaction) => reaction.narrative));
  const paragraphs = new Set(scene.paragraphs);
  const highlights = new Set(
    selectAuditionHighlights(reactions.filter((reaction) => paragraphs.has(reaction.narrative))).map(
      (reaction) => reaction.narrative,
    ),
  );
  return (
    <>
      {scene.paragraphs.map((paragraph, index) => {
        const isNote = scene.kind === 'auditions' && reactionNotes.has(paragraph);
        if (isNote) {
          if (!highlights.has(paragraph)) return null;
          highlights.delete(paragraph);
        }
        return (
          <Typography.Paragraph
            key={`${scene.id}-${index}`}
            role={isNote ? 'note' : undefined}
            strong={scene.kind === 'auditions' && !isNote}
            style={
              isNote
                ? {
                    marginInlineStart: 24,
                    paddingInlineStart: 12,
                    borderInlineStart: '2px solid #d9d9d9',
                    fontSize: 13,
                    marginBottom: 8,
                  }
                : undefined
            }
            type={isNote ? 'secondary' : undefined}
          >
            <EpisodeNarrative text={paragraph} />
          </Typography.Paragraph>
        );
      })}
    </>
  );
}
