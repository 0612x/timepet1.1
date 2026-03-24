export interface PetStatusLike {
  health?: number;
  satiety?: number;
  mood?: number;
  hygiene?: number;
  wasteLevel?: number;
  statusUpdatedAt?: number;
}

export interface PetStatusBubbleMeta {
  icon: string;
  label: string;
  tone: 'rose' | 'amber' | 'violet';
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

export const roundMetric = (value: number) => Math.round(clampMetric(value));

export function getPetMetric(status: PetStatusLike, key: PetMetricKey) {
  const fallback = PET_STATUS_DEFAULTS[key];
  const raw = status[key];
  if (typeof raw !== 'number' || Number.isNaN(raw)) return fallback;
  return Math.round(clampMetric(raw));
}

export function getHealthLabel(health: number) {
  if (health >= 82) return '非常健康';
  if (health >= 66) return '状态不错';
  if (health >= 46) return '有点虚弱';
  if (health >= 26) return '需要照顾';
  return '生病了';
}

export function getSatietyLabel(satiety: number) {
  if (satiety >= 72) return '吃饱';
  if (satiety >= 38) return '还行';
  return '饿了';
}

export function getMoodLabel(mood: number) {
  if (mood >= 82) return '开心';
  if (mood >= 58) return '平静';
  if (mood >= 36) return '有点闷';
  return '心情差';
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

export function getPetStatusBubbleMeta(status: PetStatusLike): PetStatusBubbleMeta | null {
  const health = getPetMetric(status, 'health');
  const satiety = getPetMetric(status, 'satiety');
  const mood = getPetMetric(status, 'mood');

  if (health <= 25) {
    return {
      icon: '🤒',
      label: '生病了',
      tone: 'rose',
    };
  }

  if (satiety <= 28) {
    return {
      icon: '🍽️',
      label: '饿了',
      tone: 'amber',
    };
  }

  if (satiety <= 52) {
    return {
      icon: '🍽️',
      label: '有点饿',
      tone: 'amber',
    };
  }

  if (mood <= 28) {
    return {
      icon: '☁️',
      label: '心情差',
      tone: 'violet',
    };
  }

  if (mood <= 50) {
    return {
      icon: '☁️',
      label: '有点闷',
      tone: 'violet',
    };
  }

  if (health <= 45) {
    return {
      icon: '💤',
      label: '不舒服',
      tone: 'rose',
    };
  }

  if (health <= 62) {
    return {
      icon: '💤',
      label: '状态一般',
      tone: 'rose',
    };
  }

  return null;
}
