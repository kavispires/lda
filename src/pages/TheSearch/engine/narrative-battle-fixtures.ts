import type { AuditionAction, MoodChoices } from '../types/audition-episode';
import type { BattleAction } from '../types/battle-episode';
import type { EpisodePreparation } from '../types/narrative';
import type { SimulationState } from '../types/simulation';
import { createContestant } from '../utilities/contestant-factory';
import { getSimulationDefinitions } from '../utilities/simulation-definitions';
import { MOOD_FIELDS } from './audition-episode';
import { transitionNarrativeAudition } from './narrative-audition';
import { transitionBattleStory } from './narrative-battle';
import { createSeasonSetup } from './season-setup';

function choices(preparation: EpisodePreparation): MoodChoices {
  return {
    vocalColor: preparation.moodOptions.vocalColor[0],
    danceStyle: preparation.moodOptions.danceStyle[0],
    rapStyle: preparation.moodOptions.rapStyle[0],
    visualVibe: preparation.moodOptions.visualVibe[0],
    leadershipStyle: preparation.moodOptions.leadershipStyle[0],
    genreAffinity: preparation.moodOptions.genreAffinity[0],
  };
}

export function narrativeBattleFixture(): SimulationState {
  const definitions = getSimulationDefinitions();
  const source = Object.fromEntries(
    Array.from({ length: 55 }, (_, index) => {
      const person = createContestant({
        id: `battles-story-${index}`,
        name: `Singer ${index}`,
        updatedAt: 1,
        track: (['VOCAL', 'RAP', 'DANCE'] as const)[index % 3],
      });
      person.coreSkills.vocals = 1 + (index % 5);
      person.coreSkills.stagePresence = 1 + ((index + 2) % 5);
      person.personality.ambition = (index % 11) - 5;
      person.personality.gentleness = (index % 7) - 3;
      for (const field of MOOD_FIELDS) {
        const ids = Object.keys(definitions.specialties[field]);
        person.specialties[field] = ids[index % ids.length];
      }
      return [person.id, person];
    }),
  );
  let state: SimulationState = {
    ...createSeasonSetup(source, { seed: 2948, runId: 'battles-story', now: 1000 }),
    status: 'ready',
    persistenceError: null,
  };
  state.runtime!.show.audience = 1200;
  state.runtime!.show.general = 1200;
  for (let turn = 0; turn < 100 && state.runtime?.audition?.phase !== 'complete'; turn++) {
    const ep = state.runtime!.audition;
    const prep = state.runtime!.preparations?.[1];
    let action: AuditionAction = { type: 'advance' };
    if (!ep) action = { type: 'start' };
    else if (ep.phase === 'opening-cast' && prep)
      action = { type: 'opening-cast', contestantIds: prep.shortlist.slice(0, 5) };
    else if (ep.phase === 'mood' && prep) action = { type: 'mood', choices: choices(prep) };
    else if (ep.phase === 'secret') action = { type: 'secret', contestantId: ep.secretCandidates[0] };
    state = transitionNarrativeAudition(state, action, ep?.revision ?? 0);
  }
  if (state.runtime?.audition?.phase !== 'complete') throw new Error('Narrative Auditions did not finish.');
  return state;
}

export function nextBattleStoryAction(state: SimulationState): { action: BattleAction; revision: number } {
  const ep = state.runtime?.battle;
  const prep = state.runtime?.preparations?.[2];
  const revision = ep?.revision ?? prep?.revision ?? 0;
  if (!ep) {
    if (!prep) return { action: { type: 'start' }, revision };
    if (!prep.mood) return { action: { type: 'mood', choices: choices(prep) }, revision };
    return {
      action: { type: 'opening-cast', contestantIds: prep.shortlist.slice(0, prep.requiredSelections) },
      revision,
    };
  }
  if (ep.story?.stage === 'intervention')
    return { action: { type: 'conflict', choice: 'mediate' }, revision };
  if (ep.story?.stage === 'production-save')
    return { action: { type: 'production-save', contestantId: ep.productionShortlist[0] }, revision };
  if (ep.story?.stage === 'secret-choice')
    return { action: { type: 'secret', contestantId: ep.secretCandidates[0] }, revision };
  return { action: { type: 'advance' }, revision };
}

export function advanceBattleStoryTo(initial: SimulationState, stage: string): SimulationState {
  let state = initial;
  for (let count = 0; count < 180 && state.runtime?.battle?.story?.stage !== stage; count++) {
    const { action, revision } = nextBattleStoryAction(state);
    state = transitionBattleStory(state, action, revision);
  }
  if (state.runtime?.battle?.story?.stage !== stage) throw new Error(`Could not reach ${stage}.`);
  return state;
}
