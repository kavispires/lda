import type { Contestant } from '../types/contestant';
import type { TRACKS } from './constants';

/**
 * 100 vibrant colors using HSL color space
 * Hue: 0-360 in increments of 3.6 (evenly distributed)
 * Saturation: Varied between 65-85% for vibrancy
 * Lightness: Varied between 45-60% for good contrast
 */
const COLOR_PALETTE = [
  'hsl(0, 65%, 45%)',
  'hsl(4, 70%, 50%)',
  'hsl(7, 75%, 55%)',
  'hsl(11, 80%, 60%)',
  'hsl(14, 85%, 45%)',
  'hsl(18, 65%, 50%)',
  'hsl(22, 70%, 55%)',
  'hsl(25, 75%, 60%)',
  'hsl(29, 80%, 45%)',
  'hsl(32, 85%, 50%)',
  'hsl(36, 65%, 55%)',
  'hsl(40, 70%, 60%)',
  'hsl(43, 75%, 45%)',
  'hsl(47, 80%, 50%)',
  'hsl(50, 85%, 55%)',
  'hsl(54, 65%, 60%)',
  'hsl(58, 70%, 45%)',
  'hsl(61, 75%, 50%)',
  'hsl(65, 80%, 55%)',
  'hsl(68, 85%, 60%)',
  'hsl(72, 65%, 45%)',
  'hsl(76, 70%, 50%)',
  'hsl(79, 75%, 55%)',
  'hsl(83, 80%, 60%)',
  'hsl(86, 85%, 45%)',
  'hsl(90, 65%, 50%)',
  'hsl(94, 70%, 55%)',
  'hsl(97, 75%, 60%)',
  'hsl(101, 80%, 45%)',
  'hsl(104, 85%, 50%)',
  'hsl(108, 65%, 55%)',
  'hsl(112, 70%, 60%)',
  'hsl(115, 75%, 45%)',
  'hsl(119, 80%, 50%)',
  'hsl(122, 85%, 55%)',
  'hsl(126, 65%, 60%)',
  'hsl(130, 70%, 45%)',
  'hsl(133, 75%, 50%)',
  'hsl(137, 80%, 55%)',
  'hsl(140, 85%, 60%)',
  'hsl(144, 65%, 45%)',
  'hsl(148, 70%, 50%)',
  'hsl(151, 75%, 55%)',
  'hsl(155, 80%, 60%)',
  'hsl(158, 85%, 45%)',
  'hsl(162, 65%, 50%)',
  'hsl(166, 70%, 55%)',
  'hsl(169, 75%, 60%)',
  'hsl(173, 80%, 45%)',
  'hsl(176, 85%, 50%)',
  'hsl(180, 65%, 55%)',
  'hsl(184, 70%, 60%)',
  'hsl(187, 75%, 45%)',
  'hsl(191, 80%, 50%)',
  'hsl(194, 85%, 55%)',
  'hsl(198, 65%, 60%)',
  'hsl(202, 70%, 45%)',
  'hsl(205, 75%, 50%)',
  'hsl(209, 80%, 55%)',
  'hsl(212, 85%, 60%)',
  'hsl(216, 65%, 45%)',
  'hsl(220, 70%, 50%)',
  'hsl(223, 75%, 55%)',
  'hsl(227, 80%, 60%)',
  'hsl(230, 85%, 45%)',
  'hsl(234, 65%, 50%)',
  'hsl(238, 70%, 55%)',
  'hsl(241, 75%, 60%)',
  'hsl(245, 80%, 45%)',
  'hsl(248, 85%, 50%)',
  'hsl(252, 65%, 55%)',
  'hsl(256, 70%, 60%)',
  'hsl(259, 75%, 45%)',
  'hsl(263, 80%, 50%)',
  'hsl(266, 85%, 55%)',
  'hsl(270, 65%, 60%)',
  'hsl(274, 70%, 45%)',
  'hsl(277, 75%, 50%)',
  'hsl(281, 80%, 55%)',
  'hsl(284, 85%, 60%)',
  'hsl(288, 65%, 45%)',
  'hsl(292, 70%, 50%)',
  'hsl(295, 75%, 55%)',
  'hsl(299, 80%, 60%)',
  'hsl(302, 85%, 45%)',
  'hsl(306, 65%, 50%)',
  'hsl(310, 70%, 55%)',
  'hsl(313, 75%, 60%)',
  'hsl(317, 80%, 45%)',
  'hsl(320, 85%, 50%)',
  'hsl(324, 65%, 55%)',
  'hsl(328, 70%, 60%)',
  'hsl(331, 75%, 45%)',
  'hsl(335, 80%, 50%)',
  'hsl(338, 85%, 55%)',
  'hsl(342, 65%, 60%)',
  'hsl(346, 70%, 45%)',
  'hsl(349, 75%, 50%)',
  'hsl(353, 80%, 55%)',
  'hsl(356, 85%, 60%)',
];

/**
 * Gets 5 random color suggestions from the palette
 * Filters out colors already used by existing contestants
 * @param _track - The contestant's track (kept for backward compatibility, not used)
 * @param existingContestants - Array of existing contestants
 * @returns Array of up to 5 suggested colors in HSL format
 */
export function getColorSuggestions(
  _track: (typeof TRACKS)[keyof typeof TRACKS],
  existingContestants: Contestant[],
): string[] {
  const existingColors = existingContestants.map((c) => c.color.toLowerCase());

  // Filter out colors already in use
  const availableColors = COLOR_PALETTE.filter((color) => !existingColors.includes(color.toLowerCase()));

  // If we have available colors, pick 5 random ones
  if (availableColors.length >= 5) {
    const shuffled = [...availableColors].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 5);
  }

  // If less than 5 available, return what we have
  if (availableColors.length > 0) {
    return availableColors;
  }

  // Fallback: if all colors are taken, return 5 random colors from full palette
  const shuffled = [...COLOR_PALETTE].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 5);
}

/**
 * Checks if a color already exists in the contestant list
 * @param color - Color to check
 * @param existingContestants - Array of existing contestants
 * @returns True if color already exists
 */
export function isColorTaken(color: string, existingContestants: Contestant[]): boolean {
  return existingContestants.some((c) => c.color.toUpperCase() === color.toUpperCase());
}
