import { useReducer, useState } from 'react';

type History<T> = { past: T[]; present: T; future: T[] };
type Action<T> = { type: 'edit' | 'reset'; value: T } | { type: 'undo' | 'redo' };

function reduce<T>(state: History<T>, action: Action<T>): History<T> {
  if (action.type === 'reset') return { past: [], present: action.value, future: [] };
  if (action.type === 'edit') {
    if (JSON.stringify(state.present) === JSON.stringify(action.value)) return state;
    return { past: [...state.past, state.present], present: action.value, future: [] };
  }
  if (action.type === 'undo' && state.past.length) {
    return {
      past: state.past.slice(0, -1),
      present: state.past[state.past.length - 1],
      future: [state.present, ...state.future],
    };
  }
  if (action.type === 'redo' && state.future.length) {
    return { past: [...state.past, state.present], present: state.future[0], future: state.future.slice(1) };
  }
  return state;
}

export function useEditHistory<T>(initial: T, saved: T = initial) {
  const [history, dispatch] = useReducer(reduce<T>, { past: [], present: initial, future: [] });
  const [baseline, setBaseline] = useState(JSON.stringify(saved));
  return {
    value: history.present,
    dirty: JSON.stringify(history.present) !== baseline,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    edit: (value: T) => dispatch({ type: 'edit', value }),
    undo: () => dispatch({ type: 'undo' }),
    redo: () => dispatch({ type: 'redo' }),
    markSaved: (value: T) => {
      setBaseline(JSON.stringify(value));
      dispatch({ type: 'reset', value });
    },
  };
}
