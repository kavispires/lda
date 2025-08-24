import { useEffect, useRef } from 'react';

export const DISTRIBUTION_SCROLL_POSITION = 'DISTRIBUTION_SCROLL_POSITION';

/**
 * A hook that preserves scroll position when components remount or navigate.
 *
 * This hook stores the scroll position in both a ref and localStorage,
 * allowing the position to be restored when the component remounts or when
 * the user navigates back to the page.
 *
 * @template T - Type of the HTML element to track (extends HTMLElement)
 * @param storageKey - Optional unique identifier for the scroll position in localStorage
 *                    (defaults to 'scrollPosition')
 *
 * @returns A ref callback function that should be passed to the scrollable element's ref prop.
 *          The callback automatically restores the previous scroll position when the element mounts
 *          and sets up scroll tracking.
 */
export const usePreserveScrollPosition = <T extends HTMLElement>(
  storageKey: string = DISTRIBUTION_SCROLL_POSITION,
) => {
  const elementRef = useRef<T | null>(null);
  const scrollPositionRef = useRef(0);

  // Load initial scroll position from localStorage
  useEffect(() => {
    const savedPosition = localStorage.getItem(storageKey);
    if (savedPosition) {
      scrollPositionRef.current = Number(savedPosition);
    }
  }, [storageKey]);

  useEffect(() => {
    const handleScroll = () => {
      if (elementRef.current) {
        const position = elementRef.current.scrollTop;

        if (position > 0) {
          localStorage.setItem(storageKey, position.toString());
          scrollPositionRef.current = position;
        }
      }
    };

    const element = elementRef.current;
    if (element) {
      // Use passive: true for better scroll performance
      element.addEventListener('scroll', handleScroll, { passive: true });

      // Initialize with current position
      handleScroll();

      return () => {
        element.removeEventListener('scroll', handleScroll);
      };
    }
  }, [storageKey]);

  const setRef = (node: T | null) => {
    if (node) {
      node.scrollTop = scrollPositionRef.current || 0;
    }
    elementRef.current = node;
  };

  return setRef;
};
