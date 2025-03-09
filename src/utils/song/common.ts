/**
 * Generates a unique identifier.
 * @param length The length of the generated identifier. Default is 5.
 * @returns A unique identifier.
 */
export const generateUniqueId = (() => {
  const cache: Record<string, true> = {};

  function generate(prefix = '', length = 3): string {
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
