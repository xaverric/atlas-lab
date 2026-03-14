export const matchPattern = (pattern: string, event: string): boolean => {
  if (pattern === '*') return true;

  const patternParts = pattern.split('.');
  const eventParts = event.split('.');

  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i] === '*') {
      if (i === patternParts.length - 1) return true;
      continue;
    }
    if (eventParts[i] !== patternParts[i]) return false;
  }

  return patternParts.length === eventParts.length;
};
