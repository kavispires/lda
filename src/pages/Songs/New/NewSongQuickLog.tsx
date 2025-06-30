import { DatabaseFilled, MessageFilled, NotificationFilled } from '@ant-design/icons';
import type { Song, SongLine, SongPart, SongSection, UID } from 'types';

type NewSongQuickLogProps = {
  song: Song;
};
export function NewSongQuickLog({ song }: NewSongQuickLogProps) {
  return (
    <ul className="lyrics-quick-log">
      {song.sectionIds.map((sectionId) => {
        const section = song.content[sectionId] as SongSection;
        if (section.type !== 'section') return null;
        return <SectionEntry key={section.id} linesIds={section.linesIds} content={song.content} />;
      })}
    </ul>
  );
}

type SectionEntryProps = {
  linesIds: UID[];
  content: Song['content'];
};

function SectionEntry({ linesIds, content }: SectionEntryProps) {
  return (
    <li className="lyrics-quick-log__section-entry">
      <span>
        <DatabaseFilled /> Section X
      </span>
      <ul className="lyrics-quick-log__lines">
        {linesIds.map((lineId) => {
          const line = content[lineId] as SongLine;
          if (line.type !== 'line') return null;
          return <LineEntry key={line.id} partsIds={line.partsIds} content={content} />;
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
