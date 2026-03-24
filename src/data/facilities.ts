import {
  SCENE_BOTTOM_MAX,
  SCENE_BOTTOM_MIN,
  SCENE_X_MAX,
  SCENE_X_MIN,
} from '../constants/sceneBounds';
import type {SpriteSheetConfig} from './petSprites';

export type FacilityId = 'magicBroom';

export interface FacilityItem {
  id: FacilityId;
  label: string;
  description: string;
  price: number;
}

export type FacilityInventory = Record<FacilityId, number>;
export type FacilitySpriteAction = 'static' | 'float' | 'clean';
export interface FacilityPoint {
  x: number;
  y: number;
}

export const FACILITY_ITEMS: FacilityItem[] = [
  {
    id: 'magicBroom',
    label: '魔法扫把',
    description: '自动在农场巡场，逐个清扫便便。',
    price: 180,
  },
];

export const FACILITY_ITEM_MAP: Record<FacilityId, FacilityItem> = FACILITY_ITEMS.reduce((accumulator, item) => {
  accumulator[item.id] = item;
  return accumulator;
}, {} as Record<FacilityId, FacilityItem>);

export const FACILITY_SPRITES: Record<FacilityId, Record<FacilitySpriteAction, SpriteSheetConfig>> = {
  magicBroom: {
    static: {
      path: '/images/scenes/farm/broom_static.png',
      frameWidth: 125,
      frameHeight: 125,
      frameCount: 1,
      columns: 1,
      rows: 1,
      fps: 1,
      loop: true,
    },
    float: {
      path: '/images/scenes/farm/broom_float.png',
      frameWidth: 125,
      frameHeight: 125,
      frameCount: 12,
      columns: 12,
      rows: 1,
      fps: 2,
      loop: true,
    },
    clean: {
      path: '/images/scenes/farm/broom_clean.png',
      frameWidth: 125,
      frameHeight: 125,
      frameCount: 9,
      columns: 9,
      rows: 1,
      fps: 4,
      loop: false,
    },
  },
};

export const MAGIC_BROOM_HOME_DEFAULT: FacilityPoint = {
  x: SCENE_X_MIN + 7,
  y: SCENE_BOTTOM_MIN + 6,
};

export function createInitialFacilityInventory(): FacilityInventory {
  return {
    magicBroom: 0,
  };
}

export function normalizeFacilityInventory(
  input?: Partial<Record<FacilityId, number>>,
): FacilityInventory {
  const defaults = createInitialFacilityInventory();
  FACILITY_ITEMS.forEach((item) => {
    defaults[item.id] = Math.max(0, Math.floor(input?.[item.id] ?? defaults[item.id]));
  });
  return defaults;
}

export function getFacilityById(id: FacilityId) {
  return FACILITY_ITEM_MAP[id];
}

export function normalizeMagicBroomHomePosition(input?: Partial<FacilityPoint> | null): FacilityPoint {
  const x = typeof input?.x === 'number' && Number.isFinite(input.x)
    ? input.x
    : MAGIC_BROOM_HOME_DEFAULT.x;
  const y = typeof input?.y === 'number' && Number.isFinite(input.y)
    ? input.y
    : MAGIC_BROOM_HOME_DEFAULT.y;

  return {
    x: Math.max(SCENE_X_MIN + 1.5, Math.min(SCENE_X_MAX - 1.5, x)),
    y: Math.max(SCENE_BOTTOM_MIN + 1.5, Math.min(SCENE_BOTTOM_MAX - 1.5, y)),
  };
}
