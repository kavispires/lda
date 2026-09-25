import type { Song, UID } from '@types';
import { distributor } from '@utils';
import { SECTION_KINDS } from '@utils/constants';

/**
 * Song section "kind" suggestion engine.
 *
 * Implements a weighted scoring model for recommending section kinds: Markov-style
 * forward transitions, positional guards, bidirectional (infill) awareness, in-song
 * transition history, and light genre nudges. Section numbers referenced in comments
 * below (§2, §3, §4, §5) map to the original design spec's structure.
 */

const {
  VERSE,
  PRE_CHORUS,
  CHORUS,
  BRIDGE,
  INTRO,
  OUTRO,
  BREAK,
  DANCE_BREAK,
  DROP,
  HOOK,
  INSTRUMENT_SOLO,
  POST_CHORUS,
  RAP,
  SPECIAL,
  ASIDE,
  INTERLUDE,
} = SECTION_KINDS;

/** Sentinel key for the "start of song" row of the transition table. */
const START = 'START';

/**
 * §2 Core Transition Rules (Markov Baseline) — ranked forward transitions per preceding
 * section kind. `OUTRO` is terminal (no forward suggestions).
 */
const FORWARD_TRANSITIONS: Record<string, string[]> = {
  [START]: [INTRO, VERSE, CHORUS, HOOK],
  [INTRO]: [VERSE, CHORUS, HOOK],
  [VERSE]: [PRE_CHORUS, CHORUS, HOOK, RAP, VERSE],
  [PRE_CHORUS]: [CHORUS, HOOK, DROP],
  [CHORUS]: [POST_CHORUS, VERSE, HOOK, BRIDGE, BREAK],
  [POST_CHORUS]: [VERSE, BRIDGE, BREAK, DANCE_BREAK],
  [BRIDGE]: [CHORUS, HOOK, OUTRO],
  [DROP]: [VERSE, BRIDGE, CHORUS, BREAK, OUTRO],
  [DANCE_BREAK]: [VERSE, BRIDGE, CHORUS, BREAK, OUTRO],
  [RAP]: [CHORUS, HOOK, VERSE, OUTRO],
  [BREAK]: [VERSE, CHORUS, BRIDGE],
  [INTERLUDE]: [VERSE, CHORUS, BRIDGE],
  [INSTRUMENT_SOLO]: [CHORUS, BRIDGE, OUTRO],
  [HOOK]: [VERSE, CHORUS, POST_CHORUS, RAP],
  [OUTRO]: [],
};

/**
 * Fallback candidate pool used to fill out the scoring pass, excluding kinds that aren't
 * meaningful suggestions on their own (`NULL`/`UNKNOWN`).
 */
const FALLBACK_CANDIDATES: string[] = Object.values(SECTION_KINDS).filter(
  (kind) => kind !== SECTION_KINDS.UNKNOWN,
);

/** §5 Scoring & Ranking Algorithm weights. */
const WEIGHTS = {
  MARKOV_BASELINE: 30,
  HISTORICAL_MATCH: 40,
  BIDIRECTIONAL_COMPATIBILITY: 35,
  SELF_REPEAT_BONUS: 15,
  CONSTRAINT_VIOLATION: -100,
  GENRE_NUDGE: 10,
  STRUCTURAL_END_BONUS: 40,
};

type SuggestionContext = {
  index: number;
  prevKind: string | null;
  nextKind: string | null;
  /** (kindA, kindB) pairs from consecutive sections elsewhere in the song (§4.1/§4.2). */
  adjacentPairs: Array<[string, string]>;
  hasBridge: boolean;
  hasDropOrDanceBreak: boolean;
  /** Whether a CHORUS, HOOK, or VERSE has already appeared before this section (§3.2). */
  hasEstablishedBeforeOutro: boolean;
  /** Whether the two sections immediately before this one are already the same kind. */
  isAlreadyTwoInARow: boolean;
};

const getKind = (sectionId: UID, song: Song): string => distributor.getSection(sectionId, song).kind;

const buildContext = (song: Song, currentSectionId: UID, index: number): SuggestionContext => {
  const { sectionIds } = song;

  const prevId = index > 0 ? sectionIds[index - 1] : undefined;
  const nextId = index >= 0 ? sectionIds[index + 1] : undefined;
  const prevPrevId = index > 1 ? sectionIds[index - 2] : undefined;

  const prevKind = prevId ? getKind(prevId, song) : null;
  const nextKind = nextId ? getKind(nextId, song) : null;
  const prevPrevKind = prevPrevId ? getKind(prevPrevId, song) : null;

  const historyKinds = sectionIds.filter((id) => id !== currentSectionId).map((id) => getKind(id, song));

  const adjacentPairs: Array<[string, string]> = [];
  for (let i = 0; i < sectionIds.length - 1; i++) {
    if (sectionIds[i] === currentSectionId || sectionIds[i + 1] === currentSectionId) continue;
    adjacentPairs.push([getKind(sectionIds[i], song), getKind(sectionIds[i + 1], song)]);
  }

  const kindsBeforeCurrent = sectionIds
    .slice(0, Math.max(index, 0))
    .filter((id) => id !== currentSectionId)
    .map((id) => getKind(id, song));

  return {
    index,
    prevKind,
    nextKind,
    adjacentPairs,
    hasBridge: historyKinds.includes(BRIDGE),
    hasDropOrDanceBreak: historyKinds.includes(DROP) || historyKinds.includes(DANCE_BREAK),
    hasEstablishedBeforeOutro: kindsBeforeCurrent.some(
      (kind) => kind === VERSE || kind === CHORUS || kind === HOOK,
    ),
    isAlreadyTwoInARow: !!prevKind && prevKind === prevPrevKind,
  };
};

