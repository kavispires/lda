import { isEqual, isObject, orderBy } from 'lodash';
import { TypeaheadEntry } from 'types';

/**
 * Generates a unique identifier.
 * @param length The length of the generated identifier. Default is 5.
 * @returns A unique identifier.
 */
export const generateUniqueId = (function () {
  const cache: Record<string, true> = {};

  function generate(prefix = '', length = 3): string {
    const id =
      '_' +
      prefix +
      Math.random()
        .toString(36)
        .slice(2, 2 + length);
    if (cache[id]) {
      return generate(prefix, length);
    }

    cache[id] = true;
    return id;
  }

  return generate;
})();

/**
 * Returns the plural form of a word based on the quantity.
 * @param quantity - The quantity to determine the plural form.
 * @param singular - The singular form of the word.
 * @param plural - (Optional) The plural form of the word. If not provided, the singular form will be used with an 's' appended.
 * @returns The plural form of the word.
 */
export const pluralize = (quantity: number, singular: string, plural?: string): string => {
  return quantity === 1 ? singular : plural ? plural : `${singular}s`;
};

/**
 * Returns the name of an instance based on the provided uids.
 * If the uids array is empty, it returns 'instance'.
 * Otherwise, it determines the name based on the first character of the first uid.
 * The name is then pluralized based on the length of the uids array.
 * @param uids - An array of uids.
 * @returns The name of the instance.
 */
export const getInstanceName = (uids: string[]) => {
  if (uids.length === 0) {
    return 'instance';
  }
  const keyCharacter = uids[0][1];
  const name =
    {
      s: 'section',
      l: 'line',
      p: 'part',
    }[keyCharacter] ?? 'instance';

  return pluralize(uids.length, name);
};

/**
 * Returns the instance type based on the provided UID.
 * @param uid - The UID string.
 * @returns The instance type ('section', 'line', 'part', or 'song').
 */
export const getInstanceType = (uid: string) => {
  const keyCharacter = uid[1];
  return (
    {
      s: 'section',
      l: 'line',
      p: 'part',
    }[keyCharacter] ?? 'song'
  );
};

/**
 * Calculates the completion percentage based on the given criteria.
 * @param criteria - An array of boolean or number values representing the completion status of each criterion.
 * @returns The completion percentage as a number.
 */
export const getCompletionPercentage = (criteria: (boolean | number)[]): number => {
  const totalCriteria = criteria.length;
  const completedCriteria = criteria.filter((v) => {
    if (typeof v === 'boolean') {
      return v;
    }

    if (typeof v === 'number') {
      return v === 100;
    }

    return false;
  }).length;

  return Math.floor((completedCriteria / totalCriteria) * 100);
};

type DiffObject = {
  [key: string]: any;
};

/**
 * Calculates the difference between two objects.
 * @param obj1 - The first object.
 * @param obj2 - The second object.
 * @returns An object representing the difference between obj1 and obj2.
 */
export function getDifference(obj1: any, obj2: any): DiffObject {
  let result: DiffObject = {};

  const keys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

  keys.forEach((key) => {
    const value1 = obj1[key];
    const value2 = obj2[key];

    if (isObject(value1) && isObject(value2)) {
      const diff = getDifference(value1, value2);
      if (Object.keys(diff).length > 0) {
        result[key] = diff;
      }
    } else if (!isEqual(value1, value2)) {
      result[key] = { from: value1, to: value2 };
    }
  });

  return result;
}

/**
 * Remove duplicated elements from a list
 * @param arr
 * @returns
 */
export const removeDuplicates = <T>(arr: T[]): T[] => {
  return Array.from(new Set(arr));
};

type ObjectWithKeyAndValue<K extends string, V extends string> = {
  [key in K | V]: any;
};

/**
 * Builds a typeahead list from the given data.
 * @param data - The data to build the typeahead from.
 * @param [valueProperty='name'] - The property to use as the value in the typeahead entry.
 * @param [keyProperty='id'] - The property to use as the key in the typeahead entry.
 * @returns - The built typeahead list.
 */
export const buildTypeahead = <K extends string, V extends string, T extends ObjectWithKeyAndValue<K, V>>(
  data: T[] | Record<string, T>,
  valueProperty: V = 'name' as V,
  keyProperty: K = 'id' as K
): TypeaheadEntry[] => {
  const entries = Array.isArray(data) ? data : Object.values(data);

  return orderBy(
    entries.map((entry) => ({
      key: entry[keyProperty],
      value: entry[valueProperty],
    })),
    'value'
  );
};

/**
 * Pauses the execution for a specified duration.
 * @param duration - The duration to wait in milliseconds. Default is 1000ms.
 */
export const wait = async (duration = 1000) => {
  await new Promise((resolve) => setTimeout(resolve, duration));
};
