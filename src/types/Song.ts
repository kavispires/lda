import type { FUID, RecordTimestamps, UID } from './common';

export type Song = {
  /**
   * Unique identifier
   */
  id: FUID;
  /**
   * The type of the entity
   */
  type: 'song';
  /**
   * The title of the song
   */
  title: string;
  /**
   * The version of the song (acoustic, remix, etc.)
   */
  version?: string;
  /**
   * The Youtube video id
   */
  videoId: string;
  /**
   * The original artist of the song
   */
  originalArtist: string;
  /**
   * The start of the song in milliseconds
   * In case the video has an intro
   */
  startAt: number;
  /**
   * The end of the song in milliseconds
   * In case the video has an outro
   */
  endAt: number;
  /**
   * Ordered section ids
   */
  sectionIds: UID[];
  /**
   * Collection of sections, lines, and parts of the song
   */
  content: Record<UID, SongSection | SongLine | SongPart>;
  /**
   * Additional metadata
   */
  metadata?: {
    /**
     * The key/scale of the song
     */
    key: string;
    /**
     * The tempo of the song in BPM
     */
    tempo: number;
    /**
     * The genre of the song
     */
    genre: string;
    /**
     * The style of the song
     */
    style: string;
  };
  /**
   * If every part has a part, this song can be distributed
   */
  ready: boolean;
} & RecordTimestamps;

export type FirestoreSong = Omit<Song, 'content'> & {
  content: string;
};

export type SongSection = {
  /**
   * Unique identifier
   */
  id: UID;
  /**
   * The type of the entity
   */
  type: 'section';
  /**
   * The kind of the section (verse, chorus, etc.)
   */
  kind: string;
  /**
   * The number identifier of the section (used to differentiate between sections of the same kind)
   * Value as a number has been deprecated but is still supported for backward compatibility
   */
  number: number | string;
  /**
   * Ordered line ids
   */
  linesIds: UID[];
};

export type SongLine = {
  /**
   * Unique identifier
   */
  id: UID;
  /**
   * The type of the entity
   */
  type: 'line';
  /**
   * Flag indicating if the line is dismissible (not displayed during a distribution) - Usually used for effects or vocalizing
   */
  dismissible?: boolean;
  /**
   * Flag indicating if the line is an adlib
   */
  adlib?: boolean;
  /**
   * Ordered part ids
   */
  partsIds: UID[];
  /**
   * Additional metadata
   */
  skill?: {
    /**
     * The type of the skill (vocal, rap, choir)
     */
    type: string;
    /**
     * The level of the skill (beginner, intermediate, advanced)
     */
    level: number;
  };
  /**
   * The section id this line belongs to
   */
  sectionId: UID;
};

export type SongPart = {
  /**
   * Unique identifier
   */
  id: UID;
  /**
   * The type of the entity
   */
  type: 'part';
  /**
   * The text of the part
   */
  text: string;
  /**
   * The start time of the part in milliseconds
   */
  startTime: number;
  /**
   * The end time of the part in milliseconds
   */
  endTime: number;
  /**
   * The recommended assignee of the part
   */
  recommendedAssignee: FUID;
  /**
   * The line id this part belongs to
   */
  lineId: UID;
};

export type UpdateValue = Song[keyof Song] | SongPart | SongLine | SongSection;
