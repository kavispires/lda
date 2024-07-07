import { isEqual, isObject } from 'lodash';

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
