import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {ThemeType, PetState} from '../data/pets';
import {
  getPetSpriteOptionByKey,
  PET_SPRITE_OPTIONS,
  type PetSpriteScene,
} from '../data/petSprites';
import {
  SCENE_SPAWN_Y_MAX,
  SCENE_SPAWN_Y_MIN,
  SCENE_X_MAX,
  SCENE_X_MIN,
} from '../constants/sceneBounds';
import {PET_STATUS_DEFAULTS, clampMetric, getPetMetric, roundMetric} from '../utils/petStatus';

export type TabType = 'home' | 'feed' | 'scene' | 'pokedex' | 'stats';
export type ActivityType = 'work' | 'study' | 'entertainment' | 'rest' | 'exercise';
export type PetQuality = 'common' | 'rare' | 'epic';

export interface Allocation {
  id: string;
  type: ActivityType;
  hours: number;
  used: boolean;
  timestamp: number;
}

export interface EggState {
  theme: ThemeType;
  progress: { focus: number; heal: number; active: number };
  petId: string | null;
  stage: 'egg' | 'base' | 'evolved';
  finalState: PetState | null;
  quality: PetQuality | null;
}

export interface CompletedPet {
  instanceId: string;
  petId: string;
  nickname?: string;
  theme: ThemeType;
  state: PetState;
  quality: PetQuality;
  x: number;
  y: number;
  variant: number;
  scale: number;
  jumpDelay: number;
  moveDelay: number;
  floatDelay: number;
  health?: number;
  satiety?: number;
  mood?: number;
  hygiene?: number;
  wasteLevel?: number;
  digestionLoad?: number;
  poopProgress?: number;
  wasteCount?: number;
  statusUpdatedAt?: number;
}

export interface CustomPet {
  id: string;
  name: string;
  image: string;
}

export interface AllocationDraft {
  type: ActivityType;
  hours: number;
}

export interface PlanTemplate {
  id: string;
  label: string;
  drafts: AllocationDraft[];
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  lastUsedAt: number | null;
  usageCount: number;
}

export interface AllocationUpdate {
  type?: ActivityType;
  hours?: number;
}

interface AppState {
  currentTab: TabType;
  setCurrentTab: (tab: TabType) => void;
  homeTabEnterSignal: number;
  enterHomeTab: () => void;
  
  currentTheme: ThemeType;
  setCurrentTheme: (theme: ThemeType) => void;
  
  allocations: Record<string, Allocation[]>;
  allocateTime: (date: string, type: ActivityType, hours: number) => boolean;
  applyAllocationDrafts: (date: string, drafts: AllocationDraft[]) => boolean;
  copyAllocationsFromDate: (sourceDate: string, targetDate: string) => boolean;
  removeLastUnusedAllocation: (date: string) => boolean;
  clearUnusedAllocations: (date: string) => boolean;
  updateUnusedAllocation: (date: string, allocationId: string, update: AllocationUpdate) => boolean;
  deleteUnusedAllocation: (date: string, allocationId: string) => boolean;
  dailyPlans: Record<string, AllocationDraft[]>;
  setDailyPlanDrafts: (date: string, drafts: AllocationDraft[]) => boolean;
  clearDailyPlan: (date: string) => boolean;
  planTemplates: PlanTemplate[];
  createPlanTemplate: (input: {label: string; drafts: AllocationDraft[]; pinned?: boolean}) => boolean;
  updatePlanTemplate: (
    id: string,
    update: Partial<Omit<PlanTemplate, 'id' | 'createdAt' | 'lastUsedAt' | 'usageCount'>>,
  ) => boolean;
  deletePlanTemplate: (id: string) => boolean;
  duplicatePlanTemplate: (id: string) => boolean;
  togglePlanTemplatePinned: (id: string) => boolean;
  markPlanTemplateUsed: (id: string) => void;
  
  currentEgg: EggState;
  feedEgg: (date: string, allocationId: string) => boolean;
  completeEgg: (customPet?: CustomPet, nickname?: string) => CompletedPet | null;
  
  unlockedPets: Record<string, PetState[]>;
  completedPets: CompletedPet[];
  customPets: CustomPet[];
  syncPetData: () => void;
  feedCompletedPet: (instanceId: string) => boolean;
  cheerCompletedPet: (instanceId: string) => boolean;
  cleanCompletedPetWaste: (instanceId: string) => boolean;
  cleanSceneWaste: (theme: ThemeType) => number;
  updatePetPosition: (instanceId: string, x: number, y: number) => void;
  updatePetPositionsBatch: (updates: Array<{instanceId: string; x: number; y: number}>) => void;
  renameCompletedPet: (instanceId: string, nickname: string) => boolean;
  discardCompletedPet: (instanceId: string) => void;
  clearScenePets: () => void;
  spawnAllScenePets: () => void;
  
  simulatedDateOffset: number;
  advanceDay: () => void;
}

const ACTIVITY_ORDER: ActivityType[] = ['work', 'study', 'entertainment', 'rest', 'exercise'];

const DEFAULT_PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: 'workday',
    label: '工作日',
    drafts: [
      {type: 'work', hours: 8},
      {type: 'study', hours: 2},
      {type: 'exercise', hours: 1},
      {type: 'entertainment', hours: 2},
      {type: 'rest', hours: 11},
    ],
    pinned: true,
    createdAt: 1,
    updatedAt: 1,
    lastUsedAt: null,
    usageCount: 0,
  },
  {
    id: 'balanced',
    label: '平衡日',
    drafts: [
      {type: 'work', hours: 6},
      {type: 'study', hours: 3},
      {type: 'exercise', hours: 2},
      {type: 'entertainment', hours: 3},
      {type: 'rest', hours: 10},
    ],
    pinned: true,
    createdAt: 2,
    updatedAt: 2,
    lastUsedAt: null,
    usageCount: 0,
  },
  {
    id: 'weekend',
    label: '周末',
    drafts: [
      {type: 'work', hours: 1},
      {type: 'study', hours: 2},
      {type: 'exercise', hours: 2},
      {type: 'entertainment', hours: 5},
      {type: 'rest', hours: 14},
    ],
    pinned: true,
    createdAt: 3,
    updatedAt: 3,
    lastUsedAt: null,
    usageCount: 0,
  },
];

