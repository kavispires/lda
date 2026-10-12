import { DatabaseFilled, MessageFilled, NotificationFilled } from '@ant-design/icons';
import type { Song, SongLine, SongPart, SongSection, UID } from '@types';
import { NULL } from '@utils/constants';

type NewSongQuickLogProps = {
  song: Song;
};
export function NewSongQuickLog({ song }: NewSongQuickLogProps) {
  return (
    <ul className="lyrics-quick-log">
      {song.sectionIds.map((sectionId) => {
        const section = song.content[sectionId] as SongSection;
        if (section.type !== 'section') return null;
        return (
          <SectionEntry
            content={song.content}
            key={section.id}
            kind={section.kind}
            linesIds={section.linesIds}
          />
        );
      })}
    </ul>
  );
}

type SectionEntryProps = {
  kind: string;
  linesIds: UID[];
  content: Song['content'];
};

function SectionEntry({ kind, linesIds, content }: SectionEntryProps) {
  return (
    <li className="lyrics-quick-log__section-entry">
      <span>
        <DatabaseFilled /> Section {kind && kind !== NULL ? kind : 'X'}
      </span>
      <ul className="lyrics-quick-log__lines">
        {linesIds.map((lineId) => {
          const line = content[lineId] as SongLine;
          if (line.type !== 'line') return null;
          return <LineEntry content={content} key={line.id} partsIds={line.partsIds} />;
        })}
      </ul>
    </li>
  );
}

type LineEntryProps = {
  partsIds: UID[];
  content: Song['content'];
};

function LineEntry({ partsIds, content }: LineEntryProps) {
  return (
    <li className="lyrics-quick-log__line-entry">
      <MessageFilled />
      <ul className="lyrics-quick-log__parts">
        {partsIds.map((partId) => {
          const part = content[partId] as SongPart;
          if (part.type !== 'part') return null;
          return <PartEntry key={part.id} text={part.text} />;
        })}
      </ul>
    </li>
  );
}

type PartEntryProps = {
  text: string;
};

function PartEntry({ text }: PartEntryProps) {
  return (
    <li className="lyrics-quick-log__part-entry">
      <NotificationFilled />
      {text}
    </li>
  );
}
