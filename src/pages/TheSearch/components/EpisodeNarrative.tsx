import { Button, Space, Tag, Typography } from 'antd';
import type { ReactNode } from 'react';
import type { AuditionReaction, EpisodeScene } from '../types/audition-episode';
import type { Contestant } from '../types/contestant';
import { selectAuditionHighlights } from '../utilities/audition-highlights';
import { ContestantAvatar } from './ContestantAvatar';
import { ValueChange } from './SimulationChange';

const gradeColors: Record<string, string> = {
  A: 'green',
  B: 'blue',
  C: 'gold',
  D: 'orange',
  F: 'red',
};

type NarrativeContestant = Pick<Contestant, 'id' | 'name'>;
const inlineTags = /<Tag>([^<>]+)<\/Tag>/gi;

function mentionPattern(names: readonly string[]): RegExp {
  const alternatives = [...names]
    .sort((a, b) => b.length - a.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  return new RegExp(`(?<![\\p{L}\\p{N}_])(?:${alternatives})(?![\\p{L}\\p{N}_])`, 'gu');
}

function narrativeMentions(
  text: string,
  contestants: readonly NarrativeContestant[],
  mentionedIds?: readonly string[],
) {
  const mentions: { index: number; contestant: NarrativeContestant }[] = [];
  const tags = [...text.matchAll(inlineTags)];
  const insideTag = (index: number) =>
    tags.some((tag) => index >= tag.index && index < tag.index + tag[0].length);
  if (mentionedIds) {
    let cursor = 0;
    for (const id of mentionedIds) {
      const contestant = contestants.find((entry) => entry.id === id);
      if (!contestant?.name) throw new Error(`Unknown narrative contestant "${id}".`);
      const pattern = mentionPattern([contestant.name]);
      pattern.lastIndex = cursor;
      let match = pattern.exec(text);
      while (match && insideTag(match.index)) match = pattern.exec(text);
      if (!match) throw new Error(`Narrative mention "${id}" does not match its recorded text.`);
      mentions.push({ index: match.index, contestant });
      cursor = match.index + match[0].length;
    }
  } else {
    const byName = new Map<string, NarrativeContestant[]>();
    for (const contestant of contestants) {
      if (!contestant.name.trim()) continue;
      const namesakes = byName.get(contestant.name) ?? [];
      namesakes.push(contestant);
      byName.set(contestant.name, namesakes);
    }
    const unambiguous = [...byName].filter(([, matches]) => matches.length === 1);
    if (unambiguous.length) {
      for (const match of text.matchAll(mentionPattern(unambiguous.map(([name]) => name)))) {
        if (insideTag(match.index)) continue;
        const contestant = byName.get(match[0])?.[0];
        if (contestant) mentions.push({ index: match.index, contestant });
      }
    }
  }
  return mentions;
}

export function EpisodeNarrative({
  text,
  contestants = [],
  onInspect,
  mentionedIds,
  showProtagonistAvatar = false,
}: {
  text: string;
  contestants?: readonly NarrativeContestant[];
  onInspect?: (id: string) => void;
  mentionedIds?: readonly string[];
  showProtagonistAvatar?: boolean;
}) {
  if (!onInspect || contestants.length === 0) return <NarrativeText text={text} />;
  const mentions = narrativeMentions(text, contestants, mentionedIds);
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const [index, mention] of mentions.entries()) {
    parts.push(<NarrativeText key={`text-${mention.index}`} text={text.slice(cursor, mention.index)} />);
    parts.push(
      <Button
        aria-label={`View ${mention.contestant.name}'s details`}
        data-contestant-id={mention.contestant.id}
        key={`person-${mention.index}`}
        onClick={() => onInspect(mention.contestant.id)}
        style={{ height: 'auto', padding: 0, fontWeight: 'inherit', verticalAlign: 'baseline' }}
        type="link"
      >
        {showProtagonistAvatar && index === 0 && (
          <ContestantAvatar
            alt={`Portrait of ${mention.contestant.name}`}
            enablePreview={false}
            id={mention.contestant.id}
            name={mention.contestant.name}
            size={28}
          />
        )}
        {mention.contestant.name}
      </Button>,
    );
    cursor = mention.index + mention.contestant.name.length;
  }
  parts.push(<NarrativeText key="remaining" text={text.slice(cursor)} />);
  return <>{parts}</>;
}