const getInitialEgg = (theme: ThemeType): EggState => ({
  theme: theme === 'C' ? 'A' : theme,
  progress: { focus: 0, heal: 0, active: 0 },
  petId: null,
  stage: 'egg',
  finalState: null,
  quality: null,
});

function getSpriteSceneByTheme(theme: ThemeType): PetSpriteScene {
  if (theme === 'A') return 'farm';
  if (theme === 'B') return 'ocean';
  return 'draw';
}

function getHatchSpritePool(theme: ThemeType) {
  const targetScene = getSpriteSceneByTheme(theme);
  const sceneMatched = PET_SPRITE_OPTIONS.filter((option) => option.scene === targetScene);
  if (sceneMatched.length > 0) return sceneMatched;

  const farmFallback = PET_SPRITE_OPTIONS.filter((option) => option.scene === 'farm');
  if (farmFallback.length > 0) return farmFallback;

  return PET_SPRITE_OPTIONS;
}

function getEggQuality(progress: EggState['progress']): PetQuality {
  const values = [progress.focus, progress.heal, progress.active];
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return 'common';

  const maxShare = Math.max(...values) / total;
  const minShare = Math.min(...values) / total;

  if (maxShare <= 0.52 && minShare >= 0.15) return 'epic';
  if (maxShare <= 0.7) return 'rare';
  return 'common';
}

function getThemeBySpriteScene(scene: PetSpriteScene): ThemeType {
  if (scene === 'farm') return 'A';
  if (scene === 'ocean') return 'B';
  return 'custom';
}

function createSceneSeedPet(
  petId: string,
  theme: ThemeType,
  spawnPosition?: {x: number; y: number},
): CompletedPet {
  const now = Date.now();
  const initialPoopState = createInitialPoopState();
  return {
    instanceId: Math.random().toString(36).substring(2, 9),
    petId,
    theme,
    state: 'base',
    quality: 'common',
    x: spawnPosition?.x ?? Math.random() * 80 + 10,
    y: spawnPosition?.y ?? Math.random() * 70 + 10,
    variant: Math.floor(Math.random() * 4),
    scale: 0.35 + Math.random() * 0.25,
    jumpDelay: -Math.random() * 3,
    moveDelay: -Math.random() * 12,
    floatDelay: -Math.random() * 10,
    health: roundMetric(PET_STATUS_DEFAULTS.health + (Math.random() - 0.5) * 8),
    satiety: roundMetric(PET_STATUS_DEFAULTS.satiety + (Math.random() - 0.5) * 10),
    mood: roundMetric(PET_STATUS_DEFAULTS.mood + (Math.random() - 0.5) * 12),
    hygiene: roundMetric(PET_STATUS_DEFAULTS.hygiene + (Math.random() - 0.5) * 10),
    wasteLevel: initialPoopState.wasteLevel,
    digestionLoad: roundMetric(Math.random() * 8),
    poopProgress: initialPoopState.poopProgress,
    wasteCount: initialPoopState.wasteCount,
    statusUpdatedAt: now,
  };
}

