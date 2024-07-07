import { useSongEditContext } from 'services/SongEditProvider';
import { Song, SongLine, SongPart, SongSection, UID } from 'types';
import { distributor } from 'utils';

export function useSongActions() {
  const { setSong } = useSongEditContext();

  const onUpdateSong = <T extends keyof Song>(path: string, value: Song[T]) => {
    setSong((prev) => distributor.updateSong(prev!, path, value));
  };

  const onUpdateSongContent = (id: UID, value: SongSection | SongLine | SongPart) => {
    setSong((prev) => distributor.updateSongContent(prev!, id, value));
  };

  // const onConnectPartToLine = (partId: string, lineId: string) => {
  //   setSong((prev) => distributor.connectPartToLine(partId, lineId, prev!));
  // };

  // const onConnectLineToSection = (lineId: string, sectionId: string) => {
  //   setSong((prev) => distributor.connectLineToSection(lineId, sectionId, prev!));
  // };

  // const onDisconnectPartFromLine = (partId: string, lineId: string) => {
  //   setSong((prev) => distributor.disconnectPartFromLine(partId, lineId, prev!));
  // };

  // const onDisconnectLineFromSection = (lineId: string, sectionId: string) => {
  //   setSong((prev) => distributor.disconnectLineFromSection(lineId, sectionId, prev!));
  // };

  return {
    onUpdateSong,
    onUpdateSongContent,
    // onConnectPartToLine,
    // onConnectLineToSection,
    // onDisconnectPartFromLine,
    // onDisconnectLineFromSection,
  };
}
