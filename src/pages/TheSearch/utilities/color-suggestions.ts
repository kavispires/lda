import type { Contestant } from '../types/contestant';
import type { TRACKS } from './constants';

/**
 * Predefined color palettes for each track
 */
const COLOR_PALETTES = {
  VOCAL: [
    '#FF6B6B', // Red
    '#FF4757', // Crimson
    '#E74C3C', // Alizarin
    '#FF5733', // Flame
    '#EE5A6F', // Watermelon
    '#FF8E53', // Orange
    '#FF6348', // Coral
    '#FFA600', // Amber
    '#FFAB73', // Peach
    '#FFB142', // Casablanca
    '#FF6F00', // Safety Orange
    '#FFA07A', // Light Salmon
    '#FFD93D', // Yellow
    '#F9CA24', // Golden Yellow
    '#FFD32A', // Bright Yellow
    '#FFC312', // Bright Sun
    '#FFEAA7', // Egg Yellow
    '#C4E538', // Lime Yellow
    '#FF7979', // Light Red
    '#FF6347', // Tomato
    '#FF8C00', // Dark Orange
    '#FFB347', // Mango
  ],
  RAP: [
    '#4A69BD', // Blue
    '#3742FA', // Bright Blue
    '#0984E3', // Ocean Blue
    '#0652DD', // Science Blue
    '#54A0FF', // Jordy Blue
    '#4834DF', // French Lilac
    '#5F27CD', // Purple
    '#706FD3', // Light Purple
    '#341F97', // Deep Purple
    '#5352ED', // Indigo
    '#6C5CE7', // Lavender
    '#A29BFE', // Periwinkle
    '#8E44AD', // Wisteria
    '#9B59B6', // Amethyst
    '#6C3483', // Seance
    '#5B2C6F', // Martinique
    '#1E3799', // Jacksons Purple
    '#6F1E51', // Pomegranate
    '#40407A', // Daisy Bush
    '#2C3E50', // Navy Blue
    '#273C75', // Chambray
    '#192A56', // Lucky Point
  ],
  DANCE: [
    '#26DE81', // Green
    '#2ED573', // Light Green
    '#1DD1A1', // Mint
    '#20BF6B', // Emerald
    '#10AC84', // Jade
    '#1ABC9C', // Mountain Meadow
    '#16A085', // Green Haze
    '#27AE60', // Nephritis
    '#2ECC71', // Shamrock
    '#00B894', // Sea Green
    '#55EFC4', // Aquamarine
    '#76FF03', // Electric Lime
    '#64DD17', // Bright Green
    '#0FB9B1', // Teal
    '#00D2D3', // Cyan
    '#00CEC9', // Turquoise
    '#3DC1D3', // Robin Egg Blue-Green
    '#00B8D4', // Dark Turquoise
    '#00897B', // Dark Cyan
    '#0097A7', // Dark Aqua
    '#48DBFB', // Light Teal
    '#009688', // Teal Green
  ],
};

/**
 * Calculates color distance using simple RGB difference
 * @param color1 - First color in hex format
 * @param color2 - Second color in hex format
 * @returns Distance value (0-765, lower means more similar)
 */
function colorDistance(color1: string, color2: string): number {
  const hex1 = color1.replace('#', '');
  const hex2 = color2.replace('#', '');

  const r1 = Number.parseInt(hex1.substring(0, 2), 16);
  const g1 = Number.parseInt(hex1.substring(2, 4), 16);
  const b1 = Number.parseInt(hex1.substring(4, 6), 16);

  const r2 = Number.parseInt(hex2.substring(0, 2), 16);
  const g2 = Number.parseInt(hex2.substring(2, 4), 16);
  const b2 = Number.parseInt(hex2.substring(4, 6), 16);

  return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
}

/**
 * Checks if a color is too similar to any existing color
 * @param color - Color to check
 * @param existingColors - List of existing colors
 * @param threshold - Minimum distance threshold (default 150)
 * @returns True if color is dissimilar enough
 */
function isColorDissimilar(color: string, existingColors: string[], threshold = 150): boolean {
  return existingColors.every((existingColor) => colorDistance(color, existingColor) > threshold);
}

/**
 * Gets 3 color suggestions based on track and existing contestants
 * Ensures colors are dissimilar to existing colors and each other
 * @param track - The contestant's track
 * @param existingContestants - Array of existing contestants
 * @returns Array of 3 suggested colors in hex format
 */
export function getColorSuggestions(
  track: (typeof TRACKS)[keyof typeof TRACKS],
  existingContestants: Contestant[],
): string[] {
  const palette = COLOR_PALETTES[track as keyof typeof COLOR_PALETTES] || COLOR_PALETTES.VOCAL;
  const existingColors = existingContestants.map((c) => c.color.toUpperCase());

  // Filter available colors that are dissimilar to existing ones
  const availableColors = palette.filter((color) => {
    // Check if color is already used
    if (existingColors.includes(color.toUpperCase())) {
      return false;
    }
    // Check if color is dissimilar to all existing colors
    return isColorDissimilar(color, existingColors);
  });

  // If we have enough available colors, pick 3
  if (availableColors.length >= 3) {
    // Spread them out across the available colors
    const step = Math.floor(availableColors.length / 3);
    return [availableColors[0], availableColors[step], availableColors[step * 2]];
  }

  // If less than 3 available, return what we have
  if (availableColors.length > 0) {
    return availableColors.slice(0, 3);
  }

  // Fallback: if all colors are taken, return the first 3 from palette
  return palette.slice(0, 3);
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