function getHatchSpawnPosition(theme: ThemeType, existingPets: CompletedPet[]) {
  const xMin = SCENE_X_MIN;
  const xMax = SCENE_X_MAX;
  const yMin = SCENE_SPAWN_Y_MIN;
  const yMax = SCENE_SPAWN_Y_MAX;
  const centerX = (xMin + xMax) / 2;
  const centerY = (yMin + yMax) / 2;
  const sameThemePets = existingPets.filter((pet) => pet.theme === theme);

  const randomCandidate = () => ({
    x: xMin + Math.random() * (xMax - xMin),
    y: yMin + Math.random() * (yMax - yMin),
  });

  if (sameThemePets.length === 0) return randomCandidate();

  let best = randomCandidate();
  let bestScore = -Infinity;

  for (let attempt = 0; attempt < 48; attempt += 1) {
    const candidate = randomCandidate();
    let minDistance = Infinity;

    sameThemePets.forEach((pet) => {
      const dx = (candidate.x - pet.x) / 1.1;
      const dy = (candidate.y - pet.y) / 0.9;
      const distance = Math.hypot(dx, dy);
      if (distance < minDistance) minDistance = distance;
    });

    const centerDistance = Math.hypot(
      (candidate.x - centerX) / (xMax - xMin),
      (candidate.y - centerY) / (yMax - yMin),
    );
    const score = minDistance + centerDistance * 4.2;

    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

type PetCareAction = 'feed' | 'cheer' | 'clean';
const BASE_POOP_PROGRESS_GAIN_PER_HOUR = 0.4;
const DIGESTION_TO_POOP_PROGRESS_PER_HOUR = 24;
const FEED_BLOCK_SATIETY = 100;
const FEED_SATIETY_GAIN = 5;
const FEED_DIGESTION_GAIN = 18;
const FEED_POOP_PROGRESS_GAIN = 4;
const FEED_HYGIENE_LOSS = 0.6;
const FEED_HEALTH_GAIN = 1.6;
const POOP_PROGRESS_THRESHOLD = 40;
const POOP_HYGIENE_LOSS = 7;
const POOP_MOOD_LOSS = 2.5;
const WASTE_LEVEL_PER_POOP = 28;
const WASTE_PROGRESS_LEVEL_MAX = 10;
const WASTE_CLEANLINESS_PENALTY_PER_POOP = 18;
const WASTE_MOOD_LOSS_PER_HOUR = 0.85;
const WASTE_HEALTH_LOSS_PER_HOUR = 0.9;
const CHEER_MOOD_GAIN = 5;

function getDigestionLoad(value: number | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return clampMetric(value);
}

function clampPoopProgress(value: number | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(POOP_PROGRESS_THRESHOLD - 0.1, value));
}

function getWasteCount(value: number | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return Math.max(0, Math.round(value));
}

function getWasteLevelFromPoopState(wasteCount: number, poopProgress: number) {
  return roundMetric(
    wasteCount * WASTE_LEVEL_PER_POOP
    + (poopProgress / POOP_PROGRESS_THRESHOLD) * WASTE_PROGRESS_LEVEL_MAX,
  );
}

function derivePoopStateFromLegacyWaste(wasteLevel: number) {
  const safeWasteLevel = clampMetric(wasteLevel);
  const wasteCount = Math.floor(safeWasteLevel / WASTE_LEVEL_PER_POOP);
  const remainder = Math.max(0, safeWasteLevel - wasteCount * WASTE_LEVEL_PER_POOP);
  const poopProgress = roundMetric((remainder / WASTE_LEVEL_PER_POOP) * POOP_PROGRESS_THRESHOLD);

  return {
    wasteCount,
    poopProgress: clampPoopProgress(poopProgress),
  };
}

function createInitialPoopState() {
  const poopProgress = roundMetric(Math.random() * 8);
  const wasteCount = 0;

  return {
    poopProgress,
    wasteCount,
    wasteLevel: getWasteLevelFromPoopState(wasteCount, poopProgress),
  };
}

function withPetStatus(pet: CompletedPet, fallbackNow: number): CompletedPet {
  const legacyWasteLevel = getPetMetric(pet, 'wasteLevel');
  const legacyPoopState = derivePoopStateFromLegacyWaste(legacyWasteLevel);
  const wasteCount = typeof pet.wasteCount === 'number'
    ? getWasteCount(pet.wasteCount)
    : legacyPoopState.wasteCount;
  const poopProgress = typeof pet.poopProgress === 'number'
    ? clampPoopProgress(pet.poopProgress)
    : legacyPoopState.poopProgress;

  return {
    ...pet,
    health: getPetMetric(pet, 'health'),
    satiety: getPetMetric(pet, 'satiety'),
    mood: getPetMetric(pet, 'mood'),
    hygiene: getPetMetric(pet, 'hygiene'),
    wasteLevel: getWasteLevelFromPoopState(wasteCount, poopProgress),
    digestionLoad: getDigestionLoad(pet.digestionLoad),
    wasteCount,
    poopProgress,
    statusUpdatedAt: pet.statusUpdatedAt ?? fallbackNow,
  };
}

function getHealthTarget(satiety: number, mood: number, hygiene: number, wasteCount: number) {
  const cleanlinessScore = clampMetric(hygiene - wasteCount * WASTE_CLEANLINESS_PENALTY_PER_POOP);
  return clampMetric(satiety * 0.34 + mood * 0.31 + cleanlinessScore * 0.35);
}

function resolvePoopProgressState(input: {
  poopProgress: number;
  wasteCount: number;
  hygiene: number;
  mood: number;
}) {
  const createdWaste = Math.max(0, Math.floor(input.poopProgress / POOP_PROGRESS_THRESHOLD));
  if (createdWaste === 0) {
    return {
      poopProgress: clampPoopProgress(input.poopProgress),
      wasteCount: getWasteCount(input.wasteCount),
      hygiene: roundMetric(input.hygiene),
      mood: roundMetric(input.mood),
      createdWaste: 0,
    };
  }

  const remainder = input.poopProgress - createdWaste * POOP_PROGRESS_THRESHOLD;
  return {
    poopProgress: clampPoopProgress(remainder),
    wasteCount: getWasteCount(input.wasteCount) + createdWaste,
    hygiene: roundMetric(input.hygiene - createdWaste * POOP_HYGIENE_LOSS),
    mood: roundMetric(input.mood - createdWaste * POOP_MOOD_LOSS),
    createdWaste,
  };
}

function applyPetPassiveStatus(pet: CompletedPet, now: number): CompletedPet {
  const normalized = withPetStatus(pet, now);
  const elapsedHours = Math.max(0, (now - (normalized.statusUpdatedAt ?? now)) / 3_600_000);

  if (elapsedHours < 1 / 120) return normalized;

  const satiety = roundMetric(normalized.satiety! - elapsedHours * 5.4);
  let mood = roundMetric(
    normalized.mood! - elapsedHours * (2 + (satiety < 35 ? 1.25 : 0) + normalized.wasteCount! * WASTE_MOOD_LOSS_PER_HOUR),
  );
  let hygiene = roundMetric(normalized.hygiene! - elapsedHours * 3.7);
  const digestionConverted = Math.min(
    normalized.digestionLoad!,
    elapsedHours * DIGESTION_TO_POOP_PROGRESS_PER_HOUR,
  );
  const digestionLoad = roundMetric(normalized.digestionLoad! - digestionConverted);
  const poopResolved = resolvePoopProgressState({
    poopProgress: normalized.poopProgress! + elapsedHours * BASE_POOP_PROGRESS_GAIN_PER_HOUR + digestionConverted,
    wasteCount: normalized.wasteCount!,
    hygiene,
    mood,
  });
  mood = poopResolved.mood;
  hygiene = poopResolved.hygiene;
  const wasteCount = poopResolved.wasteCount;
  const poopProgress = poopResolved.poopProgress;
  const wasteLevel = getWasteLevelFromPoopState(wasteCount, poopProgress);

  let health = normalized.health!;
  const targetHealth = getHealthTarget(satiety, mood, hygiene, wasteCount);
  health = roundMetric(health + (targetHealth - health) * Math.min(0.9, elapsedHours * 0.34));

  if (satiety < 24) {
    health = roundMetric(health - elapsedHours * 1.35);
  }
  if (wasteCount > 2) {
    health = roundMetric(health - elapsedHours * (wasteCount - 2) * WASTE_HEALTH_LOSS_PER_HOUR);
  }

  return {
    ...normalized,
    satiety,
    mood,
    hygiene,
    wasteLevel,
    digestionLoad,
    poopProgress,
    wasteCount,
    health,
    statusUpdatedAt: now,
  };
}

function applyPetWasteCleanup(base: CompletedPet, cleanedWasteCount: number, now: number): CompletedPet {
  const resolvedCleanedWasteCount = Math.max(0, Math.min(base.wasteCount ?? 0, Math.round(cleanedWasteCount)));
  if (resolvedCleanedWasteCount <= 0) {
    return {
      ...base,
      statusUpdatedAt: now,
    };
  }

  const hygiene = roundMetric(base.hygiene! + Math.min(42, resolvedCleanedWasteCount * 14));
  const mood = roundMetric(base.mood! + resolvedCleanedWasteCount * 3);
  let health = roundMetric(base.health! + resolvedCleanedWasteCount * 1.5);
  const wasteCount = Math.max(0, (base.wasteCount ?? 0) - resolvedCleanedWasteCount);
  const wasteLevel = getWasteLevelFromPoopState(wasteCount, base.poopProgress!);
  const targetHealth = getHealthTarget(base.satiety!, mood, hygiene, wasteCount);
  health = roundMetric(health + (targetHealth - health) * 0.28);

  return {
    ...base,
    hygiene,
    mood,
    health,
    wasteLevel,
    wasteCount,
    statusUpdatedAt: now,
  };
}

function applyPetCareAction(pet: CompletedPet, action: PetCareAction, now: number): CompletedPet {
  const base = applyPetPassiveStatus(pet, now);
  if (action === 'clean') {
    return applyPetWasteCleanup(base, base.wasteCount ?? 0, now);
  }

  let satiety = base.satiety!;
  let mood = base.mood!;
  let hygiene = base.hygiene!;
  let digestionLoad = base.digestionLoad!;
  let poopProgress = base.poopProgress!;
  let wasteCount = base.wasteCount!;
  let health = base.health!;

  if (action === 'feed') {
    satiety = roundMetric(satiety + FEED_SATIETY_GAIN);
    mood = roundMetric(mood + 4);
    hygiene = roundMetric(hygiene - FEED_HYGIENE_LOSS);
    digestionLoad = roundMetric(digestionLoad + FEED_DIGESTION_GAIN);
    poopProgress = roundMetric(poopProgress + FEED_POOP_PROGRESS_GAIN);
    health = roundMetric(health + FEED_HEALTH_GAIN);
  }

  if (action === 'cheer') {
    mood = roundMetric(mood + CHEER_MOOD_GAIN);
  }

  const poopResolved = resolvePoopProgressState({
    poopProgress,
    wasteCount,
    hygiene,
    mood,
  });
  poopProgress = poopResolved.poopProgress;
  wasteCount = poopResolved.wasteCount;
  hygiene = poopResolved.hygiene;
  mood = poopResolved.mood;

  const wasteLevel = getWasteLevelFromPoopState(wasteCount, poopProgress);
  if (action !== 'cheer') {
    const targetHealth = getHealthTarget(satiety, mood, hygiene, wasteCount);
    health = roundMetric(health + (targetHealth - health) * 0.28);
  }

  return {
    ...base,
    satiety,
    mood,
    hygiene,
    wasteLevel,
    digestionLoad,
    poopProgress,
    wasteCount,
    health,
    statusUpdatedAt: now,
  };
}

const createAllocation = (type: ActivityType, hours: number, offset = 0): Allocation => ({
  id: Math.random().toString(36).substring(2, 9),
  type,
  hours,
  used: false,
  timestamp: Date.now() + offset,
});

function setDailyAllocations(
  allocations: Record<string, Allocation[]>,
  date: string,
  nextDailyAllocations: Allocation[],
) {
  if (nextDailyAllocations.length === 0) {
    const {[date]: _removed, ...rest} = allocations;
    return rest;
  }

  return {
    ...allocations,
    [date]: nextDailyAllocations,
  };
}

function sanitizeDrafts(drafts: AllocationDraft[]) {
  const totals = ACTIVITY_ORDER.reduce<Record<ActivityType, number>>(
    (result, type) => ({...result, [type]: 0}),
    {
      work: 0,
      study: 0,
      entertainment: 0,
      rest: 0,
      exercise: 0,
    },
  );

  drafts.forEach((draft) => {
    if (draft.hours <= 0) return;
    totals[draft.type] += draft.hours;
  });

  return ACTIVITY_ORDER.map((type) => ({
    type,
    hours: Math.round(totals[type] * 10) / 10,
  })).filter((draft) => draft.hours > 0);
}

function setDailyPlanDraftMap(
  dailyPlans: Record<string, AllocationDraft[]>,
  date: string,
  drafts: AllocationDraft[],
) {
  if (drafts.length === 0) {
    const {[date]: _removed, ...rest} = dailyPlans;
    return rest;
  }

  return {
    ...dailyPlans,
    [date]: drafts,
  };
}

function sanitizeTemplateInput(input: {label: string; drafts: AllocationDraft[]; pinned?: boolean}) {
  return {
    label: input.label.trim(),
    drafts: sanitizeDrafts(input.drafts),
    pinned: Boolean(input.pinned),
  };
}

function normalizePlanTemplate(
  template: Partial<PlanTemplate> & Pick<PlanTemplate, 'id' | 'label' | 'drafts'>,
  fallbackTimestamp: number,
): PlanTemplate {
  const createdAt = template.createdAt ?? fallbackTimestamp;
  return {
    id: template.id,
    label: template.label.trim(),
    drafts: sanitizeDrafts(template.drafts),
    pinned: Boolean(template.pinned),
    createdAt,
    updatedAt: template.updatedAt ?? createdAt,
    lastUsedAt: template.lastUsedAt ?? null,
    usageCount: template.usageCount ?? 0,
  };
}

function duplicateTemplateLabel(label: string, existingLabels: string[]) {
  const baseLabel = `${label} 副本`;
  if (!existingLabels.includes(baseLabel)) return baseLabel;

  let index = 2;
  while (existingLabels.includes(`${baseLabel} ${index}`)) {
    index += 1;
  }

  return `${baseLabel} ${index}`;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentTab: 'home',
      setCurrentTab: (tab) => set({ currentTab: tab }),
      homeTabEnterSignal: 0,
      enterHomeTab: () =>
        set((state) => ({
          currentTab: 'home',
          homeTabEnterSignal: state.homeTabEnterSignal + 1,
        })),
      
      currentTheme: 'A',
      setCurrentTheme: (theme) => set({ currentTheme: theme === 'C' ? 'A' : theme }),
      
      allocations: {},
      dailyPlans: {},
      planTemplates: DEFAULT_PLAN_TEMPLATES,
      allocateTime: (date, type, hours) => {
        const state = get();
        const dailyAllocs = state.allocations[date] || [];
        const totalAllocated = dailyAllocs.reduce((sum, a) => sum + a.hours, 0);
        
        if (totalAllocated + hours > 24) {
          return false; // Exceeds 24h limit
        }

        const newAlloc = createAllocation(type, hours);
        
        set({
          allocations: {
            ...state.allocations,
            [date]: [...dailyAllocs, newAlloc]
          }
        });
        return true;
      },
      applyAllocationDrafts: (date, drafts) => {
        const state = get();
        const dailyAllocs = state.allocations[date] || [];

        if (dailyAllocs.some((allocation) => allocation.used)) return false;

        const sanitizedDrafts = sanitizeDrafts(drafts);
        const totalHours = sanitizedDrafts.reduce((sum, draft) => sum + draft.hours, 0);

        if (totalHours > 24) return false;

        const nextDailyAllocations = sanitizedDrafts.map((draft, index) =>
          createAllocation(draft.type, draft.hours, index),
        );

        set({
          allocations: setDailyAllocations(state.allocations, date, nextDailyAllocations),
        });

        return true;
      },
      copyAllocationsFromDate: (sourceDate, targetDate) => {
        const state = get();
        const sourceAllocations = state.allocations[sourceDate] || [];
        const targetAllocations = state.allocations[targetDate] || [];

        if (sourceAllocations.length === 0 || targetAllocations.some((allocation) => allocation.used)) {
          return false;
        }

        const nextDailyAllocations = sourceAllocations.map((allocation, index) =>
          createAllocation(allocation.type, allocation.hours, index),
        );

        set({
          allocations: setDailyAllocations(state.allocations, targetDate, nextDailyAllocations),
        });

        return true;
      },
      removeLastUnusedAllocation: (date) => {
        const state = get();
        const dailyAllocs = state.allocations[date] || [];
        const lastUnusedIndex = [...dailyAllocs]
          .map((allocation, index) => ({allocation, index}))
          .filter(({allocation}) => !allocation.used)
          .sort((left, right) => right.allocation.timestamp - left.allocation.timestamp)[0]?.index;

        if (lastUnusedIndex === undefined) return false;

        const nextDailyAllocations = dailyAllocs.filter((_, index) => index !== lastUnusedIndex);

        set({
          allocations: setDailyAllocations(state.allocations, date, nextDailyAllocations),
        });

        return true;
      },
      clearUnusedAllocations: (date) => {
        const state = get();
        const dailyAllocs = state.allocations[date] || [];
        const nextDailyAllocations = dailyAllocs.filter((allocation) => allocation.used);

        if (nextDailyAllocations.length === dailyAllocs.length) return false;

        set({
          allocations: setDailyAllocations(state.allocations, date, nextDailyAllocations),
        });

        return true;
      },
      updateUnusedAllocation: (date, allocationId, update) => {
        const state = get();
        const dailyAllocs = state.allocations[date] || [];
        const allocationIndex = dailyAllocs.findIndex(
          (allocation) => allocation.id === allocationId && !allocation.used,
        );

        if (allocationIndex === -1) return false;

        const currentAllocation = dailyAllocs[allocationIndex];
        const nextHours = update.hours ?? currentAllocation.hours;
        const nextType = update.type ?? currentAllocation.type;

        if (nextHours <= 0) return false;

        const totalWithoutCurrent = dailyAllocs.reduce((sum, allocation, index) => {
          if (index === allocationIndex) return sum;
          return sum + allocation.hours;
        }, 0);

        if (totalWithoutCurrent + nextHours > 24) return false;

        const nextDailyAllocations = [...dailyAllocs];
        nextDailyAllocations[allocationIndex] = {
          ...currentAllocation,
          type: nextType,
          hours: nextHours,
        };

        set({
          allocations: setDailyAllocations(state.allocations, date, nextDailyAllocations),
        });

        return true;
      },
      deleteUnusedAllocation: (date, allocationId) => {
        const state = get();
        const dailyAllocs = state.allocations[date] || [];
        const allocation = dailyAllocs.find((item) => item.id === allocationId);

        if (!allocation || allocation.used) return false;

        const nextDailyAllocations = dailyAllocs.filter((item) => item.id !== allocationId);

        set({
          allocations: setDailyAllocations(state.allocations, date, nextDailyAllocations),
        });

        return true;
      },
      setDailyPlanDrafts: (date, drafts) => {
        const state = get();
        const sanitizedDrafts = sanitizeDrafts(drafts);
        const totalHours = sanitizedDrafts.reduce((sum, draft) => sum + draft.hours, 0);

        if (totalHours > 24) return false;

        set({
          dailyPlans: setDailyPlanDraftMap(state.dailyPlans, date, sanitizedDrafts),
        });

        return true;
      },
      clearDailyPlan: (date) => {
        const state = get();
        const currentPlan = state.dailyPlans[date] || [];

        if (currentPlan.length === 0) return false;

        set({
          dailyPlans: setDailyPlanDraftMap(state.dailyPlans, date, []),
        });

        return true;
      },
      createPlanTemplate: (input) => {
        const state = get();
        const nextTemplate = sanitizeTemplateInput(input);
        const totalHours = nextTemplate.drafts.reduce((sum, draft) => sum + draft.hours, 0);

        if (!nextTemplate.label || nextTemplate.drafts.length === 0 || totalHours > 24) {
          return false;
        }

        const now = Date.now();

        set({
          planTemplates: [
            ...state.planTemplates,
            normalizePlanTemplate(
              {
                id: Math.random().toString(36).substring(2, 9),
                ...nextTemplate,
                createdAt: now,
                updatedAt: now,
                lastUsedAt: null,
                usageCount: 0,
              },
              now,
            ),
          ],
        });

        return true;
      },
      updatePlanTemplate: (id, update) => {
        const state = get();
        const templateIndex = state.planTemplates.findIndex((template) => template.id === id);

        if (templateIndex === -1) return false;

        const currentTemplate = state.planTemplates[templateIndex];
        const nextTemplate = sanitizeTemplateInput({
          label: update.label ?? currentTemplate.label,
          drafts: update.drafts ?? currentTemplate.drafts,
          pinned: update.pinned ?? currentTemplate.pinned,
        });
        const totalHours = nextTemplate.drafts.reduce((sum, draft) => sum + draft.hours, 0);

        if (!nextTemplate.label || nextTemplate.drafts.length === 0 || totalHours > 24) {
          return false;
        }

        const nextTemplates = [...state.planTemplates];
        nextTemplates[templateIndex] = normalizePlanTemplate(
          {
            ...currentTemplate,
            ...nextTemplate,
            updatedAt: Date.now(),
          },
          currentTemplate.createdAt,
        );

        set({
          planTemplates: nextTemplates,
        });

        return true;
      },
      deletePlanTemplate: (id) => {
        const state = get();
        const nextTemplates = state.planTemplates.filter((template) => template.id !== id);

        if (nextTemplates.length === state.planTemplates.length) return false;

        set({
          planTemplates: nextTemplates,
        });

        return true;
      },
      duplicatePlanTemplate: (id) => {
        const state = get();
        const template = state.planTemplates.find((item) => item.id === id);

        if (!template) return false;

        const now = Date.now();
        const nextLabel = duplicateTemplateLabel(
          template.label,
          state.planTemplates.map((item) => item.label),
        );

        set({
          planTemplates: [
            ...state.planTemplates,
            normalizePlanTemplate(
              {
                ...template,
                id: Math.random().toString(36).substring(2, 9),
                label: nextLabel,
                pinned: false,
                createdAt: now,
                updatedAt: now,
                lastUsedAt: null,
                usageCount: 0,
              },
              now,
            ),
          ],
        });

        return true;
      },
      togglePlanTemplatePinned: (id) => {
        const state = get();
        const templateIndex = state.planTemplates.findIndex((template) => template.id === id);

        if (templateIndex === -1) return false;

        const nextTemplates = [...state.planTemplates];
        const currentTemplate = nextTemplates[templateIndex];
        nextTemplates[templateIndex] = {
          ...currentTemplate,
          pinned: !currentTemplate.pinned,
          updatedAt: Date.now(),
        };

        set({
          planTemplates: nextTemplates,
        });

        return true;
      },
      markPlanTemplateUsed: (id) => {
        const state = get();
        const templateIndex = state.planTemplates.findIndex((template) => template.id === id);

        if (templateIndex === -1) return;

        const nextTemplates = [...state.planTemplates];
        const currentTemplate = nextTemplates[templateIndex];
        nextTemplates[templateIndex] = {
          ...currentTemplate,
          lastUsedAt: Date.now(),
          usageCount: currentTemplate.usageCount + 1,
        };

        set({
          planTemplates: nextTemplates,
        });
      },
      
      currentEgg: getInitialEgg('A'),
      
      feedEgg: (date, allocationId) => {
        const state = get();
        const dailyAllocs = state.allocations[date] || [];
        const allocIndex = dailyAllocs.findIndex(a => a.id === allocationId);
        
        if (allocIndex === -1 || dailyAllocs[allocIndex].used) return false;
        
        const alloc = dailyAllocs[allocIndex];
        const newAllocs = [...dailyAllocs];
        newAllocs[allocIndex] = { ...alloc, used: true };
        
        // Map activity to stat
        let stat: 'focus' | 'heal' | 'active' = 'focus';
        if (alloc.type === 'work' || alloc.type === 'study') stat = 'focus';
        if (alloc.type === 'entertainment' || alloc.type === 'rest') stat = 'heal';
        if (alloc.type === 'exercise') stat = 'active';
        
        const egg = { ...state.currentEgg };
        egg.progress = { ...egg.progress, [stat]: egg.progress[stat] + alloc.hours };
        
        const totalProgress = egg.progress.focus + egg.progress.heal + egg.progress.active;
        
        // Check thresholds
        if (totalProgress >= 8 && egg.stage === 'egg') {
          const hatchPool = getHatchSpritePool(egg.theme);
          const randomSprite = hatchPool[Math.floor(Math.random() * hatchPool.length)];
          if (randomSprite) {
            egg.petId = randomSprite.key;
            egg.stage = 'base';

            const currentUnlocked = state.unlockedPets[randomSprite.key] || [];
            if (!currentUnlocked.includes('base')) {
              set(s => ({
                unlockedPets: { ...s.unlockedPets, [randomSprite.key]: [...currentUnlocked, 'base'] }
              }));
            }
          }
        }
        
        if (totalProgress >= 24 && egg.stage === 'base') {
          // Evolve
          const { focus, heal, active } = egg.progress;
          let finalState: PetState = 'focus';
          if (heal > focus && heal >= active) finalState = 'heal';
          if (active > focus && active > heal) finalState = 'active';
          
          egg.finalState = finalState;
          egg.stage = 'evolved';
          egg.quality = getEggQuality(egg.progress);
          
          // Unlock evolved in pokedex
          if (egg.petId) {
            const currentUnlocked = get().unlockedPets[egg.petId] || [];
            if (!currentUnlocked.includes(finalState)) {
              set(s => ({
                unlockedPets: { ...s.unlockedPets, [egg.petId!]: [...currentUnlocked, finalState] }
              }));
            }
          }
        }
        
        set({
          allocations: { ...state.allocations, [date]: newAllocs },
          currentEgg: egg
        });
        
        return true;
      },
      
      completeEgg: (customPet, nickname) => {
        const state = get();
        const egg = state.currentEgg;
        
        if (egg.stage !== 'evolved' || !egg.petId || !egg.finalState) return null;
        
        let petId = egg.petId;
        let theme = egg.theme;
        const quality = egg.quality ?? getEggQuality(egg.progress);
        const normalizedNickname = nickname?.trim() || undefined;
        
        if (customPet) {
          petId = customPet.id;
          theme = 'custom';
        } else {
          const spriteOption = getPetSpriteOptionByKey(petId);
          if (spriteOption?.scene === 'farm') theme = 'A';
          if (spriteOption?.scene === 'ocean') theme = 'B';
          if (spriteOption?.scene === 'draw') theme = 'custom';
        }
        const spawnPosition = getHatchSpawnPosition(theme, state.completedPets);
        const initialPoopState = createInitialPoopState();

        const newCompleted: CompletedPet = {
          instanceId: Math.random().toString(36).substring(2, 9),
          petId,
          nickname: customPet ? customPet.name : normalizedNickname,
          theme,
          state: egg.finalState,
          quality,
          x: spawnPosition.x,
          y: spawnPosition.y,
          variant: Math.floor(Math.random() * 4),
          scale: 0.35 + Math.random() * 0.25, // Reduced scale further
          jumpDelay: -Math.random() * 3, // Negative delay to start mid-animation
          moveDelay: -Math.random() * 12,
          floatDelay: -Math.random() * 10,
          health: roundMetric(PET_STATUS_DEFAULTS.health + (Math.random() - 0.5) * 8),
          satiety: roundMetric(PET_STATUS_DEFAULTS.satiety + (Math.random() - 0.5) * 10),
          mood: roundMetric(PET_STATUS_DEFAULTS.mood + (Math.random() - 0.5) * 12),
          hygiene: roundMetric(PET_STATUS_DEFAULTS.hygiene + (Math.random() - 0.5) * 10),
          wasteLevel: initialPoopState.wasteLevel,
          digestionLoad: roundMetric(Math.random() * 8),
          poopProgress: initialPoopState.poopProgress,
          wasteCount: initialPoopState.wasteCount,
          statusUpdatedAt: Date.now(),
        };
        
        const updates: Partial<AppState> = {
          completedPets: [...state.completedPets, newCompleted],
          currentEgg: getInitialEgg(state.currentTheme === 'custom' ? 'A' : state.currentTheme)
        };

        if (customPet) {
          updates.customPets = [...state.customPets, customPet];
          const currentUnlocked = state.unlockedPets[customPet.id] || [];
          updates.unlockedPets = {
            ...state.unlockedPets,
            [customPet.id]: [...currentUnlocked, 'base', egg.finalState]
          };
        }

        set(updates);
        return newCompleted;
      },
      
      unlockedPets: {}, // Start empty, unlock via hatching
      completedPets: [],
      customPets: [],
      syncPetData: () => {
        const state = get();
        const now = Date.now();
        let changed = false;
        const updatedPets = state.completedPets.map(pet => {
          const patchedBase = {
            ...pet,
            quality: pet.quality ?? 'common',
            x: pet.x ?? Math.random() * 80 + 10,
            y: pet.y ?? Math.random() * 70 + 10,
            variant: pet.variant ?? Math.floor(Math.random() * 4),
            scale: pet.scale ?? 0.35 + Math.random() * 0.25,
            jumpDelay: pet.jumpDelay ?? -Math.random() * 3,
            moveDelay: pet.moveDelay ?? -Math.random() * 12,
            floatDelay: pet.floatDelay ?? -Math.random() * 10,
          };
          const patchedPet = applyPetPassiveStatus(patchedBase, now);
          const hasPatched =
            patchedPet.quality !== pet.quality ||
            patchedPet.x !== pet.x ||
            patchedPet.y !== pet.y ||
            patchedPet.variant !== pet.variant ||
            patchedPet.scale !== pet.scale ||
            patchedPet.jumpDelay !== pet.jumpDelay ||
            patchedPet.moveDelay !== pet.moveDelay ||
            patchedPet.floatDelay !== pet.floatDelay ||
            patchedPet.health !== pet.health ||
            patchedPet.satiety !== pet.satiety ||
            patchedPet.mood !== pet.mood ||
            patchedPet.hygiene !== pet.hygiene ||
            patchedPet.wasteLevel !== pet.wasteLevel ||
            patchedPet.digestionLoad !== pet.digestionLoad ||
            patchedPet.poopProgress !== pet.poopProgress ||
            patchedPet.wasteCount !== pet.wasteCount ||
            patchedPet.statusUpdatedAt !== pet.statusUpdatedAt;

          if (hasPatched) {
            changed = true;
          }

          return patchedPet;
        });
        if (changed) {
          set({ completedPets: updatedPets });
        }
      },
      feedCompletedPet: (instanceId) => {
        const state = get();
        const now = Date.now();
        let changed = false;
        let found = false;
        let fed = false;

        const nextPets = state.completedPets.map((pet) => {
          const passivePet = applyPetPassiveStatus(pet, now);
          let nextPet = passivePet;

          if (pet.instanceId === instanceId) {
            found = true;
            if ((passivePet.satiety ?? 0) < FEED_BLOCK_SATIETY) {
              nextPet = applyPetCareAction(passivePet, 'feed', now);
              fed = true;
            }
          }

          if (
            nextPet.health !== pet.health ||
            nextPet.satiety !== pet.satiety ||
            nextPet.mood !== pet.mood ||
            nextPet.hygiene !== pet.hygiene ||
            nextPet.wasteLevel !== pet.wasteLevel ||
            nextPet.digestionLoad !== pet.digestionLoad ||
            nextPet.poopProgress !== pet.poopProgress ||
            nextPet.wasteCount !== pet.wasteCount ||
            nextPet.statusUpdatedAt !== pet.statusUpdatedAt
          ) {
            changed = true;
          }
          return nextPet;
        });

        if (!found) return false;
        if (changed) set({completedPets: nextPets});
        return fed;
      },
      cheerCompletedPet: (instanceId) => {
        const state = get();
        const now = Date.now();
        let changed = false;
        let found = false;

        const nextPets = state.completedPets.map((pet) => {
          const passivePet = applyPetPassiveStatus(pet, now);
          let nextPet = passivePet;

          if (pet.instanceId === instanceId) {
            found = true;
            nextPet = applyPetCareAction(passivePet, 'cheer', now);
          }

          if (
            nextPet.health !== pet.health ||
            nextPet.satiety !== pet.satiety ||
            nextPet.mood !== pet.mood ||
            nextPet.hygiene !== pet.hygiene ||
            nextPet.wasteLevel !== pet.wasteLevel ||
            nextPet.digestionLoad !== pet.digestionLoad ||
            nextPet.poopProgress !== pet.poopProgress ||
            nextPet.wasteCount !== pet.wasteCount ||
            nextPet.statusUpdatedAt !== pet.statusUpdatedAt
          ) {
            changed = true;
          }
          return nextPet;
        });

        if (!found) return false;
        if (changed) set({completedPets: nextPets});
        return true;
      },
      cleanCompletedPetWaste: (instanceId) => {
        const state = get();
        const now = Date.now();
        let changed = false;
        let found = false;
        let cleaned = false;

        const nextPets = state.completedPets.map((pet) => {
          const passivePet = applyPetPassiveStatus(pet, now);
          let nextPet = passivePet;

          if (pet.instanceId === instanceId) {
            found = true;
            if ((passivePet.wasteCount ?? 0) > 0) {
              nextPet = applyPetWasteCleanup(passivePet, 1, now);
              cleaned = true;
            }
          }

          if (
            nextPet.health !== pet.health ||
            nextPet.satiety !== pet.satiety ||
            nextPet.mood !== pet.mood ||
            nextPet.hygiene !== pet.hygiene ||
            nextPet.wasteLevel !== pet.wasteLevel ||
            nextPet.digestionLoad !== pet.digestionLoad ||
            nextPet.poopProgress !== pet.poopProgress ||
            nextPet.wasteCount !== pet.wasteCount ||
            nextPet.statusUpdatedAt !== pet.statusUpdatedAt
          ) {
            changed = true;
          }
          return nextPet;
        });

        if (!found) return false;
        if (changed) set({completedPets: nextPets});
        return cleaned;
      },
      cleanSceneWaste: (theme) => {
        const normalizedTheme = theme === 'C' ? 'A' : theme;
        const state = get();
        const now = Date.now();
        let changed = false;
        let cleanedCount = 0;

        const nextPets = state.completedPets.map((pet) => {
          const passivePet = applyPetPassiveStatus(pet, now);
          let nextPet = passivePet;

          if (
            passivePet.theme === normalizedTheme
            && (passivePet.wasteCount ?? 0) > 0
          ) {
            cleanedCount += 1;
            nextPet = applyPetCareAction(passivePet, 'clean', now);
          }

          if (
            nextPet.health !== pet.health ||
            nextPet.satiety !== pet.satiety ||
            nextPet.mood !== pet.mood ||
            nextPet.hygiene !== pet.hygiene ||
            nextPet.wasteLevel !== pet.wasteLevel ||
            nextPet.digestionLoad !== pet.digestionLoad ||
            nextPet.poopProgress !== pet.poopProgress ||
            nextPet.wasteCount !== pet.wasteCount ||
            nextPet.statusUpdatedAt !== pet.statusUpdatedAt
          ) {
            changed = true;
          }

          return nextPet;
        });

        if (changed) set({completedPets: nextPets});
        return cleanedCount;
      },
      updatePetPosition: (instanceId, x, y) => {
        get().updatePetPositionsBatch([{instanceId, x, y}]);
      },
      updatePetPositionsBatch: (updates) => {
        if (updates.length === 0) return;

        const updateMap = new Map<string, {x: number; y: number}>();
        updates.forEach((item) => {
          updateMap.set(item.instanceId, {x: item.x, y: item.y});
        });
        if (updateMap.size === 0) return;

        const state = get();
        let changed = false;
        const nextPets = state.completedPets.map((pet) => {
          const nextPos = updateMap.get(pet.instanceId);
          if (!nextPos) return pet;

          if (Math.abs(nextPos.x - pet.x) < 0.01 && Math.abs(nextPos.y - pet.y) < 0.01) {
            return pet;
          }

          changed = true;
          return {
            ...pet,
            x: nextPos.x,
            y: nextPos.y,
          };
        });

        if (!changed) return;
        set({completedPets: nextPets});
      },
      renameCompletedPet: (instanceId, nickname) => {
        const normalized = nickname.trim();
        const state = get();
        const target = state.completedPets.find((pet) => pet.instanceId === instanceId);
        if (!target) return false;

        const nextNickname = normalized.length > 0 ? normalized : undefined;
        if ((target.nickname ?? undefined) === nextNickname) return false;

        set({
          completedPets: state.completedPets.map((pet) =>
            pet.instanceId === instanceId
              ? {
                  ...pet,
                  nickname: nextNickname,
                }
              : pet,
          ),
        });
        return true;
      },
      discardCompletedPet: (instanceId) => {
        set((state) => ({
          completedPets: state.completedPets.filter((pet) => pet.instanceId !== instanceId),
        }));
      },
      clearScenePets: () => {
        set((state) => {
          const theme = state.currentTheme === 'C' ? 'A' : state.currentTheme;
          return {
            completedPets: state.completedPets.filter((pet) => pet.theme !== theme),
          };
        });
      },
      spawnAllScenePets: () => {
        set((state) => {
          const theme = state.currentTheme === 'C' ? 'A' : state.currentTheme;
          const targetScene = getSpriteSceneByTheme(theme);
          const sceneOptions = PET_SPRITE_OPTIONS.filter((option) => option.scene === targetScene);

          if (sceneOptions.length === 0) {
            return {};
          }

          const nonScenePets = state.completedPets.filter((pet) => pet.theme !== theme);
          const seededPets: CompletedPet[] = [];
          sceneOptions.forEach((option) => {
            const optionTheme = getThemeBySpriteScene(option.scene);
            const spawnPosition = getHatchSpawnPosition(optionTheme, [...nonScenePets, ...seededPets]);
            seededPets.push(createSceneSeedPet(option.key, optionTheme, spawnPosition));
          });

          return {
            completedPets: [...nonScenePets, ...seededPets],
          };
        });
      },
      
      simulatedDateOffset: 0,
      advanceDay: () => set((state) => ({ simulatedDateOffset: state.simulatedDateOffset + 1 })),
    }),
    {
      name: 'chronotext-storage-v3', // Change name to avoid conflicts with old schema
      merge: (persistedState, currentState) => {
        const typedPersistedState = persistedState as Partial<AppState> | undefined;
        const rawTemplates =
          typedPersistedState?.planTemplates && typedPersistedState.planTemplates.length > 0
            ? typedPersistedState.planTemplates
            : currentState.planTemplates;
        const nextTheme =
          typedPersistedState?.currentTheme && typedPersistedState.currentTheme !== 'C'
            ? typedPersistedState.currentTheme
            : currentState.currentTheme;
        const nextEgg = typedPersistedState?.currentEgg
          ? {
              ...typedPersistedState.currentEgg,
              theme:
                typedPersistedState.currentEgg.theme === 'C'
                  ? 'A'
                  : typedPersistedState.currentEgg.theme,
              quality: typedPersistedState.currentEgg.quality ?? null,
            }
          : currentState.currentEgg;
        const now = Date.now();
        const completedPets =
          typedPersistedState?.completedPets?.map((pet) =>
            applyPetPassiveStatus(
              {
                ...pet,
                quality: pet.quality ?? 'common',
                statusUpdatedAt: pet.statusUpdatedAt ?? now,
              },
              now,
            ),
          ) ?? currentState.completedPets;

        return {
          ...currentState,
          ...typedPersistedState,
          currentTheme: nextTheme,
          currentEgg: nextEgg,
          completedPets,
          planTemplates: rawTemplates.map((template, index) =>
            normalizePlanTemplate(template, Date.now() + index),
          ),
        };
      },
    }
  )
);
