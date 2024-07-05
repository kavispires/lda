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
