import type {PetQuality} from '../store/useStore';

export function getPetQualityLabel(quality: PetQuality | null) {
  if (quality === 'epic') return '完美';
  if (quality === 'rare') return '优秀';
  return '普通';
}

export function getPetQualityBadgeClass(quality: PetQuality | null) {
  if (quality === 'epic') {
    return 'border-emerald-200/90 bg-emerald-50 text-emerald-700';
  }
  if (quality === 'rare') {
    return 'border-amber-200/90 bg-amber-50 text-amber-700';
  }
  return 'border-slate-200/90 bg-slate-100 text-slate-600';
}

export function getPetQualityPanelClass(quality: PetQuality | null) {
  if (quality === 'epic') {
    return 'border-emerald-200/90 bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.32),rgba(255,255,255,0.84)_56%)] text-emerald-700';
  }
  if (quality === 'rare') {
    return 'border-amber-200/90 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.3),rgba(255,255,255,0.84)_56%)] text-amber-700';
  }
  return 'border-slate-200/90 bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.24),rgba(255,255,255,0.84)_58%)] text-slate-600';
}

export function getPetQualityDescription(quality: PetQuality | null) {
  if (quality === 'epic') return '状态衰减 -32%，便便累积 -30%，最省心的一档。';
  if (quality === 'rare') return '状态衰减 -18%，便便累积 -15%，日常照料更轻松。';
  return '没有额外加成，属于基础陪伴型个体。';
}

export function getPetQualityEffectSummary(quality: PetQuality | null) {
  if (quality === 'epic') return '状态衰减 -32% · 便便累积 -30%';
  if (quality === 'rare') return '状态衰减 -18% · 便便累积 -15%';
  return '无额外加成';
}
