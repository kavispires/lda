import { Button, Typography } from 'antd';
import type { ReactNode } from 'react';
import type { SimulationState } from '../types/simulation';
import { ContestantAvatar } from './ContestantAvatar';
import styles from './NarrativeEpisodeView.module.scss';
import { PersonnelAvatar } from './personnel/PersonnelAvatar';

export function OpeningCredits({
  state,
  ids,
  onInspect,
}: {
  state: SimulationState;
  ids: readonly string[];
  onInspect: (id: string) => void;
}) {
  return (
    <div aria-label="Opening cast" className={styles.credits} role="group">
      {ids.map((id, index) => {
        const name = state.contestants.find((person) => person.id === id)?.name ?? id;
        return (
          <Button
            aria-label={`View ${name}'s details`}
            className={styles.credit}
            data-contestant-id={id}
            key={id}
            onClick={() => onInspect(id)}
            style={{ animationDelay: `${index * 160}ms` }}
            type="text"
          >
            <ContestantAvatar enablePreview={false} id={id} name={name} size={80} />
            <span>{name}</span>
          </Button>
        );
      })}
    </div>
  );
}

export function NarrativeStage({
  episode,
  title,
  eyebrow,
  speaker,
  speakerRole,
  children,
  footer,
}: {
  episode: number;
  title: string;
  eyebrow?: string;
  speaker?: string;
  speakerRole?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section aria-label={`Episode ${episode} narrative`} className={styles.stage}>
      <header className={styles.heading}>
        <span className={styles.eyebrow}>
          THE SEARCH / EPISODE {episode}
          {eyebrow ? ` / ${eyebrow}` : ''}
        </span>
        <Typography.Title level={2}>{title}</Typography.Title>
      </header>
      {speaker ? (
        <div className={styles.dialogue}>
          <div className={styles.speaker}>
            <PersonnelAvatar name={speaker} />
            <strong>{speaker}</strong>
            <small>{speakerRole}</small>
          </div>
          <div className={styles.bubble}>{children}</div>
        </div>
      ) : (
        <div className={styles.story}>{children}</div>
      )}
      {footer && <footer className={styles.footer}>{footer}</footer>}
    </section>
  );
}
