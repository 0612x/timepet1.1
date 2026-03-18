import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ThemeType, PetState, PETS } from '../data/pets';

export type TabType = 'home' | 'feed' | 'scene' | 'pokedex' | 'stats';
export type ActivityType = 'work' | 'study' | 'entertainment' | 'rest' | 'exercise';

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
}

export interface CompletedPet {
  instanceId: string;
  petId: string;
  theme: ThemeType;
  state: PetState;
  x: number;
  y: number;
  variant: number;
  scale: number;
  jumpDelay: number;
  moveDelay: number;
  floatDelay: number;
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
  completeEgg: (customPet?: CustomPet) => void;
  
  unlockedPets: Record<string, PetState[]>;
  completedPets: CompletedPet[];
  customPets: CustomPet[];
  syncPetData: () => void;
  updatePetPosition: (instanceId: string, x: number, y: number) => void;
  
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
  theme,
  progress: { focus: 0, heal: 0, active: 0 },
  petId: null,
  stage: 'egg',
  finalState: null,
});

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
      
      currentTheme: 'A',
      setCurrentTheme: (theme) => set({ currentTheme: theme }),
      
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
          // Hatch into base pet
          const themePets = PETS.filter(p => p.theme === egg.theme);
          const randomPet = themePets[Math.floor(Math.random() * themePets.length)];
          egg.petId = randomPet.id;
          egg.stage = 'base';
          
          // Unlock base in pokedex
          const currentUnlocked = state.unlockedPets[randomPet.id] || [];
          if (!currentUnlocked.includes('base')) {
            set(s => ({
              unlockedPets: { ...s.unlockedPets, [randomPet.id]: [...currentUnlocked, 'base'] }
            }));
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
      
      completeEgg: (customPet) => {
        const state = get();
        const egg = state.currentEgg;
        
        if (egg.stage !== 'evolved' || !egg.petId || !egg.finalState) return;
        
        let petId = egg.petId;
        let theme = egg.theme;
        
        if (customPet) {
          petId = customPet.id;
          theme = 'custom';
        }

        const newCompleted: CompletedPet = {
          instanceId: Math.random().toString(36).substring(2, 9),
          petId,
          theme,
          state: egg.finalState,
          x: Math.random() * 80 + 10,
          y: Math.random() * 70 + 10,
          variant: Math.floor(Math.random() * 4),
          scale: 0.35 + Math.random() * 0.25, // Reduced scale further
          jumpDelay: -Math.random() * 3, // Negative delay to start mid-animation
          moveDelay: -Math.random() * 12,
          floatDelay: -Math.random() * 10,
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
      },
      
      unlockedPets: {}, // Start empty, unlock via hatching
      completedPets: [],
      customPets: [],
      syncPetData: () => {
        const state = get();
        let changed = false;
        const updatedPets = state.completedPets.map(pet => {
          if (pet.x === undefined) {
            changed = true;
            return {
              ...pet,
              x: Math.random() * 80 + 10,
              y: Math.random() * 70 + 10,
              variant: Math.floor(Math.random() * 4),
              scale: 0.35 + Math.random() * 0.25,
              jumpDelay: -Math.random() * 3,
              moveDelay: -Math.random() * 12,
              floatDelay: -Math.random() * 10,
            };
          }
          return pet;
        });
        if (changed) {
          set({ completedPets: updatedPets });
        }
      },
      updatePetPosition: (instanceId, x, y) => {
        set(state => ({
          completedPets: state.completedPets.map(p => 
            p.instanceId === instanceId ? { ...p, x, y } : p
          )
        }));
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

        return {
          ...currentState,
          ...typedPersistedState,
          planTemplates: rawTemplates.map((template, index) =>
            normalizePlanTemplate(template, Date.now() + index),
          ),
        };
      },
    }
  )
);
