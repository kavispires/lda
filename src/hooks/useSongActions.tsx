import { useSongEditContext } from 'services/SongEditProvider';
import { Dictionary, Song, SongLine, SongPart, SongSection, UID, UpdateValue } from 'types';
import { distributor } from 'utils';

export function useSongActions() {
  const { setSong } = useSongEditContext();

  const onUpdateSong = <T extends keyof Song>(path: string, value: Song[T]) => {
    setSong((prev) => distributor.updateSong(prev!, path, value));
  };

  const onBatchUpdateSong = (updates: Dictionary<UpdateValue>) => {
    setSong((prev) => distributor.batchUpdateSong(prev!, updates));
  };

  const onUpdateSongContent = (id: UID, value: SongSection | SongLine | SongPart) => {
    setSong((prev) => distributor.updateSongContent(prev!, id, value));
  };

  const onAddNewPart = (lineId: UID) => {
    setSong((prev) => distributor.addNewPartToLine(prev!, lineId));
  };

  const onMovePart = (partId: UID, targetLineId: UID) => {
    setSong((prev) => distributor.movePart(prev!, partId, targetLineId));
  };

  const onMergeParts = (partIds: UID[]) => {
    setSong((prev) => distributor.mergeParts(prev!, partIds));
  };

  return {
    onUpdateSong,
    onUpdateSongContent,
    onBatchUpdateSong,
    onMovePart,
    onMergeParts,
    onAddNewPart,
    // onConnectPartToLine,
    // onConnectLineToSection,
    // onDisconnectPartFromLine,
    // onDisconnectLineFromSection,
  };
}
