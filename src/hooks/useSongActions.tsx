import { App } from 'antd';
import { useSongEditContext } from 'services/SongEditProvider';
import type { Dictionary, Song, SongLine, SongPart, SongSection, UID, UpdateValue } from 'types';
import { distributor } from 'utils';

export function useSongActions() {
  const { notification } = App.useApp();
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

  const onAddNewLine = (sectionId: UID) => {
    setSong((prev) => distributor.addNewLineToSection(prev!, sectionId));
  };

  const onMovePart = (partId: UID, targetLineId: UID) => {
    setSong((prev) => distributor.movePart(prev!, partId, targetLineId));
  };

  const onMergeParts = (partIds: UID[]) => {
    setSong((prev) => distributor.mergeParts(prev!, partIds));
  };

  const onDeletePart = (partId: UID) => {
    try {
      setSong((prev) => distributor.deletePart(prev!, partId));
    } catch (e: unknown) {
      if (e instanceof Error) {
        notification.error({
          message: 'Could not delete part',
          description: e.message,
        });
        console.error(e);
      }
    }
  };

  const onConvertPartToNewLine = (partId: UID) => {
    try {
      setSong((prev) => distributor.convertPartToNewLine(prev!, partId));
    } catch (e: unknown) {
      if (e instanceof Error) {
        notification.error({
          message: 'Could not convert part to new line',
          description: e.message,
        });
        console.error(e);
      }
    }
  };

  const onDeleteLine = (lineId: UID) => {
    try {
      setSong((prev) => distributor.deleteLine(prev!, lineId));
    } catch (e: unknown) {
      if (e instanceof Error) {
        notification.error({
          message: 'Could not delete line',
          description: e.message,
        });
        console.error(e);
      }
    }
  };

  const onDeleteSection = (sectionId: UID) => {
    try {
      setSong((prev) => distributor.deleteSection(prev!, sectionId));
    } catch (e: unknown) {
      if (e instanceof Error) {
        notification.error({
          message: 'Could not delete section',
          description: e.message,
        });
      }
      console.error(e);
    }
  };

  return {
    onUpdateSong,
    onUpdateSongContent,
    onBatchUpdateSong,
    onMovePart,
    onMergeParts,
    onAddNewPart,
    onAddNewLine,
    onDeletePart,
    onDeleteLine,
    onDeleteSection,
    onConvertPartToNewLine,
  };
}
