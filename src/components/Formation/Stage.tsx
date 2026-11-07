import { ArtistAvatar } from '@components/Artist';
import type { Artist, FormationPose } from '@types';
import { moveFormationDancers, STAGE_HEIGHT, STAGE_WIDTH } from '@utils/formation';
import clsx from 'clsx';
import { useLayoutEffect, useRef, useState } from 'react';
import './Stage.scss';

type StageProps = {
  positions: FormationPose;
  artists?: Record<string, Artist>;
  selected?: string[];
  onSelection?: (ids: string[]) => void;
  onMove?: (positions: FormationPose, moved: string[]) => void;
  onInvalid?: (error: string) => void;
  activeIds?: string[];
  halfSteps?: boolean;
  disabled?: boolean;
  fitViewport?: boolean;
  frontAtTop?: boolean;
};

export function Stage({
  positions,
  artists,
  selected = [],
  onSelection,
  onMove,
  onInvalid,
  activeIds = [],
  halfSteps = false,
  disabled = false,
  fitViewport = false,
  frontAtTop = false,
}: StageProps) {
  const stage = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = stage.current;
    if (!fitViewport || !element) return;
    let frame = 0;
    const measure = () => {
      let top = element.getBoundingClientRect().top + window.scrollY;
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (parent !== document.scrollingElement) top += parent.scrollTop;
      }
      const available = Math.max(8, window.innerHeight - Math.max(0, top) - 24);
      element.style.setProperty('--formation-stage-available-height', `${available}px`);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    let ancestor = element.parentElement;
    while (ancestor) {
      observer.observe(ancestor);
      ancestor = ancestor.parentElement;
    }
    window.addEventListener('resize', schedule);
    measure();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
    };
  }, [fitViewport]);
  const drag = useRef<{
    id: string;
    ids: string[];
    x: number;
    y: number;
    width: number;
    original: FormationPose;
  } | null>(null);
  const [preview, setPreview] = useState<FormationPose | null>(null);
  const displayed = preview ?? positions;
  const editable = !!onMove && !disabled;
  const step = halfSteps ? 0.5 : 1;
  const snapCoordinate = (value: number) => Math.round((value - 0.5) / step) * step + 0.5;
  const attempt = (ids: string[], dx: number, dy: number) => {
    try {
      onMove?.(moveFormationDancers(positions, ids, dx, dy), ids);
    } catch (error) {
      onInvalid?.(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div
      className={clsx(
        'formation-stage',
        !!onMove && 'formation-stage--grid',
        fitViewport && 'formation-stage--fit-viewport',
        frontAtTop && 'formation-stage--front-at-top',
      )}
      ref={stage}
    >
      <span className="formation-stage__back">BACK</span>
      {Object.entries(displayed).map(([id, pos]) => {
        const artist = artists?.[id];
        const label = artist?.name ?? id;
        const active = activeIds.includes(id);
        return (
          <button
            aria-label={`${label}${active ? ', singing' : ''}`}
            aria-pressed={editable ? selected.includes(id) : undefined}
            className={`formation-stage__dancer${selected.includes(id) ? ' formation-stage__dancer--selected' : ''}${active ? ' formation-stage__dancer--singing' : ''}`}
            disabled={!editable}
            key={id}
            onClick={(event) => {
              if (event.detail === 0 && editable)
                onSelection?.(event.shiftKey ? [...new Set([...selected, id])] : [id]);
            }}
            onKeyDown={(event) => {
              const directions: Record<string, [number, number]> = {
                ArrowLeft: [-1, 0],
                ArrowRight: [1, 0],
                ArrowUp: [0, -1],
                ArrowDown: [0, 1],
              };
              const direction = directions[event.key];
              if (!direction || !editable) return;
              event.preventDefault();
              const ids = selected.includes(id) ? selected : [id];
              onSelection?.(ids);
              const anchor = positions[id];
              attempt(
                ids,
                snapCoordinate(anchor.x + direction[0] * step) - anchor.x,
                snapCoordinate(anchor.y + direction[1] * step) - anchor.y,
              );
            }}
            onPointerCancel={() => {
              drag.current = null;
              setPreview(null);
            }}
            onPointerDown={(event) => {
              if (!editable || event.button !== 0 || !stage.current) return;
              const modifier = event.shiftKey || event.metaKey || event.ctrlKey;
              const ids = modifier
                ? selected.includes(id)
                  ? selected.filter((item) => item !== id)
                  : [...selected, id]
                : selected.includes(id)
                  ? selected
                  : [id];
              onSelection?.(ids);
              if (!ids.includes(id)) return;
              drag.current = {
                id,
                ids,
                x: event.clientX,
                y: event.clientY,
                width: stage.current.clientWidth,
                original: positions,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const current = drag.current;
              if (!current?.width) return;
              const anchor = current.original[current.id];
              const dx =
                snapCoordinate(anchor.x + ((event.clientX - current.x) / current.width) * STAGE_WIDTH) -
                anchor.x;
              const dy =
                snapCoordinate(anchor.y + ((event.clientY - current.y) / current.width) * STAGE_WIDTH) -
                anchor.y;
              setPreview(
                Object.fromEntries(
                  Object.entries(current.original).map(([key, position]) => [
                    key,
                    current.ids.includes(key) ? { x: position.x + dx, y: position.y + dy } : position,
                  ]),
                ),
              );
            }}
            onPointerUp={(event) => {
              const current = drag.current;
              if (!current) return;
              drag.current = null;
              const target = preview?.[current.id];
              if (target)
                attempt(
                  current.ids,
                  target.x - current.original[current.id].x,
                  target.y - current.original[current.id].y,
                );
              setPreview(null);
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            style={{
              left: `${(pos.x / STAGE_WIDTH) * 100}%`,
              top: `${(pos.y / STAGE_HEIGHT) * 100}%`,
              borderColor: artist?.color ?? '#64748b',
            }}
            title={`${label}: ${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}`}
            type="button"
          >
            {artist ? (
              <ArtistAvatar
                contestantImageId={artist.contestantImageId}
                draggable={false}
                id={id}
                name={label}
              />
            ) : (
              <span>{id}</span>
            )}
            <span className="formation-stage__label">{label}</span>
          </button>
        );
      })}
      <span className="formation-stage__front">FRONT / AUDIENCE</span>
    </div>
  );
}
