import type { EpisodeScene, SecretResult } from '../types/audition-episode';

export const SHOW_PREMISE = 'The Search is a televised talent competition to find the next Squirrel Zone.';

export function rundownScenes(scenes: readonly EpisodeScene[], secret: SecretResult | null) {
  return scenes.filter((scene) => scene.kind !== 'secret' || secret?.cardId);
}

export function showRundown(text: string, secret: SecretResult | null = null): string {
  const story = secret?.cardId
    ? text
    : text.replace(/ Before we close, production has one final secret investigation\./g, '');
  return story.replace(/\bsimulation(s?)\b/gi, 'show$1');
}
