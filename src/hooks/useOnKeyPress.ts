import { useEffect } from 'react';

/**
 * useKeyUp
 * @param keys - the name of the keys to respond to, compared against event.key
 * @param action - the action to perform on key up
 */
export function useKeyUp(keys: string[], action: (key: string) => void) {
  useEffect(() => {
    function onKeyup(e: KeyboardEvent) {
      if (keys.includes(e.key)) action(e.key);
    }
    window.addEventListener('keyup', onKeyup);
    return () => window.removeEventListener('keyup', onKeyup);
  }, []); // eslint-disable-line
}

/**
 * useKeyUp
 * @param keys - the name of the keys to respond to, compared against event.key
 * @param action - the action to perform on key down
 */
export function useKeyDown(keys: string[], action: (key: string) => void) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (keys.includes(e.key)) action(e.key);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []); // eslint-disable-line
}