/**
 * §3 Infill / Bidirectional Awareness — promoted kinds for a given (prev, next) sandwich,
 * and whether that promotion is allowed to bypass the "only one BRIDGE" quota.
 */
const getBidirectionalPromotions = (
  prevKind: string | null,
  nextKind: string | null,
): { promoted: Set<string>; bridgeQuotaBypass: Set<string> } => {
  const promoted = new Set<string>();
  const bridgeQuotaBypass = new Set<string>();

  if (prevKind === VERSE && nextKind === CHORUS) {
    promoted.add(PRE_CHORUS);
  } else if (prevKind === CHORUS && nextKind === VERSE) {
    promoted.add(POST_CHORUS);
    promoted.add(BREAK);
  } else if (prevKind === CHORUS && nextKind === OUTRO) {
    promoted.add(BRIDGE);
    promoted.add(CHORUS);
    bridgeQuotaBypass.add(BRIDGE);
  }

  return { promoted, bridgeQuotaBypass };
};

const getForwardTransitions = (ctx: SuggestionContext): string[] => {
  if (ctx.prevKind) return FORWARD_TRANSITIONS[ctx.prevKind] ?? [];
  if (ctx.index === 0) return FORWARD_TRANSITIONS[START];
  return [];
};

type ScoredCandidate = { kind: string; score: number; excluded: boolean };

const scoreCandidate = (
  kind: string,
  ctx: SuggestionContext,
  forwardTransitions: string[],
  bidirectional: { promoted: Set<string>; bridgeQuotaBypass: Set<string> },
): ScoredCandidate => {
  let score = 0;
  let excluded = false;

  // Markov baseline (§2)
  if (forwardTransitions.includes(kind)) {
    score += WEIGHTS.MARKOV_BASELINE;
  }

  // Song Historical Match (§4.1 Local Transition Memory)
  if (ctx.prevKind && ctx.adjacentPairs.some(([a, b]) => a === ctx.prevKind && b === kind)) {
    score += WEIGHTS.HISTORICAL_MATCH;
  }

  // Bidirectional Compatibility (§3 Infill)
  if (bidirectional.promoted.has(kind)) {
    score += WEIGHTS.BIDIRECTIONAL_COMPATIBILITY;
  }

  // Structural End-of-Song bonus: this section has no section after it, so OUTRO is a
  // strong contextual fit regardless of whether the preceding kind's transition row
  // happens to list it (§2/§3 — a song's final section should reliably surface OUTRO).
  if (kind === OUTRO && ctx.nextKind === null) {
    score += WEIGHTS.STRUCTURAL_END_BONUS;
  }

  // Self-Repeat Bonus, capped at 2 consecutive identical suggestions (§3 item 4)
  if (kind === ctx.prevKind) {
    if (ctx.isAlreadyTwoInARow) {
      score += WEIGHTS.CONSTRAINT_VIOLATION;
    } else {
      score += WEIGHTS.SELF_REPEAT_BONUS;
    }
  }

  // Positional Guards (§3)
  if (kind === INTRO && ctx.index > 1) {
    excluded = true;
  }
  if (kind === OUTRO && (ctx.index < 2 || !ctx.hasEstablishedBeforeOutro)) {
    excluded = true;
  }
  if (kind === BRIDGE && ctx.hasBridge && !bidirectional.bridgeQuotaBypass.has(kind)) {
    excluded = true;
  }

  // Genre & Style Clues (§4.3)
  if (ctx.hasDropOrDanceBreak) {
    if (kind === DROP || kind === DANCE_BREAK || kind === BREAK) {
      score += WEIGHTS.GENRE_NUDGE;
    }
    if (kind === INSTRUMENT_SOLO) {
      score -= WEIGHTS.GENRE_NUDGE;
    }
  }

  return { kind, score, excluded };
};

/** Safety fallback used when the current section can't be located in the song. */
const SAFE_DEFAULT_SUGGESTIONS = [VERSE, PRE_CHORUS, CHORUS, HOOK, BRIDGE];

/**
 * Returns the top-ranked section kind suggestions for the section identified by
 * `currentSectionId`, per the weighted scoring model in
 * `song_section_suggestion_engine_rules.md`.
 */
export const getSectionKindSuggestions = (song: Song, currentSectionId: UID, limit = 5): string[] => {
  const index = song.sectionIds.indexOf(currentSectionId);

  if (index === -1) return SAFE_DEFAULT_SUGGESTIONS.slice(0, limit);

  const ctx = buildContext(song, currentSectionId, index);
  const forwardTransitions = getForwardTransitions(ctx);
  const bidirectional = getBidirectionalPromotions(ctx.prevKind, ctx.nextKind);

  const candidates = new Set<string>([
    ...forwardTransitions,
    ...bidirectional.promoted,
    ...FALLBACK_CANDIDATES,
  ]);
  // Exclude the two "special case" kinds from the low-priority fallback pool entirely
  // (they should only ever be suggested via explicit transitions, never as filler).
  candidates.delete(SPECIAL);
  candidates.delete(ASIDE);
  if (forwardTransitions.includes(SPECIAL) || bidirectional.promoted.has(SPECIAL)) candidates.add(SPECIAL);
  if (forwardTransitions.includes(ASIDE) || bidirectional.promoted.has(ASIDE)) candidates.add(ASIDE);

  const scored = Array.from(candidates)
    .map((kind) => scoreCandidate(kind, ctx, forwardTransitions, bidirectional))
    .filter((candidate) => !candidate.excluded)
    .sort((a, b) => b.score - a.score);

  const positiveOnly = scored.filter((candidate) => candidate.score > 0);
  const ranked = positiveOnly.length > 0 ? positiveOnly : scored;

  return ranked.slice(0, limit).map((candidate) => candidate.kind);
};
