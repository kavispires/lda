import type { AuditionAction } from '../types/audition-episode';
import type { BattleAction } from '../types/battle-episode';
import type { SimulationState } from '../types/simulation';
import { createContestant } from '../utilities/contestant-factory';
import { MOOD_FIELDS, transitionAudition } from './audition-episode';
import { transitionBattle } from './battle-episode';
import { createSeasonSetup } from './season-setup';

export function completedAuditionsFixture(): SimulationState {
  const source = Object.fromEntries(
    Array.from({ length: 55 }, (_, index) => {
      const id = `battle-fixture-${index}`;
      const contestant = createContestant({
        id,
        name: `Performer ${index}`,
        updatedAt: 1,
        track: (['VOCAL', 'RAP', 'DANCE'] as const)[index % 3],
      });
      contestant.coreSkills.vocals = 1 + (index % 5);
      contestant.coreSkills.dance = 1 + ((index + 2) % 5);
      contestant.utilitySkills.learning = 1 + ((index + 3) % 5);
      contestant.personality.ambition = index % 11;
      return [id, contestant];
    }),
  );
  let state: SimulationState = {
    ...createSeasonSetup(source, { seed: 34567, runId: 'battle-test', now: 1000, formatVersion: 1 }),
    status: 'ready',
    persistenceError: null,
  };
  state.runtime!.show.audience = 1200;
  state.runtime!.show.general = 1200;
  for (let count = 0; count < 60 && state.runtime?.audition?.phase !== 'complete'; count++) {
    const ep = state.runtime!.audition;
    let action: AuditionAction = { type: 'advance' };
    if (!ep) action = { type: 'start' };
    else if (ep.phase === 'mood')
      action = {
        type: 'mood',
        choices: Object.fromEntries(
          MOOD_FIELDS.map((field) => [field, ep.moodOptions[field][0]]),
        ) as NonNullable<typeof ep.mood>,
      };
    else if (ep.phase === 'broadcast') action = { type: 'broadcast', cutId: 'music' };
    else if (ep.phase === 'secret') action = { type: 'secret', contestantId: ep.secretCandidates[0] };
    state = transitionAudition(state, action, ep?.revision ?? 0);
  }
  if (state.runtime?.audition?.phase !== 'complete') throw new Error('Fixture failed to finish Auditions.');
  return state;
}

export function nextBattleAction(state: SimulationState): BattleAction {
  const ep = state.runtime?.battle;
  if (!ep) return { type: 'start' };
  if (ep.phase === 'conflict') return { type: 'conflict', choice: 'mediate' };
  if (ep.phase === 'broadcast') return { type: 'broadcast', cutId: 'backstage' };
  if (ep.phase === 'saves') return { type: 'production-save', contestantId: ep.productionShortlist[0] };
  if (ep.phase === 'secret') return { type: 'secret', contestantId: ep.secretCandidates[0] };
  return { type: 'advance' };
}

export function advanceBattleTo(state: SimulationState, phase: string): SimulationState {
  for (let count = 0; count < 80 && state.runtime?.battle?.phase !== phase; count++)
    state = transitionBattle(state, nextBattleAction(state), state.runtime?.battle?.revision ?? 0);
  if (state.runtime?.battle?.phase !== phase) throw new Error(`Fixture failed to reach ${phase}.`);
  return state;
}
