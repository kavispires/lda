import { useState } from 'react';
import { UID } from 'types';
import { removeDuplicates } from 'utils';

export function useSelectionIdModel(initialSelection: UID[] = []) {
  const [selection, setSelection] = useState<UID[]>(initialSelection);

  const onSelect = (id: UID) => {
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
  };

  const onSelectMany = (ids: UID[]) => {
    if (selection.length === 0) {
      setSelection([...ids]);
      return;
    }

    if (selection[0][1] === ids[0][1]) {
      setSelection((prevSelection) => removeDuplicates([...prevSelection, ...ids]));
      return;
    }
  };

  const onDeselectAll = () => setSelection([]);

  return {
    selection,

    onSelect,
    onSelectMany,
    onDeselectAll,
  };
}
