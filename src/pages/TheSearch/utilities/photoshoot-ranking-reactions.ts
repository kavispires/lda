import type { EpisodeScene } from '../types/audition-episode';
import type { PhotoshootEpisode } from '../types/photoshoot-episode';

export function photoshootFinaleScene(episode: PhotoshootEpisode, scene: EpisodeScene): EpisodeScene {
  if (episode.phase !== 'complete' || scene.id !== episode.scenes.at(-1)?.id) return scene;
  const legacyRoster =
    scene.paragraphs.filter((text) => /^\d+[.)]\s/.test(text)).length === episode.rankedIds.length;
  return {
    ...scene,
    ...(legacyRoster ? photoshootRankingReactions(episode) : {}),
    kind: 'ranking',
  };
}

export function photoshootRankingReactions(
  episode: PhotoshootEpisode,
): Pick<EpisodeScene, 'paragraphs' | 'contestantIds' | 'paragraphContestantIds'> {
  if (!episode.rankRevealed) throw new Error('Photoshoot reactions require the announced ranking.');
  const standings = episode.rankedIds.map((id, index) => {
    const contestant = episode.startingContestants.find((entry) => entry.id === id);
    const previous = episode.previousRankedIds.indexOf(id) + 1;
    if (!contestant || !previous) throw new Error(`Missing Photoshoot ranking history for "${id}".`);
    return { contestant, rank: index + 1, previous, movement: previous - index - 1 };
  });
  const rises = standings
    .filter(({ movement }) => movement >= 3)
    .sort((a, b) => b.movement - a.movement || a.rank - b.rank)
    .slice(0, 2);
  const falls = standings
    .filter(({ movement }) => movement <= -3)
    .sort((a, b) => a.movement - b.movement || a.rank - b.rank)
    .slice(0, 2);
  const highlights = [...new Set([...rises, ...falls, ...standings.slice(-3)])];
  const paragraphs = highlights.map(({ contestant, rank, previous, movement }) => {
    const p = contestant.personality;
    const concern =
      rank >= 14
        ? p.resilience >= 5 || p.maturity >= 5
          ? ' From the bottom three, they set their jaw: "I am safe tonight, but I need to turn this around next week."'
          : ' Their eyes linger on the bottom three: "Nobody leaves tonight. Next week is what worries me."'
        : '';
    if (movement >= 3) {
      const reaction =
        p.ambition >= 5
          ? 'They pump a fist before catching themselves: "That is more like it. Now I have to keep climbing."'
          : p.sensitivity >= 5
            ? 'Their eyes fill as the number sinks in: "I was not sure anyone was seeing me."'
            : 'A startled laugh gives way to a broad smile: "That is a lot to take in. Thank you."';
      return `${contestant.name} climbs ${movement} places, from ${previous} to ${rank}. ${reaction}${concern}`;
    }
    if (movement <= -3) {
      const reaction =
        p.resilience >= 5 || p.maturity >= 5
          ? 'They steady their breathing: "It hurts, but I need to listen and come back stronger."'
          : p.sensitivity >= 5
            ? 'They blink back tears and look down: "I thought this week had gone better than that."'
            : p.ambition >= 5
              ? 'Their smile tightens: "I cannot let this become a pattern."'
              : 'They fall quiet, then nod: "I have some catching up to do."';
      return `${contestant.name} drops ${Math.abs(movement)} places, from ${previous} to ${rank}. ${reaction}${concern}`;
    }
    return `${contestant.name} takes in place ${rank}.${concern}`;
  });
  paragraphs.push('All sixteen continue. Episode 5 is complete. Episode 6 is next and has not begun.');
  return {
    paragraphs,
    contestantIds: highlights.map(({ contestant }) => contestant.id),
    paragraphContestantIds: [...highlights.map(({ contestant }) => [contestant.id]), []],
  };
}
