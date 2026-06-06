const adjectives = [
  "silent", "drifting", "amber", "hollow", "mossy", "golden", "ashen", "birch",
  "calm", "cedar", "cinder", "crimson", "dusty", "ember", "fading", "gentle",
  "gilded", "iron", "jade", "kindled", "linden", "mellow", "muted", "night",
  "oak", "pine", "quiet", "russet", "smoky", "solace", "still", "stone",
  "tawny", "twilight", "warm", "wandering", "wild", "willow", "worn", "woven",
  "hushed", "lunar", "misty", "pale",
];

const nouns = [
  "owl", "ember", "creek", "cedar", "moth", "ash", "bark", "blaze",
  "branch", "briar", "brook", "coal", "dawn", "dell", "dew", "dusk",
  "field", "flame", "glen", "grove", "hearth", "leaf", "log", "meadow",
  "moon", "moss", "path", "pine", "reed", "ridge", "river", "root",
  "shade", "smoke", "spark", "stone", "stream", "thorn", "trail", "wind",
  "wood", "fox", "wren", "finch",
];

export function generateName(seed?: string): string {
  if (seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const adjIndex = Math.abs(hash) % adjectives.length;
    const nounIndex = Math.abs(hash + 31) % nouns.length;
    return `${adjectives[adjIndex]} ${nouns[nounIndex]}`;
  }
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]!;
  const noun = nouns[Math.floor(Math.random() * nouns.length)]!;
  return `${adj} ${noun}`;
}

export function generateSessionId(): string {
  return crypto.randomUUID();
}
