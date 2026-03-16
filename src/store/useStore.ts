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

interface AppState {
  currentTab: TabType;
  setCurrentTab: (tab: TabType) => void;
  
  currentTheme: ThemeType;
  setCurrentTheme: (theme: ThemeType) => void;
  
  allocations: Record<string, Allocation[]>;
  allocateTime: (date: string, type: ActivityType, hours: number) => boolean;
  
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

const getInitialEgg = (theme: ThemeType): EggState => ({
  theme,
  progress: { focus: 0, heal: 0, active: 0 },
  petId: null,
  stage: 'egg',
  finalState: null,
});

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentTab: 'home',
      setCurrentTab: (tab) => set({ currentTab: tab }),
      
      currentTheme: 'A',
      setCurrentTheme: (theme) => set({ currentTheme: theme }),
      
      allocations: {},
      allocateTime: (date, type, hours) => {
        const state = get();
        const dailyAllocs = state.allocations[date] || [];
        const totalAllocated = dailyAllocs.reduce((sum, a) => sum + a.hours, 0);
        
        if (totalAllocated + hours > 24) {
          return false; // Exceeds 24h limit
        }
        
        const newAlloc: Allocation = {
          id: Math.random().toString(36).substring(2, 9),
          type,
          hours,
          used: false,
          timestamp: Date.now(),
        };
        
        set({
          allocations: {
            ...state.allocations,
            [date]: [...dailyAllocs, newAlloc]
          }
        });
        return true;
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
    }
  )
);
