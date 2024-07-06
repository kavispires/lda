/**
 * Unique identifier
 */
export type UID = string;
/**
 * Firebase generated unique identifier
 */
export type FUID = string;

/**
 * Date in milliseconds
 */
export type RecordDate = number;

/**
 * Timestamps for records
 */
export type RecordTimestamps = {
  /**
   * Date of creation
   */
  createdAt: RecordDate;
  /**
   * Date of last update
   */
  updatedAt?: RecordDate;
};

/**
 * Represents a dictionary object that maps string keys to values of type T.
 * @template T - The type of values stored in the dictionary.
 */
export type Dictionary<T> = Record<string, T>;
