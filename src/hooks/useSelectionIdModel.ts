import { useCallback, useState } from 'react';
import { UID } from 'types';
import { removeDuplicates } from 'utils';

export type SelectionIdModel = {
  selection: UID[];
  onSelect: (id: UID) => void;
  onSelectMany: (ids: UID[]) => void;
  onDeselectAll: () => void;
};

export function useSelectionIdModel(initialSelection: UID[] = []): SelectionIdModel {
  const [selection, setSelection] = useState<UID[]>(initialSelection);

  const onSelect = useCallback(
    (id: UID) => {
      if (selection.includes(id)) {
        setSelection(selection.filter((selectedId) => selectedId !== id));
        return;
      }

      if (selection.length === 0) {
        setSelection([id]);
        return;
      }

      if (selection[0][1] === id[1]) {
        setSelection((prevSelection) => [...prevSelection, id]);
        return;
      }

      setSelection([id]);
    },
    [selection]
  );

  const onSelectMany = useCallback(
    (ids: UID[]) => {
      if (selection.length === 0) {
        setSelection([...ids]);
        return;
      }

      if (selection[0][1] === ids[0][1]) {
        setSelection((prevSelection) => removeDuplicates([...prevSelection, ...ids]));
        return;
      }
    },
    [selection]
  );

  const onDeselectAll = () => setSelection([]);

  return {
    selection,
    onSelect,
    onSelectMany,
    onDeselectAll,
  };
}
