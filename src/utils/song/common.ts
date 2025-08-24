/**
 * Generates a unique identifier.
 * @param prefix The prefix for the generated identifier ('s' for sections, 'l' for lines, 'p' for parts).
 * @param length The length of the generated identifier. Default is 3.
 * @param song Optional song object to automatically update/add the cache with all ids used in the song content.
 * @returns A unique identifier.
 */
export const generateUniqueId = (() => {
  const cache: Record<string, true> = {};

  function generate(prefix = '', length = 3, song?: { content: Record<string, unknown> }): string {
    // If a song is provided, add all its content IDs to the cache
    if (song?.content) {
      Object.keys(song.content).forEach((id) => {
        cache[id] = true;
      });
    }

    const id = `_${prefix}${Math.random()
      .toString(36)
      .slice(2, 2 + length)}`;

    if (cache[id]) {
      return generate(prefix, length);
    }

    cache[id] = true;
    return id;
  }

  return generate;
})();