export function EpisodeContestantList({
  contestants,
  ids,
  onInspect,
}: {
  contestants: readonly NarrativeContestant[];
  ids: readonly string[];
  onInspect: (id: string) => void;
}) {
  const people = [...new Set(ids)].map((id) => {
    const contestant = contestants.find((entry) => entry.id === id);
    if (!contestant) throw new Error(`Unknown narrative contestant "${id}".`);
    return contestant;
  });
  const inline = people.length > 20;
  const buttons = people.map((contestant) => (
    <Button
      aria-label={`View ${contestant.name}'s details`}
      data-contestant-id={contestant.id}
      key={contestant.id}
      onClick={() => onInspect(contestant.id)}
      style={{ height: 'auto', padding: inline ? 0 : 8 }}
      type={inline ? 'link' : 'default'}
    >
      <ContestantAvatar
        alt={`Portrait of ${contestant.name}`}
        enablePreview={false}
        id={contestant.id}
        name={contestant.name}
        size={32}
      />
      {contestant.name}
    </Button>
  ));
  return inline ? (
    <ul aria-label="Contestant details">
      {buttons.map((button) => (
        <li key={button.key}>{button}</li>
      ))}
    </ul>
  ) : (
    <Space aria-label="Contestant details" role="group" wrap>
      {buttons}
    </Space>
  );
}

function NarrativeText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const tokens = new RegExp(
    `${/\bgraded\s+([ABCDF])\b|\b(composure|relationships?)\b|(-?\d+(?:\.\d+)?)\s*(?:\u2192|->)\s*(-?\d+(?:\.\d+)?)/.source}|${inlineTags.source}`,
    'gi',
  );
  let cursor = 0;
  for (const match of text.matchAll(tokens)) {
    parts.push(text.slice(cursor, match.index));
    if (match[5]) {
      parts.push(<Tag key={match.index}>{match[5]}</Tag>);
    } else if (match[1]) {
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
  contestants,
  onInspect,
  emphasizeMain = false,
}: {
  scene: EpisodeScene;
  reactions: readonly AuditionReaction[];
  contestants?: readonly NarrativeContestant[];
  onInspect?: (id: string) => void;
  emphasizeMain?: boolean;
}) {
  const reactionNotes = new Set(reactions.map((reaction) => reaction.narrative));
  const paragraphs = new Set(scene.paragraphs);
  const highlights = new Set(
    selectAuditionHighlights(reactions.filter((reaction) => paragraphs.has(reaction.narrative))).map(
      (reaction) => reaction.narrative,
    ),
  );
  const visible = scene.paragraphs.flatMap((paragraph, index) => {
    const reactionNote = scene.kind === 'auditions' && reactionNotes.has(paragraph);
    if (reactionNote) {
      if (!highlights.has(paragraph)) return [];
      highlights.delete(paragraph);
    }
    const isNote =
      reactionNote ||
      (emphasizeMain &&
        (/^Reaction:/i.test(paragraph) ||
          /\b(composure|relationship|coordination|practice)\b.*(?:→|->)/i.test(paragraph)));
    return [{ paragraph, index, isNote }];
  });
  const ids = [
    ...new Set([
      ...visible.flatMap(({ paragraph, index }) =>
        (contestants
          ? narrativeMentions(paragraph, contestants, scene.paragraphContestantIds?.[index])
          : []
        ).map(({ contestant }) => contestant.id),
      ),
      ...scene.contestantIds,
    ]),
  ];
  const inlinePortraits = scene.kind === 'ranking' || ids.length > 20;
  return (
    <>
      {visible.map(({ paragraph, index, isNote }) => (
        <Typography.Paragraph
          key={`${scene.id}-${index}`}
          role={isNote ? 'note' : undefined}
          strong={(scene.kind === 'auditions' || emphasizeMain) && !isNote}
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
          <EpisodeNarrative
            contestants={contestants}
            mentionedIds={scene.paragraphContestantIds?.[index]}
            onInspect={onInspect}
            showProtagonistAvatar={inlinePortraits}
            text={paragraph}
          />
        </Typography.Paragraph>
      ))}
      {!inlinePortraits && ids.length > 0 && contestants && onInspect && (
        <EpisodeContestantList contestants={contestants} ids={ids} onInspect={onInspect} />
      )}
    </>
  );
}
