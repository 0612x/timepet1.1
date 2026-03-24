import type {EggTierId} from './eggs';
import type {SpriteSheetConfig} from './petSprites';

export type EggSpriteAction = 'static' | 'idle' | 'ready' | 'crack';

interface EggSpriteSet {
  static: SpriteSheetConfig;
  idle: SpriteSheetConfig;
  ready: SpriteSheetConfig;
  crack: SpriteSheetConfig;
  slotScale: number;
  libraryScale: number;
  staticSlotScale: number;
  staticLibraryScale: number;
  slotOffsetY: number;
  libraryOffsetY: number;
}

const pastureStatic: SpriteSheetConfig = {
  path: '/images/scenes/farm/pasture_static.png',
  frameWidth: 33,
  frameHeight: 33,
  frameCount: 1,
  columns: 1,
  rows: 1,
  fps: 1,
  loop: false,
};

const pastureIdle: SpriteSheetConfig = {
  path: '/images/scenes/farm/pasture_wobble.png',
  frameWidth: 200,
  frameHeight: 206,
  frameCount: 4,
  columns: 4,
  rows: 1,
  fps: 2,
  loop: true,
};

const pastureReady: SpriteSheetConfig = {
  path: '/images/scenes/farm/pasture_bounce.png',
  frameWidth: 200,
  frameHeight: 206,
  frameCount: 6,
  columns: 6,
  rows: 1,
  fps: 2,
  loop: true,
};

const pastureCrack: SpriteSheetConfig = {
  path: '/images/scenes/farm/pasture_crack.png',
  frameWidth: 200,
  frameHeight: 206,
  frameCount: 12,
  columns: 12,
  rows: 1,
  fps: 4,
  loop: true,
};

const mythStatic: SpriteSheetConfig = {
  path: '/images/scenes/farm/myth_static.png',
  frameWidth: 33,
  frameHeight: 33,
  frameCount: 1,
  columns: 1,
  rows: 1,
  fps: 1,
  loop: false,
};

const mythIdle: SpriteSheetConfig = {
  path: '/images/scenes/farm/myth_wobble.png',
  frameWidth: 200,
  frameHeight: 206,
  frameCount: 4,
  columns: 4,
  rows: 1,
  fps: 2,
  loop: true,
};

const mythReady: SpriteSheetConfig = {
  path: '/images/scenes/farm/myth_bounce.png',
  frameWidth: 200,
  frameHeight: 206,
  frameCount: 6,
  columns: 6,
  rows: 1,
  fps: 2,
  loop: true,
};

const mythCrack: SpriteSheetConfig = {
  path: '/images/scenes/farm/myth_crack.png',
  frameWidth: 200,
  frameHeight: 206,
  frameCount: 12,
  columns: 12,
  rows: 1,
  fps: 2,
  loop: true,
};

export const EGG_SPRITES: Record<EggTierId, EggSpriteSet> = {
  pasture: {
    static: pastureStatic,
    idle: pastureIdle,
    ready: pastureReady,
    crack: pastureCrack,
    slotScale: 0.44,
    libraryScale: 0.22,
    staticSlotScale: 2.55,
    staticLibraryScale: 1.28,
    slotOffsetY: -13,
    libraryOffsetY: -5,
  },
  wonder: {
    // 奇遇蛋素材还没补齐前，先沿用田园蛋的展示，避免孵化流程断掉。
    static: pastureStatic,
    idle: pastureIdle,
    ready: pastureReady,
    crack: pastureCrack,
    slotScale: 0.44,
    libraryScale: 0.22,
    staticSlotScale: 2.55,
    staticLibraryScale: 1.28,
    slotOffsetY: -13,
    libraryOffsetY: -5,
  },
  myth: {
    static: mythStatic,
    idle: mythIdle,
    ready: mythReady,
    crack: mythCrack,
    slotScale: 0.44,
    libraryScale: 0.22,
    staticSlotScale: 2.55,
    staticLibraryScale: 1.28,
    slotOffsetY: 0,
    libraryOffsetY: 0,
  },
};

export function getEggSpriteConfig(tierId: EggTierId, action: EggSpriteAction) {
  return EGG_SPRITES[tierId][action];
}

export function getEggSpriteScale(
  tierId: EggTierId,
  variant: 'slot' | 'library' = 'slot',
  action: EggSpriteAction = 'idle',
) {
  const sprite = EGG_SPRITES[tierId];
  if (action === 'static') {
    return variant === 'slot'
      ? sprite.staticSlotScale
      : sprite.staticLibraryScale;
  }

  return variant === 'slot'
    ? sprite.slotScale
    : sprite.libraryScale;
}

export function getEggSpriteOffsetY(tierId: EggTierId, variant: 'slot' | 'library' = 'slot') {
  return variant === 'slot'
    ? EGG_SPRITES[tierId].slotOffsetY
    : EGG_SPRITES[tierId].libraryOffsetY;
}

export function getAllEggSpritePaths() {
  return Array.from(
    new Set(
      Object.values(EGG_SPRITES).flatMap((item) => [
        item.static.path,
        item.idle.path,
        item.ready.path,
        item.crack.path,
      ]),
    ),
  );
}
