import { useEffect, useRef } from 'react';
import { useQueryParams } from './useQueryParams';

export const usePreserveScrollPosition = <T extends HTMLElement>() => {
  const qp = useQueryParams();
  const elementRef = useRef<T | null>(null);
  const scrollPositionRef = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      if (elementRef.current) {
        qp.addParam('scroll', elementRef.current.scrollTop.toString());
        scrollPositionRef.current = elementRef.current.scrollTop;
      }
    };

    const element = elementRef.current;
    if (element) {
      element.addEventListener('scroll', handleScroll);
      return () => {
        element.removeEventListener('scroll', handleScroll);
      };
    }
  }, []);

  const setRef = (node: T | null) => {
    if (node) {
      node.scrollTop = scrollPositionRef.current || Number(qp.queryParams.get('scroll')) || 0;
    }
    elementRef.current = node;
  };

  return setRef;
};
