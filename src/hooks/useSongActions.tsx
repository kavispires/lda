import { App } from 'antd';
import { useSongEditContext } from 'services/SongEditProvider';
import type { Dictionary, Song, SongLine, SongPart, SongSection, UID, UpdateValue } from 'types';
import { distributor } from 'utils';

export function useSongActions() {
  const { notification } = App.useApp();
  const { setSong } = useSongEditContext();

  const onUpdateSong = <T extends keyof Song>(path: string, value: Song[T]) => {
    setSong((prev) => {
      if (prev) {
        return distributor.updateSong(prev, path, value);
      }
      return prev;
    });
  };

  const onBatchUpdateSong = (updates: Dictionary<UpdateValue>) => {
    setSong((prev) => {
      if (prev) {
        return distributor.batchUpdateSong(prev, updates);
      }
      return prev;
    });
  };

  const onUpdateSongContent = (id: UID, value: SongSection | SongLine | SongPart) => {
    setSong((prev) => {
      if (prev) {
        return distributor.updateSongContent(prev, id, value);
      }
      return prev;
    });
  };

  const onAddNewPart = (lineId: UID) => {
    setSong((prev) => {
      if (prev) {
        return distributor.addNewPartToLine(prev, lineId);
      }
      return prev;
    });
  };

  const onAddNewTextAsPartsToLine = (lineId: UID, text: string[]) => {
    setSong((prev) => {
      if (prev) {
        return distributor.addNewTextAsPartsToLine(prev, lineId, text);
      }
      return prev;
    });
  };

  const onAddNewLine = (sectionId: UID) => {
    setSong((prev) => {
      if (prev) {
        return distributor.addNewLineToSection(prev, sectionId);
      }
      return prev;
    });
  };

  const onAddNewTextAsLinesToSection = (sectionId: UID, text: string[][]) => {
    setSong((prev) => {
      if (prev) {
        return distributor.addTextAsNewLinesToSection(prev, sectionId, text);
      }
      return prev;
    });
  };

  const onAddNewSection = (newSection?: SongSection) => {
    setSong((prev) => {
      if (prev) {
        return distributor.addNewSectionToSong(prev, newSection);
      }
      return prev;
    });
  };

  const onMovePartToLine = (partId: UID, targetLineId: UID) => {
    setSong((prev) => {
      if (prev) {
        return distributor.movePartToLine(prev, partId, targetLineId);
      }
      return prev;
    });
  };

  const onMovePartsTogether = (partIds: UID[]) => {
    setSong((prev) => {
      if (prev) {
        return distributor.movePartsTogether(prev, partIds);
      }
      return prev;
    });
  };

  const onMoveLinesToSection = (linesIds: UID[], targetSectionId: UID) => {
    setSong((prev) => {
      if (prev) {
        return distributor.moveLinesToSection(prev, linesIds, targetSectionId);
      }
      return prev;
    });
  };

  const onMergeParts = (partIds: UID[]) => {
    setSong((prev) => {
      if (prev) {
        return distributor.mergeParts(prev, partIds);
      }
      return prev;
    });
  };

  const onDeletePart = (partId: UID) => {
    try {
      setSong((prev) => {
        if (prev) {
          return distributor.deletePart(prev, partId);
        }
        return prev;
      });
    } catch (e: unknown) {
      if (e instanceof Error) {
        notification.error({
          message: 'Could not delete part',
          description: e.message,
        });
        // biome-ignore lint/suspicious/noConsole: on purpose
        console.error(e);
      }
    }
  };

  const onConvertPartToNewLine = (partId: UID) => {
    try {
      setSong((prev) => {
        if (prev) {
          return distributor.convertPartToNewLine(prev, partId);
        }
        return prev;
      });
    } catch (e: unknown) {
      if (e instanceof Error) {
        notification.error({
          message: 'Could not convert part to new line',
          description: e.message,
        });
        // biome-ignore lint/suspicious/noConsole: on purpose
        console.error(e);
      }
    }
  };

  const onDeleteLine = (lineId: UID) => {
    try {
      setSong((prev) => {
        if (prev) {
          return distributor.deleteLine(prev, lineId);
        }
        return prev;
      });
    } catch (e: unknown) {
      if (e instanceof Error) {
        notification.error({
          message: 'Could not delete line',
          description: e.message,
        });
        // biome-ignore lint/suspicious/noConsole: on purpose
        console.error(e);
      }
    }
  };

  const onMergeLines = (linesIds: UID[], shallow?: boolean) => {
    setSong((prev) => {
      if (prev) {
        return distributor.mergeLines(prev, linesIds, shallow);
      }
      return prev;
    });
  };

  const onDeleteSection = (sectionId: UID) => {
    try {
      setSong((prev) => {
        if (prev) {
          return distributor.deleteSection(prev, sectionId);
        }
        return prev;
      });
    } catch (e: unknown) {
      if (e instanceof Error) {
        notification.error({
          message: 'Could not delete section',
          description: e.message,
        });
      }
      // biome-ignore lint/suspicious/noConsole: on purpose
      console.error(e);
    }
  };

  const onNumberSections = () => {
    setSong((prev) => {
      if (prev) {
        return distributor.determineSectionsNumbering(prev);
      }
      return prev;
    });
  };

  const onMergeSections = (sectionIds: UID[]) => {
    setSong((prev) => {
      if (prev) {
        return distributor.mergeSections(prev, sectionIds);
      }
      return prev;
    });
  };

  return {
    onUpdateSong,
    onUpdateSongContent,
    onBatchUpdateSong,
    onAddNewPart,
    onAddNewLine,
    onAddNewSection,
    onConvertPartToNewLine,
    onDeletePart,
    onDeleteLine,
    onDeleteSection,
    onNumberSections,
    onMergeParts,
    onMergeSections,
    onMergeLines,
    onMoveLinesToSection,
    onMovePartToLine,
    onMovePartsTogether,
    onAddNewTextAsPartsToLine,
    onAddNewTextAsLinesToSection,
  };
}
