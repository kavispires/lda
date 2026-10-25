import identity from '../data/identity-cards.json';
import interest from '../data/interest-cards.json';
import persona from '../data/persona-cards.json';
import secret from '../data/secret-cards.json';
import type { SimulationDefinitions } from '../types/simulation';
import {
  DANCE_STYLES,
  GENRE_AFFINITIES,
  LEADERSHIP_STYLES,
  RAP_STYLES,
  VISUAL_VIBES,
  VOCAL_COLORS,
  ZODIAC_SIGNS,
} from './attribute-libraries';
import { getAuditionSongs } from './audition-songs';
import { BATTLE_SONGS, validateBattleSongs } from './battle-songs';
import { getMegaGroupsCatalogs } from './mega-groups-catalogs';
import { getPhotoshootConcepts } from './photoshoot-concepts';
import { getTrackSpecialSongs } from './track-special-songs';
import { getVarietyShowCatalog } from './variety-show-catalog';
import { getVersatilityCatalogs } from './versatility-catalogs';

export function freezeSimulationSnapshot<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const entry of Object.values(value)) freezeSimulationSnapshot(entry);
    Object.freeze(value);
  }
  return value;
}

export function getSimulationDefinitions(): SimulationDefinitions {
  validateBattleSongs(BATTLE_SONGS, Object.keys(GENRE_AFFINITIES));
  return structuredClone({
    cards: { persona, identity, interest, secret },
    specialties: {
      vocalColor: VOCAL_COLORS,
      danceStyle: DANCE_STYLES,
      rapStyle: RAP_STYLES,
      visualVibe: VISUAL_VIBES,
      leadershipStyle: LEADERSHIP_STYLES,
      genreAffinity: GENRE_AFFINITIES,
    },
    zodiacSigns: ZODIAC_SIGNS,
    auditionSongs: getAuditionSongs(),
    battleSongs: BATTLE_SONGS,
    ...getMegaGroupsCatalogs(),
    photoshootConcepts: getPhotoshootConcepts(),
    trackSpecialSongs: getTrackSpecialSongs(),
    ...getVersatilityCatalogs(),
    varietyShowCatalog: getVarietyShowCatalog(),
  });
}
