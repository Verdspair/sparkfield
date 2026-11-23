import { z } from 'zod';

export const DurationModeSchema = z.enum(['quick', 'standard', 'deep']);
export type DurationMode = z.infer<typeof DurationModeSchema>;

export const MATCH_STUDY_ARC_SLOTS: Readonly<Record<DurationMode, readonly [min: number, max: number]>> = {
  quick: [4, 4], standard: [6, 6], deep: [12, 12],
};

export const QueueTypeSchema = z.enum(['ranked', 'casual', 'solo']);
export type QueueType = z.infer<typeof QueueTypeSchema>;

export const MatchPhaseKindSchema = z.enum([
  'entry',
  'learning',
  'resource',
  'choice',
  'strategy',
  'battle',
  'settlement',
  'rest',
  'exit',
]);
export type MatchPhaseKind = z.infer<typeof MatchPhaseKindSchema>;

export function getMatchChoiceKind(phase: MatchPhaseKind, eventLabel: string): 'augment' | 'anvil' | null {
  if (phase !== 'choice') return null;
  return eventLabel.includes('强化') ? 'augment' : 'anvil';
}

export const DisplayOrientationSchema = z.enum(['landscape', 'portrait']);
export type DisplayOrientation = z.infer<typeof DisplayOrientationSchema>;

export const DisplaySettingsSchema = z.object({
  fullscreen: z.boolean().default(true),
  orientation: DisplayOrientationSchema.default('landscape'),
});
export type DisplaySettings = z.infer<typeof DisplaySettingsSchema>;

export function isV1SupportedDisplay(settings: DisplaySettings): boolean {
  return settings.orientation === 'landscape';
}

export const VersionLockTripletSchema = z.object({
  seasonTermId: z.string().min(1),
  gameSetVersion: z.string().min(1),
  coursePackVersion: z.string().min(1),
});
export type VersionLockTriplet = z.infer<typeof VersionLockTripletSchema>;

export const ArenaThemeIdSchema = z.enum([
  'orbital_elevator_port',
  'mercury_dyson_forge',
  'event_horizon_observatory',
]);
export type ArenaThemeId = z.infer<typeof ArenaThemeIdSchema>;

export function computeEstimatedEndTimeHHMM(now: Date, plannedTotalSeconds: number): string {
  const end = new Date(now.getTime() + plannedTotalSeconds * 1000);
  const hh = String(end.getHours()).padStart(2, '0');
  const mm = String(end.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
