const ANALYSIS_DELAY_MS = 2000;
const VERIFY_DELAY_MS = 2500;

const SAMPLE_DESCRIPTIONS = [
  "Pile of household waste and plastic bags on a sidewalk",
  "Construction debris dumped at the edge of a parking lot",
  "Scattered litter and food packaging in a green area",
  "Mixed garbage bags abandoned near a tree line",
  "Old tires and metal scrap left in a ditch",
];

const SAMPLE_WASTE_TYPES = [
  ["plastic", "mixed"],
  ["construction"],
  ["organic", "plastic"],
  ["mixed"],
  ["construction", "mixed"],
];

export function fakeAnalyze() {
  return new Promise((resolve) => {
    setTimeout(() => {
      const hazard = Math.max(2, Math.min(9, Math.round(3 + Math.random() * 5)));
      const volumeKg = Math.round(10 + Math.random() * 80);
      const bountyTokens = Math.min(500, hazard * 10 + volumeKg);
      const i = Math.floor(Math.random() * SAMPLE_DESCRIPTIONS.length);
      resolve({
        is_illegal_dump: true,
        hazard_score: hazard,
        estimated_volume_kg: volumeKg,
        bounty_tokens: bountyTokens,
        description: SAMPLE_DESCRIPTIONS[i],
        waste_types: SAMPLE_WASTE_TYPES[i],
      });
    }, ANALYSIS_DELAY_MS);
  });
}

export function fakeVerify() {
  return new Promise((resolve) => {
    setTimeout(() => {
      const success = Math.random() > 0.1;
      resolve({
        same_location: success,
        cleanup_verified: success,
        confidence: success ? 0.94 : 0.32,
        reasoning: success
          ? "Background landmarks match. Waste has been removed."
          : "Could not confirm same location from background features.",
      });
    }, VERIFY_DELAY_MS);
  });
}