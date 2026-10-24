export function storyText(text: string): string {
  return text
    .replace(
      / Their audience preference rises, and five continuing-score points will be included in the closing ranking\./g,
      '',
    )
    .replace(/, and the honor adds no hidden ranking points/g, '');
}
