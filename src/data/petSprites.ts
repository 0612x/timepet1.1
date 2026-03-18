export type PetSpriteAction = 'idle' | 'move' | 'feed' | 'happy';
export type PetSpriteScene = 'farm' | 'ocean' | 'draw';

export interface SpriteSheetConfig {
  path: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  columns: number;
  rows: number;
  fps: number;
  loop: boolean;
}

export type PetSpriteMap = Record<string, Partial<Record<PetSpriteAction, SpriteSheetConfig>>>;
export interface PetSpriteOption {
  key: string;
  label: string;
  scene: PetSpriteScene;
  sceneScale?: number;
}

export const PET_SPRITE_SCENE_LABELS: Record<PetSpriteScene, string> = {
  farm: '农场',
  ocean: '深海',
  draw: '手绘',
};

export const PET_SPRITE_OPTIONS: PetSpriteOption[] = [
  {key: 'farm_fox', label: '狐狸', scene: 'farm', sceneScale: 2.35},
  {key: 'farm_ferret', label: '雪貂', scene: 'farm', sceneScale: 2.2},
  {key: 'farm_frog', label: '青蛙', scene: 'farm', sceneScale: 2.05},
];

export const PET_SPRITES: PetSpriteMap = {
  farm_fox: {
    idle: {
      path: '/images/pets/farm/farm_fox_idle.png',
      frameWidth: 32,
      frameHeight: 32,
      frameCount: 5,
      columns: 5,
      rows: 1,
      fps: 3,
      loop: true,
    },
    move: {
      path: '/images/pets/farm/farm_fox_move.png',
      frameWidth: 32,
      frameHeight: 32,
      frameCount: 8,
      columns: 8,
      rows: 1,
      fps: 4,
      loop: true,
    },
    feed: {
      path: '/images/pets/farm/farm_fox_feed.png',
      frameWidth: 32,
      frameHeight: 32,
      frameCount: 5,
      columns: 5,
      rows: 1,
      fps: 4,
      loop: true,
    },
    happy: {
      path: '/images/pets/farm/farm_fox_happy.png',
      frameWidth: 32,
      frameHeight: 32,
      frameCount: 7,
      columns: 7,
      rows: 1,
      fps: 3,
      loop: true,
    },
  },
  farm_ferret: {
    idle: {
      path: '/images/pets/farm/farm_ferret_idle.png',
      frameWidth: 32,
      frameHeight: 32,
      frameCount: 16,
      columns: 16,
      rows: 1,
      fps: 4,
      loop: true,
    },
    move: {
      path: '/images/pets/farm/farm_ferret_move.png',
      frameWidth: 32,
      frameHeight: 32,
      frameCount: 8,
      columns: 8,
      rows: 1,
      fps: 4,
      loop: true,
    },
    feed: {
      path: '/images/pets/farm/farm_ferret_feed.png',
      frameWidth: 32,
      frameHeight: 32,
      frameCount: 8,
      columns: 8,
      rows: 1,
      fps: 4,
      loop: true,
    },
    happy: {
      path: '/images/pets/farm/farm_ferret_happy.png',
      frameWidth: 32,
      frameHeight: 32,
      frameCount: 8,
      columns: 8,
      rows: 1,
      fps: 4,
      loop: true,
    },
  },
  farm_frog: {
    idle: {
      path: '/images/pets/farm/farm_frog_idle.png',
      frameWidth: 32,
      frameHeight: 32,
      frameCount: 2,
      columns: 2,
      rows: 1,
      fps: 2,
      loop: true,
    },
    move: {
      path: '/images/pets/farm/farm_frog_move.png',
      frameWidth: 32,
      frameHeight: 32,
      frameCount: 4,
      columns: 4,
      rows: 1,
      fps: 3,
      loop: true,
    },
    feed: {
      path: '/images/pets/farm/farm_frog_feed.png',
      frameWidth: 32,
      frameHeight: 32,
      frameCount: 4,
      columns: 4,
      rows: 1,
      fps: 3,
      loop: true,
    },
    happy: {
      path: '/images/pets/farm/farm_frog_happy.png',
      frameWidth: 32,
      frameHeight: 32,
      frameCount: 4,
      columns: 4,
      rows: 1,
      fps: 3,
      loop: true,
    },
  },
};

export function getPetSpriteConfigByKey(key: string, action: PetSpriteAction) {
  return PET_SPRITES[key]?.[action] ?? null;
}

export function hasPetSpriteAction(key: string, action: PetSpriteAction) {
  return Boolean(PET_SPRITES[key]?.[action]);
}
