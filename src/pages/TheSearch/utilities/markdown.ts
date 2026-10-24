export function markdown(text: string): string {
  return text
    .split(/<Tag>([\s\S]*?)<\/Tag>/g)
    .map((part, index) => {
      const escaped = part.replace(/[\\`*_[\]<>#|]/g, '\\$&');
      return index % 2 ? `**${escaped}**` : escaped;
    })
    .join('');
}
