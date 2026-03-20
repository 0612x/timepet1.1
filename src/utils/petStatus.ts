export interface PetStatusLike {
  health?: number;
  satiety?: number;
  mood?: number;
  hygiene?: number;
  wasteLevel?: number;
  statusUpdatedAt?: number;
}

export const PET_STATUS_DEFAULTS = {
  health: 82,
  satiety: 72,
  mood: 70,
  hygiene: 84,
  wasteLevel: 12,
};

export type PetMetricKey = 'health' | 'satiety' | 'mood' | 'hygiene' | 'wasteLevel';

export const clampMetric = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

export const roundMetric = (value: number) => Math.round(clampMetric(value) * 10) / 10;

export function getPetMetric(status: PetStatusLike, key: PetMetricKey) {
  const fallback = PET_STATUS_DEFAULTS[key];
  const raw = status[key];
  if (typeof raw !== 'number' || Number.isNaN(raw)) return fallback;
  return clampMetric(raw);
}

export function getHealthLabel(health: number) {
  if (health >= 82) return '非常健康';
  if (health >= 66) return '状态不错';
  if (health >= 46) return '需要关照';
  return '亚健康';
}

export function getSatietyLabel(satiety: number) {
  if (satiety >= 92) return '过饱';
  if (satiety >= 72) return '满足';
  if (satiety >= 38) return '正常';
  return '饥饿';
}

export function getMoodLabel(mood: number) {
  if (mood >= 82) return '开心';
  if (mood >= 58) return '平静';
  if (mood >= 36) return '低落';
  return '烦躁';
}

export function getHygieneLabel(hygiene: number) {
  if (hygiene >= 84) return '干净';
  if (hygiene >= 62) return '一般';
  if (hygiene >= 42) return '脏脏';
  return '需要清理';
}

export function getWasteLabel(wasteLevel: number) {
  if (wasteLevel >= 78) return '很多';
  if (wasteLevel >= 55) return '明显';
  if (wasteLevel >= 28) return '少量';
  return '几乎没有';
}
