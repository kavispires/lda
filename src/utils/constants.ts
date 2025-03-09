import type { Dictionary } from 'types';

export const NULL = 'NULL';
export const DEFAULT_ASSIGNEE = 'X';
export const ROMAN_NUMERALS: string[] = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
export const ALL_ID = 'ALL';
export const NONE_ID = 'NONE';

export const ASSIGNEE: Dictionary<string> = {
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
  E: 'E',
  F: 'F',
  G: 'G',
  H: 'H',
  I: 'I',
};

export const ASSIGNEES: Dictionary<{ label: string; value: string; color: string }> = {
  A: {
    label: 'VOCALS 1',
    value: 'A',
    color: '#fec891',
  },
  B: {
    label: 'VOCALS 2',
    value: 'B',
    color: '#ffef99',
  },
  C: {
    label: 'RAP 1',
    value: 'C',
    color: '#c3f0c7',
  },
  D: {
    label: 'RAP 2',
    value: 'D',
    color: '#b6e4e2',
  },
  E: {
    label: 'AD-LIB 1',
    value: 'E',
    color: '#a5c2fe',
  },
  F: {
    label: 'AD-LIB 2',
    value: 'F',
    color: '#e19e9e',
  },
  G: {
    label: 'ALL',
    value: 'G',
    color: '#d8d2f9',
  },
  H: {
    label: 'NONE',
    value: 'H',
    color: '#b7bccc',
  },
  I: {
    label: 'CENTER',
    value: 'I',
    color: '#fee6fb',
  },
  X: {
    label: 'UNASSIGNED',
    value: 'X',
    color: '#dee0e7',
  },
  NULL: {
    label: 'UNASSIGNED',
    value: 'X',
    color: '#dee0e7',
  },
};

export const LINE_SKILL = {
  VOCAL: 'VOCAL',
  RAP: 'RAP',
  AD_LIB: 'AD_LIB',
  CHOIR: 'CHOIR',
  EFFECT: 'EFFECT',
};

export const SECTION_KINDS = {
  VERSE: 'VERSE',
  PRE_CHORUS: 'PRE_CHORUS',
  CHORUS: 'CHORUS',
  BRIDGE: 'BRIDGE',
  INTRO: 'INTRO',
  OUTRO: 'OUTRO',
  BREAK: 'BREAK',
  DANCE_BREAK: 'DANCE_BREAK',
  DROP: 'DROP',
  HOOK: 'HOOK',
  INSTRUMENT_SOLO: 'INSTRUMENT_SOLO',
  POST_CHORUS: 'POST_CHORUS',
  RAP: 'RAP',
  SPECIAL: 'SPECIAL',
  UNKNOWN: 'UNKNOWN',
};

export const DURATION_FORMAT = 'mm:ss';
