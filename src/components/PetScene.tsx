import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useStore, type CompletedPet} from '../store/useStore';
import {PETS, type ThemeType} from '../data/pets';
import {cn} from '../utils/cn';
import {
  getPetSpriteConfigByKey,
  getPetSpriteOptionByKey,
  hasPetSpriteAction,
  isPetSpriteKey,
  type PetSpriteAction,
} from '../data/petSprites';
import {getSpriteActionLoopMs, SpriteActor} from './SpriteActor';
import {ensureSpritePathLoaded, preloadSpritePaths} from '../utils/spriteAssetLoader';
import {GraveSprite} from './GraveSprite';
import {FoodSprite} from './FoodSprite';
import {BroomActor} from './BroomActor';
import {MAGIC_BROOM_HOME_DEFAULT, type FacilityPoint} from '../data/facilities';
import {
  SCENE_BOTTOM_MAX,
  SCENE_BOTTOM_MIN,
  SCENE_X_MAX,
  SCENE_X_MIN,
} from '../constants/sceneBounds';
import {type FoodId} from '../data/foods';

interface BasicPetInstanceProps {
  pet: CompletedPet;
  mini: boolean;
  theme: ThemeType;
  onSelect?: (pet: CompletedPet) => void;
  children: React.ReactNode;
}

interface SceneSpritePetLite {
  instanceId: string;
  petId: string;
  x: number;
  y: number;
}

interface SpritePetInstanceProps {
  pet: CompletedPet;
  mini: boolean;
  isDarkBackdrop?: boolean;
  onMove: (id: string, x: number, y: number) => void;
  onRuntimePetPointChange?: (
    id: string,
    points: {
      interactionX: number;
      interactionY: number;
      bubbleX: number;
      bubbleY: number;
      feedX: number;
      feedY: number;
      feedLeftX: number;
      feedLeftY: number;
      feedRightX: number;
      feedRightY: number;
    },
  ) => void;
  onSelect?: (pet: CompletedPet) => void;
  actionRequest?: ScenePetActionRequest | null;
  feedMoveRequest?: ScenePetFeedMoveRequest | null;
  activeFeedDropIds: Set<string>;
  onFeedStarted?: (payload: {instanceId: string; dropId: string}) => boolean;
  onFeedArrived?: (payload: {instanceId: string; dropId: string; x: number; y: number}) => void;
  onFeedChaseFailed?: (payload: {instanceId: string; dropId: string}) => void;
  debugHitArea?: boolean;
  sceneSize: {width: number; height: number};
  sceneSpritePetsRef: React.MutableRefObject<SceneSpritePetLite[]>;
}

export interface ScenePetActionRequest {
  instanceId: string;
  action: 'happy' | 'feed';
  nonce: number;
}

export interface SceneFeedDrop {
  id: string;
  foodId: FoodId;
  x: number;
  y: number;
  createdAt: number;
  ttlMs: number;
}

export interface ScenePetFeedMoveRequest {
  instanceId: string;
  dropId: string;
  x: number;
  y: number;
  nonce: number;
}

export interface SceneWasteSpot {
  id: string;
  instanceId: string;
  x: number;
  y: number;
}

export interface SceneWasteCleanupRequest {
  id: string;
  nonce: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const SPRITE_ACTIONS: PetSpriteAction[] = ['idle', 'move', 'feed', 'happy'];
const getLayerZIndex = (y: number) => 100 + Math.round(y * 10);
const FEED_EAT_DURATION_MS = 1300;
const FEED_ARRIVE_X_TOLERANCE = 1.1;
const FEED_ARRIVE_Y_TOLERANCE = 0.95;
const FEED_NEAR_SNAP_X_TOLERANCE = 1.7;
const FEED_NEAR_SNAP_Y_TOLERANCE = 1.3;
const FEED_APPROACH_SNAP_X_TOLERANCE = 1.1;
const FEED_APPROACH_SNAP_Y_TOLERANCE = 0.82;
const FEED_APPROACH_SNAP_DISTANCE = 1.3;
const FEED_CHASE_NEAR_DISTANCE = 2.2;
const FEED_CHASE_STUCK_LIMIT = 8;
const SHOW_SCENE_MOVE_BOUNDS = false;
const MAGIC_BROOM_MOVE_SPEED = 5.6;
const SCENE_PET_MOVE_SPEED = 1.9;
const SCENE_PET_CHASE_SPEED = 3.2;
const MAGIC_BROOM_ARRIVE_DISTANCE = 0.85;
const MAGIC_BROOM_TARGET_Y_OFFSET = 1.8;
const MAGIC_BROOM_RETARGET_DELAY_MS = 220;
const MAGIC_BROOM_CLEAN_DURATION_MS = 2250;
const SCENE_POOP_ICON_PATHS = [
  '/images/pets/farm/farm_poop.png',
  '/images/pets/farm/poop.png',
  '/images/pets/farm/farm_waste.png',
] as const;
const SPECIES_SIZE_FACTOR: Record<string, number> = {
  farm_frog: 0.74,
  farm_littlefox: 0.62,
  farm_littlewhite: 0.72,
  farm_littleblue: 0.72,
  farm_littlegray: 0.72,
  farm_robotbird: 0.72,
  farm_robotsheep: 0.72,
  farm_robotfrog: 0.72,
  farm_robotpig: 0.72,
  farm_vita: 0.58,
  farm_burger: 0.5,
  farm_chicken: 0.35,
  farm_goldie: 0.85,
  farm_Alaska: 2.1,
  farm_Akita: 3.1,
  farm_cat: 1.2,
  farm_miniyellowcat: 1.18,
  farm_miniblackwcat: 1.18,
  farm_minisiamese: 1.18,
  farm_miniTabbycat: 1.18,
  farm_miniragdollcat: 1.18,
  farm_minicivetcat: 1.18,
};
const SPECIES_VISUAL_VERTICAL_OFFSET_RATIO: Record<string, number> = {
  farm_Akita: 0.18,
  farm_goose: 0.06,
  farm_miniyellowcat: 0.045,
  farm_miniblackwcat: 0.045,
  farm_miniragdollcat: 0.045,
  farm_miniTabbycat: 0.045,
  farm_minicivetcat: 0.045,
};
const SPECIES_HIT_VERTICAL_OFFSET_RATIO: Record<string, number> = {
  farm_cat: 0.09,
  farm_armadillo: 0.1,
  farm_miniblackwcat: -0.08,
  farm_miniragdollcat: -0.08,
  farm_miniyellowcat: -0.08,
  farm_boar: 0.08,
  farm_slime: 0.09,
  farm_bunny: 0.08,
  farm_porcupine: 0.09,
  farm_minicivetcat: -0.08,
  farm_iceelemental: 0.08,
  farm_koala: -0.08,
  farm_pidgeon: -0.08,
  farm_otter: -0.08,
  farm_goose: -0.28,
  farm_miniTabbycat: -0.08,
  farm_minigolem: 0.09,
  farm_Akita: -0.46,
  farm_minisiamese: -0.08,
  farm_crab: 0.09,
  farm_spider: 0.09,
};
const SPECIES_HIT_VERTICAL_OFFSET_BY_HITBOX_RATIO: Record<string, number> = {
  farm_squirrel: 0.5,
  farm_goose: -0.5,
  farm_deer: 1 / 3,
  farm_deer1: 1 / 3,
  farm_bear: 1 / 3,
  farm_Akita: 2 / 3,
  farm_hedgehog: 0.5,
  farm_phoenixling: -(2 / 3),
  farm_spider: 1 / 3,
  farm_cobra: 0.25,
  farm_imp: 1 / 3,
  farm_wolf: 1 / 3,
  farm_Alaska: -0.5,
};
const hashToUnit = (input: string) => {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
};

const WasteIcon: React.FC<{mini?: boolean}> = ({mini = false}) => {
  const [imageError, setImageError] = useState(false);
  const [iconPathIndex, setIconPathIndex] = useState(0);

  const size = mini ? 10 : 14;
  const iconPath = SCENE_POOP_ICON_PATHS[iconPathIndex];

  return (
    <div className="pointer-events-none relative">
      {!imageError && iconPath ? (
        <img
          src={iconPath}
          alt="waste"
          width={size}
          height={size}
          onError={() => {
            if (iconPathIndex < SCENE_POOP_ICON_PATHS.length - 1) {
              setIconPathIndex((previous) => previous + 1);
              return;
            }
            setImageError(true);
          }}
          className="block opacity-90 [image-rendering:pixelated]"
        />
      ) : (
        <span className="text-[12px] leading-none opacity-90">💩</span>
      )}
    </div>
  );
};

const GraveIcon: React.FC<{mini?: boolean}> = ({mini = false}) => {
  const size = mini ? 22 : 30;

  return (
    <div className="pointer-events-none relative">
      <GraveSprite size={size} className="opacity-95" />
    </div>
  );
};

const DeadPetInstance: React.FC<{
  pet: CompletedPet;
  mini: boolean;
  onSelect?: (pet: CompletedPet) => void;
}> = ({pet, mini, onSelect}) => (
  <div
    className={cn(
      'absolute whitespace-nowrap',
      onSelect ? 'pointer-events-auto' : 'pointer-events-none',
    )}
    style={{
      left: `${pet.x}%`,
      top: `${pet.y}%`,
      zIndex: 95,
      transform: `scale(${mini ? 0.92 : 1})`,
    }}>
    <button
      type="button"
      aria-label={`查看${pet.nickname ?? '已离世宠物'}`}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelect?.(pet);
      }}
      className={cn(
        'relative -translate-x-1/2 -translate-y-full border-0 bg-transparent p-0 text-left',
        onSelect ? 'cursor-pointer touch-manipulation' : 'pointer-events-none',
      )}>
      <div className="absolute inset-x-0 top-[78%] mx-auto h-3.5 w-8 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(15,23,42,0.18)_0%,rgba(15,23,42,0.06)_60%,rgba(15,23,42,0)_100%)]" />
      <div className="relative flex flex-col items-center">
        <GraveIcon mini={mini} />
        <span className="absolute left-1/2 top-[72%] -translate-x-1/2 whitespace-nowrap rounded-full border border-slate-300/90 bg-white/92 px-1.5 py-0.5 text-[8px] font-black text-slate-500 shadow-[0_2px_6px_rgba(15,23,42,0.08)]">
          已离世
        </span>
      </div>
    </button>
  </div>
);

interface MagicBroomLayerProps {
  active: boolean;
  mini: boolean;
  homePosition: FacilityPoint;
  wasteSpots: SceneWasteSpot[];
  onCleanSpot: (spot: SceneWasteSpot) => void;
}

interface MagicBroomRuntimeState {
  x: number;
  y: number;
  action: 'float' | 'clean';
  targetWasteId: string | null;
  cleanSeed: number;
  phaseUntil: number;
  cleanProgress: number;
}

function getNearestWasteSpot(
  x: number,
  y: number,
  wasteSpots: SceneWasteSpot[],
) {
  let matchedSpot: SceneWasteSpot | null = null;
  let matchedDistance = Number.POSITIVE_INFINITY;

  wasteSpots.forEach((spot) => {
    const distance = Math.hypot(spot.x - x, spot.y - y);
    if (distance >= matchedDistance) return;
    matchedDistance = distance;
    matchedSpot = spot;
  });

  return matchedSpot;
}

const MagicBroomLayer: React.FC<MagicBroomLayerProps> = ({
  active,
  mini,
  homePosition,
  wasteSpots,
  onCleanSpot,
}) => {
  const [runtime, setRuntime] = useState<MagicBroomRuntimeState>({
    x: homePosition.x,
    y: homePosition.y,
    action: 'float',
    targetWasteId: null,
    cleanSeed: 0,
    phaseUntil: 0,
    cleanProgress: 0,
  });
  const runtimeRef = useRef(runtime);
  const wasteSpotsRef = useRef(wasteSpots);
  const onCleanSpotRef = useRef(onCleanSpot);
  const homePositionRef = useRef(homePosition);
  const documentVisibleRef = useRef(typeof document === 'undefined' ? true : !document.hidden);

  useEffect(() => {
    runtimeRef.current = runtime;
  }, [runtime]);

  useEffect(() => {
    homePositionRef.current = homePosition;
  }, [homePosition]);

  useEffect(() => {
    wasteSpotsRef.current = wasteSpots;
  }, [wasteSpots]);

  useEffect(() => {
    onCleanSpotRef.current = onCleanSpot;
  }, [onCleanSpot]);

  useEffect(() => {
    if (!active) {
      const resetState = {
        x: homePosition.x,
        y: homePosition.y,
        action: 'float',
        targetWasteId: null,
        cleanSeed: 0,
        phaseUntil: 0,
        cleanProgress: 0,
      } satisfies MagicBroomRuntimeState;
      runtimeRef.current = resetState;
      setRuntime(resetState);
      return;
    }

    let frameId = 0;
    let previousAt = performance.now();
    const handleVisibilityChange = () => {
      documentVisibleRef.current = !document.hidden;
      previousAt = performance.now();
    };

    if (typeof document !== 'undefined') {
      documentVisibleRef.current = !document.hidden;
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    const tick = (currentAt: number) => {
      if (!documentVisibleRef.current) {
        previousAt = currentAt;
        frameId = window.requestAnimationFrame(tick);
        return;
      }

      const deltaSeconds = Math.min(0.05, Math.max(0.001, (currentAt - previousAt) / 1000));
      previousAt = currentAt;
      const now = Date.now();
      const previous = runtimeRef.current;
      const spots = wasteSpotsRef.current;
      const home = homePositionRef.current;
      let next = previous;
      let cleanedSpot: SceneWasteSpot | null = null;
      let targetSpot = previous.targetWasteId
        ? spots.find((spot) => spot.id === previous.targetWasteId) ?? null
        : null;

      if (previous.action === 'clean') {
        if (!targetSpot) {
          next = {
            ...previous,
            action: 'float',
            targetWasteId: null,
            phaseUntil: now + MAGIC_BROOM_RETARGET_DELAY_MS,
            cleanProgress: 0,
          };
        } else if (now >= previous.phaseUntil) {
          cleanedSpot = targetSpot;
          next = {
            ...previous,
            action: 'float',
            targetWasteId: null,
            phaseUntil: now + MAGIC_BROOM_RETARGET_DELAY_MS,
            cleanProgress: 0,
          };
        } else {
          next = {
            ...previous,
            cleanProgress: clamp(
              1 - (previous.phaseUntil - now) / MAGIC_BROOM_CLEAN_DURATION_MS,
              0,
              1,
            ),
          };
        }
      } else {
        if (!targetSpot && now >= previous.phaseUntil && spots.length > 0) {
          targetSpot = getNearestWasteSpot(previous.x, previous.y, spots);
        }

        if (!targetSpot) {
          const homeX = clamp(home.x, SCENE_X_MIN + 1.5, SCENE_X_MAX - 1.5);
          const homeY = clamp(home.y, SCENE_BOTTOM_MIN + 1.5, SCENE_BOTTOM_MAX - 1.5);
          const deltaX = homeX - previous.x;
          const deltaY = homeY - previous.y;
          const distance = Math.hypot(deltaX, deltaY);

          if (distance <= MAGIC_BROOM_ARRIVE_DISTANCE) {
            next = {
              ...previous,
              x: homeX,
              y: homeY,
              action: 'float',
              targetWasteId: null,
              cleanProgress: 0,
            };
          } else {
            const step = Math.min(distance, MAGIC_BROOM_MOVE_SPEED * deltaSeconds);
            next = {
              ...previous,
              x: previous.x + (deltaX / distance) * step,
              y: previous.y + (deltaY / distance) * step,
              action: 'float',
              targetWasteId: null,
              cleanProgress: 0,
            };
          }
        } else {
          const targetX = clamp(targetSpot.x, SCENE_X_MIN + 1.5, SCENE_X_MAX - 1.5);
          const targetY = clamp(
            targetSpot.y - MAGIC_BROOM_TARGET_Y_OFFSET,
            SCENE_BOTTOM_MIN + 1.5,
            SCENE_BOTTOM_MAX - 1.5,
          );
          const deltaX = targetX - previous.x;
          const deltaY = targetY - previous.y;
          const distance = Math.hypot(deltaX, deltaY);

          if (distance <= MAGIC_BROOM_ARRIVE_DISTANCE) {
            next = {
              ...previous,
              x: targetX,
              y: targetY,
              action: 'clean',
              targetWasteId: targetSpot.id,
              cleanSeed: previous.cleanSeed + 1,
              phaseUntil: now + MAGIC_BROOM_CLEAN_DURATION_MS,
              cleanProgress: 0,
            };
          } else {
            const step = Math.min(distance, MAGIC_BROOM_MOVE_SPEED * deltaSeconds);
            next = {
              ...previous,
              x: previous.x + (deltaX / distance) * step,
              y: previous.y + (deltaY / distance) * step,
              action: 'float',
              targetWasteId: targetSpot.id,
              cleanProgress: 0,
            };
          }
        }
      }

      if (
        next !== previous
        && (
          Math.abs(next.x - previous.x) >= 0.01
          || Math.abs(next.y - previous.y) >= 0.01
          || next.action !== previous.action
          || next.targetWasteId !== previous.targetWasteId
          || next.cleanSeed !== previous.cleanSeed
          || next.phaseUntil !== previous.phaseUntil
          || Math.abs(next.cleanProgress - previous.cleanProgress) >= 0.01
        )
      ) {
        runtimeRef.current = next;
        setRuntime(next);
      }

      if (cleanedSpot) {
        onCleanSpotRef.current(cleanedSpot);
      }

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      window.cancelAnimationFrame(frameId);
    };
  }, [active]);

  if (!active) return null;

  return (
    <div
      className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
      style={{
        left: `${runtime.x}%`,
        top: `${runtime.y}%`,
        zIndex: getLayerZIndex(runtime.y),
      }}>
      <div className="relative">
        {runtime.action === 'clean' && (
          <div className="absolute left-1/2 top-0 z-[1] w-11 -translate-x-1/2 -translate-y-[110%]">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/70 shadow-[0_2px_8px_rgba(15,23,42,0.12)]">
              <div
                className="h-full rounded-full bg-emerald-400 transition-[width] duration-75"
                style={{width: `${Math.round(runtime.cleanProgress * 100)}%`}}
              />
            </div>
          </div>
        )}
        <div className="absolute left-1/2 top-[72%] h-3 w-8 -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(15,23,42,0.18)_0%,rgba(15,23,42,0.06)_62%,rgba(15,23,42,0)_100%)]" />
        <BroomActor
          action={runtime.action}
          seed={runtime.cleanSeed}
          scale={mini ? 0.22 : 0.38}
          ariaLabel="魔法扫把"
          className="relative drop-shadow-[0_10px_18px_rgba(15,23,42,0.18)]"
        />
      </div>
    </div>
  );
};

const BasicPetInstance: React.FC<BasicPetInstanceProps> = ({pet, mini, theme, onSelect, children}) => {
  const getAnimationClass = (variant: number, currentTheme: ThemeType) => {
    if (currentTheme === 'custom') return 'animate-float';
    if (currentTheme === 'B') return 'animate-swim';
    const variants = ['animate-float', 'animate-float-alt', 'animate-pet-move', 'animate-swim'];
    return variants[variant % variants.length];
  };

  return (
    <div
      className={cn(
        'absolute whitespace-nowrap',
        onSelect ? 'pointer-events-auto' : 'pointer-events-none',
        getAnimationClass(pet.variant, theme),
      )}
      onClick={(event) => {
        if (!onSelect) return;
        event.stopPropagation();
        onSelect(pet);
      }}
      style={{
        left: `${pet.x}%`,
        top: `${pet.y}%`,
        zIndex: getLayerZIndex(pet.y),
        animationDelay: `${pet.floatDelay}s`,
        animationDuration: '6s',
        transform: `scale(${pet.scale})`,
      }}>
      {children}
    </div>
  );
};

const SpritePetInstance: React.FC<SpritePetInstanceProps> = ({
  pet,
  mini,
  isDarkBackdrop = false,
  onMove,
  onRuntimePetPointChange,
  onSelect,
  actionRequest,
  feedMoveRequest,
  activeFeedDropIds,
  onFeedStarted,
  onFeedArrived,
  onFeedChaseFailed,
  debugHitArea = false,
  sceneSize,
  sceneSpritePetsRef,
}) => {
  const spriteOption = getPetSpriteOptionByKey(pet.petId);
  const [pos, setPos] = useState({x: pet.x, y: pet.y});
  const [faceRight, setFaceRight] = useState(true);
  const [actionSeed, setActionSeed] = useState(0);
  const [motionReady, setMotionReady] = useState(false);
  const [feedProgress, setFeedProgress] = useState<number | null>(null);
  const [motionTransitionMs, setMotionTransitionMs] = useState(mini ? 1600 : 2200);
  const [motionTimingFunction, setMotionTimingFunction] = useState<'linear' | 'ease-in-out'>('linear');
  const territorySeed = useMemo(
    () => ({
      x: hashToUnit(`${pet.instanceId}:x`),
      y: hashToUnit(`${pet.instanceId}:y`),
    }),
    [pet.instanceId],
  );
  const posRef = useRef(pos);
  const faceRightRef = useRef(true);
  const moveCooldownRef = useRef(0);
  const blockedStreakRef = useRef(0);
  const forcedActionUntilRef = useRef(0);
  const forcedActionNonceRef = useRef(-1);
  const feedMoveNonceRef = useRef(-1);
  const feedMoveTargetRef = useRef<{
    x: number;
    y: number;
    dropId: string;
    dropX: number;
    dropY: number;
    faceRight: boolean;
  } | null>(null);
  const feedCommitTimerRef = useRef<number | null>(null);
  const feedStuckAttemptsRef = useRef(0);
  const eatingDropIdRef = useRef<string | null>(null);
  const eatingResolvePointRef = useRef<{x: number; y: number} | null>(null);
  const eatingUntilRef = useRef(0);
  const feedProgressRef = useRef<number | null>(null);
  const feedProgressTickTimerRef = useRef<number | null>(null);
  const onFeedStartedRef = useRef(onFeedStarted);
  const onFeedArrivedRef = useRef(onFeedArrived);
  const onFeedChaseFailedRef = useRef(onFeedChaseFailed);
  const forcedIdleTimerRef = useRef<number | null>(null);
  const movingUntilRef = useRef(0);
  const documentVisibleRef = useRef(typeof document === 'undefined' ? true : !document.hidden);
  const queuedActionIntentRef = useRef<'happy' | 'feed' | null>(null);
  const directionRef = useRef<{x: -1 | 1; y: -1 | 1}>({
    x: Math.random() > 0.5 ? 1 : -1,
    y: Math.random() > 0.5 ? 1 : -1,
  });
  const homeRef = useRef({
    x: pet.x + (Math.random() - 0.5) * 10,
    y: pet.y + (Math.random() - 0.5) * 4.5,
  });
  const territoryRef = useRef({x: pet.x, y: pet.y});
  const territoryShiftAtRef = useRef(Date.now() + 9000 + Math.random() * 7000);
  const behaviorRef = useRef<{mode: 'roam' | 'explore'; expiresAt: number}>({
    mode: Math.random() < 0.2 ? 'explore' : 'roam',
    expiresAt: Date.now() + 7000 + Math.random() * 8000,
  });
  const moveLoopMs = useMemo(
    () => getSpriteActionLoopMs(pet.petId, 'move') ?? 980,
    [pet.petId],
  );
  const idleConfig = getPetSpriteConfigByKey(pet.petId, 'idle')
    ?? getPetSpriteConfigByKey(pet.petId, 'move');
  const frameWidth = idleConfig?.frameWidth ?? 32;
  const frameHeight = idleConfig?.frameHeight ?? 32;
  const speciesSizeFactor = SPECIES_SIZE_FACTOR[pet.petId] ?? 1;
  const targetVisualHeight = (mini ? 46 : 72) * speciesSizeFactor;
  const normalizedScale = targetVisualHeight / frameHeight;
  const scale = normalizedScale * (mini ? 1 : 1.02);
  const visualScale = mini ? 0.92 : 1.06;
  const actorWidthPx = frameWidth * scale;
  const actorHeightPx = frameHeight * scale;
  const speciesVisualOffsetPx = actorHeightPx * (SPECIES_VISUAL_VERTICAL_OFFSET_RATIO[pet.petId] ?? 0);
  const spriteWidthPx = actorWidthPx * visualScale;
  const spriteHeightPx = actorHeightPx * visualScale;
  const spriteWidthPercent = sceneSize.width > 0 ? (spriteWidthPx / sceneSize.width) * 100 : (mini ? 8 : 10);
  const spriteHeightPercent = sceneSize.height > 0 ? (spriteHeightPx / sceneSize.height) * 100 : (mini ? 10 : 14);
  const maxFrameEdge = Math.max(frameWidth, frameHeight);
  const baseHitRatio = maxFrameEdge >= 96 ? 0.3 : maxFrameEdge >= 64 ? 0.36 : 0.5;
  const sizePressure = clamp(actorWidthPx / (mini ? 80 : 120), 0, 1.5);
  const adjustedHitRatio = clamp(baseHitRatio - sizePressure * 0.12, 0.14, 0.5);
  const minHitWidth = Math.min(mini ? 14 : 18, actorWidthPx);
  const minHitHeight = Math.min(mini ? 12 : 16, actorHeightPx);
  const maxHitWidth = Math.min(actorWidthPx, mini ? 26 : 44);
  const maxHitHeight = Math.min(actorHeightPx, mini ? 24 : 40);
  const hitWidthPx = clamp(actorWidthPx * adjustedHitRatio, minHitWidth, maxHitWidth);
  const hitHeightPx = clamp(actorHeightPx * (adjustedHitRatio + 0.1), minHitHeight, maxHitHeight);
  const hitLeftPx = Math.max(0, (actorWidthPx - hitWidthPx) / 2);
  const hitTopBasePx = Math.max(
    0,
    actorHeightPx - hitHeightPx - actorHeightPx * (maxFrameEdge >= 64 ? 0.03 : 0.08),
  );
  const speciesHitOffsetRatio = SPECIES_HIT_VERTICAL_OFFSET_RATIO[pet.petId] ?? 0;
  const speciesHitOffsetByHitboxRatio = SPECIES_HIT_VERTICAL_OFFSET_BY_HITBOX_RATIO[pet.petId] ?? 0;
  const hitTopPx = clamp(
    hitTopBasePx + actorHeightPx * speciesHitOffsetRatio + hitHeightPx * speciesHitOffsetByHitboxRatio,
    0,
    Math.max(0, actorHeightPx - hitHeightPx),
  );
  const hitCenterPx = {
    x: hitLeftPx + hitWidthPx * 0.5,
    y: hitTopPx + hitHeightPx * 0.5,
  };
  const feedAnchorPx = {
    x: hitLeftPx + hitWidthPx * (faceRight ? 0.72 : 0.28),
    y: hitTopPx + hitHeightPx * 0.56,
  };
  const hitCenterOffsetXPercent = sceneSize.width > 0
    ? ((hitLeftPx + hitWidthPx * 0.5) * visualScale / sceneSize.width) * 100
    : spriteWidthPercent * 0.5;
  const hitCenterOffsetYPercent = sceneSize.height > 0
    ? ((hitTopPx + hitHeightPx * 0.5) * visualScale / sceneSize.height) * 100
    : spriteHeightPercent * 0.62;
  const bubbleOffsetXPercent = hitCenterOffsetXPercent;
  const bubbleOffsetYPercent = sceneSize.height > 0
    ? (Math.max(0, hitTopPx - 2) * visualScale / sceneSize.height) * 100
    : spriteHeightPercent * 0.22;
  const feedAnchorRightOffsetXPercent = sceneSize.width > 0
    ? ((hitLeftPx + hitWidthPx * 0.72) * visualScale / sceneSize.width) * 100
    : spriteWidthPercent * 0.68;
  const feedAnchorLeftOffsetXPercent = sceneSize.width > 0
    ? ((hitLeftPx + hitWidthPx * 0.28) * visualScale / sceneSize.width) * 100
    : spriteWidthPercent * 0.32;
  const feedAnchorOffsetYPercent = sceneSize.height > 0
    ? ((hitTopPx + hitHeightPx * 0.56) * visualScale / sceneSize.height) * 100
    : spriteHeightPercent * 0.68;

  const bounds = useMemo(
    () => {
      const horizontalPadding = SCENE_X_MIN;
      const xMax =
        sceneSize.width > 0
          ? Math.max(
              horizontalPadding + 1.2,
              Math.min(
                SCENE_X_MAX,
                100 - (spriteWidthPx / sceneSize.width) * 100 - horizontalPadding,
              ),
            )
          : SCENE_X_MAX - 1;

      const bottomMinPercent = SCENE_BOTTOM_MIN;
      const bottomMaxPercent = SCENE_BOTTOM_MAX;
      const spriteHeightPercent =
        sceneSize.height > 0
          ? (spriteHeightPx / sceneSize.height) * 100
          : (mini ? 10 : 14);
      const yMin = bottomMinPercent;
      const yMax = Math.max(yMin + 1.2, bottomMaxPercent - spriteHeightPercent);

      return {
        xMin: SCENE_X_MIN,
        xMax,
        yMin,
        yMax,
      };
    },
    [mini, sceneSize.height, sceneSize.width, spriteHeightPx, spriteWidthPx],
  );
  const territoryAnchor = useMemo(() => {
    const xMin = bounds.xMin + 1.8;
    const xMax = bounds.xMax - 1.8;
    const safeXMin = Math.min(xMin, xMax);
    const safeXMax = Math.max(xMin, xMax);
    const targetX = clamp(
      safeXMin + (safeXMax - safeXMin) * territorySeed.x,
      safeXMin,
      safeXMax,
    );

    const laneCenterY = bounds.yMin + (bounds.yMax - bounds.yMin) * territorySeed.y;
    const laneJitter = (Math.random() - 0.5) * (mini ? 1.4 : 2.2);
    const targetY = clamp(
      laneCenterY + laneJitter,
      bounds.yMin + 0.8,
      bounds.yMax - 0.8,
    );

    return {
      x: targetX,
      y: targetY,
    };
  }, [bounds.xMax, bounds.xMin, bounds.yMax, bounds.yMin, mini, territorySeed.x, territorySeed.y]);

  const availableActions = useMemo(
    () =>
      SPRITE_ACTIONS.filter((action) => hasPetSpriteAction(pet.petId, action)) as PetSpriteAction[],
    [pet.petId],
  );

  useEffect(() => {
    availableActions.forEach((action) => {
      const config = getPetSpriteConfigByKey(pet.petId, action);
      if (config?.path) {
        ensureSpritePathLoaded(config.path);
      }
    });
  }, [availableActions, pet.petId]);

  const defaultAction = useMemo<PetSpriteAction>(() => {
    if (availableActions.includes('idle')) return 'idle';
    if (availableActions.includes('move')) return 'move';
    return availableActions[0] ?? 'idle';
  }, [availableActions]);

  const getInteractionCenter = useCallback((point: {x: number; y: number}) => ({
    x: point.x + hitCenterOffsetXPercent,
    y: point.y + hitCenterOffsetYPercent,
  }), [hitCenterOffsetXPercent, hitCenterOffsetYPercent]);

  const getFeedAnchorOffset = useCallback((faceRight: boolean) => ({
    x: faceRight ? feedAnchorRightOffsetXPercent : feedAnchorLeftOffsetXPercent,
    y: feedAnchorOffsetYPercent,
  }), [feedAnchorLeftOffsetXPercent, feedAnchorOffsetYPercent, feedAnchorRightOffsetXPercent]);

  const getFeedAnchorPosition = useCallback((point: {x: number; y: number}, faceRight: boolean) => {
    const offset = getFeedAnchorOffset(faceRight);
    return {
      x: point.x + offset.x,
      y: point.y + offset.y,
    };
  }, [getFeedAnchorOffset]);

  const notifyRuntimePetPoints = useCallback((point: {x: number; y: number}, faceRightValue: boolean) => {
    const interactionCenter = getInteractionCenter(point);
    const feedAnchor = getFeedAnchorPosition(point, faceRightValue);
    const feedLeftAnchor = getFeedAnchorPosition(point, false);
    const feedRightAnchor = getFeedAnchorPosition(point, true);
    onRuntimePetPointChange?.(pet.instanceId, {
      interactionX: interactionCenter.x,
      interactionY: interactionCenter.y,
      bubbleX: point.x + bubbleOffsetXPercent,
      bubbleY: point.y + bubbleOffsetYPercent,
      feedX: feedAnchor.x,
      feedY: feedAnchor.y,
      feedLeftX: feedLeftAnchor.x,
      feedLeftY: feedLeftAnchor.y,
      feedRightX: feedRightAnchor.x,
      feedRightY: feedRightAnchor.y,
    });
  }, [bubbleOffsetXPercent, bubbleOffsetYPercent, getFeedAnchorPosition, getInteractionCenter, onRuntimePetPointChange, pet.instanceId]);

  const getCollisionHalfWidthPercent = useCallback((petId: string) => {
    if (sceneSize.width <= 0) return mini ? 2.2 : 2.8;
    const cfg = getPetSpriteConfigByKey(petId, 'idle') ?? getPetSpriteConfigByKey(petId, 'move');
    const width = cfg?.frameWidth ?? 32;
    const height = cfg?.frameHeight ?? 32;
    const targetHeight = mini ? 46 : 72;
    const actorScale = (targetHeight / height) * (mini ? 1 : 1.02) * (mini ? 0.92 : 1.06);
    const widthPercent = (width * actorScale / sceneSize.width) * 100;
    return Math.max(2.6, widthPercent * 0.34);
  }, [mini, sceneSize.width]);

  const getCollisionPressure = useCallback((x: number, y: number, relaxed = false) => {
    const selfHalfWidth = getCollisionHalfWidthPercent(pet.petId);
    const verticalThreshold = (mini ? 2.4 : 3.4) * (relaxed ? 0.58 : 1);

    return sceneSpritePetsRef.current.reduce((pressure, other) => {
      if (other.instanceId === pet.instanceId) return pressure;
      const otherHalfWidth = getCollisionHalfWidthPercent(other.petId);
      const minGapX = (selfHalfWidth + otherHalfWidth) * (relaxed ? 0.52 : 0.9);
      const overlapX = minGapX - Math.abs(other.x - x);
      const overlapY = verticalThreshold - Math.abs(other.y - y);
      if (overlapX <= 0 || overlapY <= 0) return pressure;
      return pressure + overlapX * 0.82 + overlapY * 0.48;
    }, 0);
  }, [getCollisionHalfWidthPercent, mini, pet.instanceId, pet.petId, sceneSpritePetsRef]);

  const isPositionBlocked = useCallback((x: number, y: number, relaxed = false) => (
    getCollisionPressure(x, y, relaxed) > 0.01
  ), [getCollisionPressure]);

  const pickFeedApproachTarget = useCallback((
    dropX: number,
    dropY: number,
    current: {x: number; y: number},
  ) => {
    const yOffsets = [0, mini ? 0.38 : 0.56, mini ? -0.38 : -0.56];
    const currentCenter = getInteractionCenter(current);
    const baseCandidates = [
      {
        faceRight: true,
      },
      {
        faceRight: false,
      },
    ];

    return baseCandidates
      .flatMap((baseCandidate) => yOffsets.map((offsetY) => {
        const feedAnchorOffset = getFeedAnchorOffset(baseCandidate.faceRight);
        const candidateX = clamp(dropX - feedAnchorOffset.x, bounds.xMin, bounds.xMax);
        const candidateY = clamp(
          dropY - feedAnchorOffset.y + offsetY,
          bounds.yMin,
          bounds.yMax,
        );
        const candidateCenter = getInteractionCenter({x: candidateX, y: candidateY});
        const pressure = getCollisionPressure(candidateX, candidateY, true);
        return {
          faceRight: baseCandidate.faceRight,
          x: candidateX,
          y: candidateY,
          feedX: candidateX + feedAnchorOffset.x,
          feedY: candidateY + feedAnchorOffset.y,
          pressure,
          blocked: pressure > 0.01,
          chaseDistance: Math.hypot(candidateCenter.x - currentCenter.x, (candidateCenter.y - currentCenter.y) * 1.18),
          dropDistance: Math.hypot(dropX - (candidateX + feedAnchorOffset.x), (dropY - (candidateY + feedAnchorOffset.y)) * 1.18),
        };
      }))
      .sort((left, right) =>
        Number(left.blocked) - Number(right.blocked)
        || left.pressure - right.pressure
        || left.chaseDistance - right.chaseDistance
        || left.dropDistance - right.dropDistance
      )[0];
  }, [
    bounds.xMax,
    bounds.xMin,
    bounds.yMax,
    bounds.yMin,
    getFeedAnchorOffset,
    getCollisionPressure,
    getInteractionCenter,
    mini,
  ]);

  const [action, setAction] = useState<PetSpriteAction>(defaultAction);
  const actionRef = useRef<PetSpriteAction>(defaultAction);
  const setMotionTransitionProfile = useCallback((
    duration: number,
    timingFunction: 'linear' | 'ease-in-out' = 'linear',
  ) => {
    setMotionTransitionMs((previous) => (previous === duration ? previous : duration));
    setMotionTimingFunction((previous) => (previous === timingFunction ? previous : timingFunction));
  }, []);
  const setFeedProgressValue = (nextValue: number | null) => {
    const normalized = nextValue === null ? null : clamp(nextValue, 0, 1);
    const previous = feedProgressRef.current;
    if (previous === null && normalized === null) return;
    if (previous !== null && normalized !== null && Math.abs(previous - normalized) < 0.04) return;
    if (previous === normalized) return;
    feedProgressRef.current = normalized;
    setFeedProgress(normalized);
  };
  const clearFeedProgressTimer = useCallback(() => {
    if (feedProgressTickTimerRef.current !== null) {
      window.clearTimeout(feedProgressTickTimerRef.current);
      feedProgressTickTimerRef.current = null;
    }
  }, []);
  const finalizeFeedSession = useCallback((dropId: string) => {
    if (feedCommitTimerRef.current !== null) {
      window.clearTimeout(feedCommitTimerRef.current);
      feedCommitTimerRef.current = null;
    }
    clearFeedProgressTimer();
    eatingDropIdRef.current = null;
    eatingUntilRef.current = 0;
    setFeedProgressValue(null);
    const feedAnchor = eatingResolvePointRef.current ?? getFeedAnchorPosition(posRef.current, faceRightRef.current);
    eatingResolvePointRef.current = null;
    onFeedArrivedRef.current?.({
      instanceId: pet.instanceId,
      dropId,
      x: feedAnchor.x,
      y: feedAnchor.y,
    });
  }, [clearFeedProgressTimer, getFeedAnchorPosition, pet.instanceId]);

  const playForcedAction = (requestedAction: PetSpriteAction) => {
    if (forcedIdleTimerRef.current !== null) {
      window.clearTimeout(forcedIdleTimerRef.current);
      forcedIdleTimerRef.current = null;
    }

    actionRef.current = requestedAction;
    setAction(requestedAction);
    setActionSeed((previous) => previous + 1);

    const actionConfig = getPetSpriteConfigByKey(pet.petId, requestedAction);
    const frameCount = actionConfig?.frameCount ?? 4;
    const fps = actionConfig?.fps ?? 4;
    const holdMs = requestedAction === 'idle'
      ? 460
      : clamp(Math.round((frameCount / Math.max(1, fps)) * 1000 + 220), 520, 1700);
    forcedActionUntilRef.current = Date.now() + holdMs;

    if (requestedAction !== 'idle' && availableActions.includes('idle')) {
      forcedIdleTimerRef.current = window.setTimeout(() => {
        actionRef.current = 'idle';
        setAction('idle');
      }, holdMs);
    }
  };

  const triggerAction = (intent: 'happy' | 'feed') => {
    let requestedAction: PetSpriteAction | null = null;

    if (intent === 'happy') {
      requestedAction = availableActions.includes('happy') ? 'happy' : null;
    } else {
      requestedAction = availableActions.includes('feed')
        ? 'feed'
        : availableActions.includes('idle')
          ? 'idle'
          : defaultAction;
    }

    if (!requestedAction) return;

    const now = Date.now();
    if (forcedActionUntilRef.current > now) {
      if (actionRef.current === requestedAction) return;
      queuedActionIntentRef.current = intent;
      return;
    }
    if (movingUntilRef.current > now) {
      queuedActionIntentRef.current = intent;
      return;
    }

    playForcedAction(requestedAction);
  };

  useEffect(() => {
    posRef.current = pos;
    notifyRuntimePetPoints(pos, faceRightRef.current);
  }, [notifyRuntimePetPoints, pos]);

  useEffect(() => {
    actionRef.current = action;
  }, [action]);

  useEffect(() => {
    onFeedStartedRef.current = onFeedStarted;
  }, [onFeedStarted]);

  useEffect(() => {
    onFeedArrivedRef.current = onFeedArrived;
  }, [onFeedArrived]);

  useEffect(() => {
    onFeedChaseFailedRef.current = onFeedChaseFailed;
  }, [onFeedChaseFailed]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const handleVisibilityChange = () => {
      documentVisibleRef.current = !document.hidden;
      if (document.hidden) {
        movingUntilRef.current = 0;
      }
    };

    documentVisibleRef.current = !document.hidden;
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    faceRightRef.current = faceRight;
    notifyRuntimePetPoints(posRef.current, faceRight);
  }, [faceRight, notifyRuntimePetPoints]);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMotionReady(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    return () => {
      if (forcedIdleTimerRef.current !== null) {
        window.clearTimeout(forcedIdleTimerRef.current);
      }
      if (feedCommitTimerRef.current !== null) {
        window.clearTimeout(feedCommitTimerRef.current);
      }
      clearFeedProgressTimer();
      queuedActionIntentRef.current = null;
      movingUntilRef.current = 0;
      feedMoveTargetRef.current = null;
      feedStuckAttemptsRef.current = 0;
      eatingDropIdRef.current = null;
      eatingResolvePointRef.current = null;
      eatingUntilRef.current = 0;
      setFeedProgressValue(null);
    };
  }, []);

  useEffect(() => {
    if (sceneSize.width <= 0) return;
    const current = posRef.current;
    const clampedX = clamp(current.x, bounds.xMin, bounds.xMax);
    const clampedY = clamp(current.y, bounds.yMin, bounds.yMax);

    homeRef.current = {
      x: clamp(homeRef.current.x, bounds.xMin + 1.4, bounds.xMax - 1.4),
      y: clamp(homeRef.current.y, bounds.yMin + 0.8, bounds.yMax - 0.8),
    };
    territoryRef.current = {
      x: clamp(territoryRef.current.x, bounds.xMin + 1.8, bounds.xMax - 1.8),
      y: clamp(territoryRef.current.y, bounds.yMin + 0.8, bounds.yMax - 0.8),
    };

    if (Math.abs(clampedX - current.x) < 0.01 && Math.abs(clampedY - current.y) < 0.01) return;

    const nextPos = {x: clampedX, y: clampedY};
    posRef.current = nextPos;
    setMotionTransitionProfile(0, 'linear');
    setPos(nextPos);
    onMove(pet.instanceId, clampedX, clampedY);
  }, [bounds.xMax, bounds.xMin, bounds.yMax, bounds.yMin, onMove, pet.instanceId, setMotionTransitionProfile]);

  useEffect(() => {
    territoryRef.current = {
      x: clamp(territoryAnchor.x, bounds.xMin + 1.8, bounds.xMax - 1.8),
      y: clamp(territoryAnchor.y, bounds.yMin + 0.8, bounds.yMax - 0.8),
    };
    homeRef.current = {
      x: territoryRef.current.x,
      y: territoryRef.current.y,
    };
    territoryShiftAtRef.current = Date.now() + 9000 + Math.random() * 7000;
  }, [bounds.xMax, bounds.xMin, bounds.yMax, bounds.yMin, territoryAnchor.x, territoryAnchor.y, pet.instanceId]);

  useEffect(() => {
    setAction(defaultAction);
    actionRef.current = defaultAction;
    setActionSeed((previous) => previous + 1);
  }, [defaultAction, pet.instanceId]);

  useEffect(() => {
    if (!actionRequest || actionRequest.instanceId !== pet.instanceId) return;
    if (forcedActionNonceRef.current === actionRequest.nonce) return;
    forcedActionNonceRef.current = actionRequest.nonce;
    triggerAction(actionRequest.action);
  }, [actionRequest, pet.instanceId]);

  useEffect(() => {
    if (!feedMoveRequest || feedMoveRequest.instanceId !== pet.instanceId) return;
    if (feedMoveNonceRef.current === feedMoveRequest.nonce) return;
    feedMoveNonceRef.current = feedMoveRequest.nonce;
    if (forcedIdleTimerRef.current !== null) {
      window.clearTimeout(forcedIdleTimerRef.current);
      forcedIdleTimerRef.current = null;
    }
    if (feedCommitTimerRef.current !== null) {
      window.clearTimeout(feedCommitTimerRef.current);
      feedCommitTimerRef.current = null;
    }
    clearFeedProgressTimer();
    forcedActionUntilRef.current = 0;
    movingUntilRef.current = 0;
    queuedActionIntentRef.current = null;
    const currentPos = posRef.current;
    const preferredApproach = pickFeedApproachTarget(feedMoveRequest.x, feedMoveRequest.y, currentPos);
    feedMoveTargetRef.current = {
      x: preferredApproach.x,
      y: preferredApproach.y,
      dropId: feedMoveRequest.dropId,
      dropX: preferredApproach.feedX,
      dropY: preferredApproach.feedY,
      faceRight: preferredApproach.faceRight,
    };
    if (faceRightRef.current !== preferredApproach.faceRight) {
      faceRightRef.current = preferredApproach.faceRight;
      setFaceRight(preferredApproach.faceRight);
    }
    eatingDropIdRef.current = null;
    eatingResolvePointRef.current = null;
    eatingUntilRef.current = 0;
    setFeedProgressValue(null);
    feedStuckAttemptsRef.current = 0;
  }, [feedMoveRequest, pet.instanceId, pickFeedApproachTarget]);
  useEffect(() => {
    const currentTarget = feedMoveTargetRef.current;
    if (currentTarget && !activeFeedDropIds.has(currentTarget.dropId)) {
      feedMoveTargetRef.current = null;
      movingUntilRef.current = 0;
      feedStuckAttemptsRef.current = 0;
      setFeedProgressValue(null);
      if (availableActions.includes('idle')) {
        actionRef.current = 'idle';
        setAction('idle');
      }
    }
    const currentEatingDropId = eatingDropIdRef.current;
    if (currentEatingDropId && !activeFeedDropIds.has(currentEatingDropId)) {
      eatingDropIdRef.current = null;
      eatingResolvePointRef.current = null;
      eatingUntilRef.current = 0;
      if (feedCommitTimerRef.current !== null) {
        window.clearTimeout(feedCommitTimerRef.current);
        feedCommitTimerRef.current = null;
      }
      clearFeedProgressTimer();
      setFeedProgressValue(null);
      if (availableActions.includes('idle')) {
        actionRef.current = 'idle';
        setAction('idle');
      }
    }
  }, [activeFeedDropIds, availableActions]);
  useEffect(() => {
    if (feedMoveRequest) return;
    if (eatingDropIdRef.current || !feedMoveTargetRef.current) return;
    feedMoveTargetRef.current = null;
    movingUntilRef.current = 0;
    feedStuckAttemptsRef.current = 0;
    setFeedProgressValue(null);
    if (availableActions.includes('idle')) {
      actionRef.current = 'idle';
      setAction('idle');
    }
  }, [availableActions, feedMoveRequest]);

  useEffect(() => {
    let timer: number;
    let alive = true;
    const timers: number[] = [];
    const schedule = (fn: () => void, delay: number) => {
      const id = window.setTimeout(fn, delay);
      timers.push(id);
      return id;
    };

    const setNextAction = (nextAction: PetSpriteAction) => {
      if (actionRef.current === nextAction) return;
      actionRef.current = nextAction;
      setAction(nextAction);
    };

    const getCloseBlockerCount = (x: number, y: number) =>
      sceneSpritePetsRef.current.reduce((count, other) => {
        if (other.instanceId === pet.instanceId) return count;
        if (Math.abs(other.x - x) < 5.4 && Math.abs(other.y - y) < 3.2) return count + 1;
        return count;
      }, 0);

    const shouldMoveNow = () => {
      if (!availableActions.includes('move')) return false;
      const current = posRef.current;
      const edgeGuardX = 4.2;
      const edgeGuardY = 3;
      const nearEdge =
        current.x <= bounds.xMin + edgeGuardX ||
        current.x >= bounds.xMax - edgeGuardX ||
        current.y <= bounds.yMin + edgeGuardY ||
        current.y >= bounds.yMax - edgeGuardY;

      if (moveCooldownRef.current > 0) {
        moveCooldownRef.current -= 1;
        if (!nearEdge) return false;
      }

      const closeBlockers = getCloseBlockerCount(current.x, current.y);
      const isCrowded = closeBlockers > 0;
      if (isCrowded || blockedStreakRef.current > 0) {
        const forcedChance = blockedStreakRef.current >= 3 ? 1 : 0.82;
        return Math.random() < forcedChance;
      }

      const moveProbabilityByState: Record<CompletedPet['state'], number> = {
        base: 0.34,
        focus: 0.38,
        heal: 0.3,
        active: 0.44,
      };
      if (nearEdge) return Math.random() < 0.9;
      return Math.random() < moveProbabilityByState[pet.state];
    };

    const pickRestAction = () => {
      const weightedPool = [
        {action: 'idle' as PetSpriteAction, weight: 92},
        {action: 'happy' as PetSpriteAction, weight: 5},
        {action: 'feed' as PetSpriteAction, weight: 3},
      ].filter((item) => availableActions.includes(item.action));

      if (weightedPool.length === 0) return defaultAction;

      const totalWeight = weightedPool.reduce((sum, item) => sum + item.weight, 0);
      const target = Math.random() * totalWeight;
      let running = 0;
      for (const item of weightedPool) {
        running += item.weight;
        if (target <= running) return item.action;
      }
      return weightedPool[weightedPool.length - 1].action;
    };

    const setFacingDirection = (nextFaceRight: boolean, restartIdle = false) => {
      if (faceRightRef.current !== nextFaceRight) {
        faceRightRef.current = nextFaceRight;
        setFaceRight(nextFaceRight);
      }
      if (restartIdle && actionRef.current === 'idle') {
        setActionSeed((previous) => previous + 1);
      }
    };

    const startEatingSession = (
      drop: Pick<SceneFeedDrop, 'id' | 'x' | 'y'>,
      nextFaceRight: boolean,
      resolvePoint: {x: number; y: number},
      sourceTargetDropId: string | null = null,
    ) => {
      const granted = onFeedStartedRef.current?.({
        instanceId: pet.instanceId,
        dropId: drop.id,
      }) ?? true;
      if (!granted) return false;

      if (sourceTargetDropId && sourceTargetDropId !== drop.id) {
        onFeedChaseFailedRef.current?.({
          instanceId: pet.instanceId,
          dropId: sourceTargetDropId,
        });
      }

      feedStuckAttemptsRef.current = 0;
      feedMoveTargetRef.current = null;
      movingUntilRef.current = 0;
      eatingDropIdRef.current = drop.id;
      eatingResolvePointRef.current = resolvePoint;
      eatingUntilRef.current = Date.now() + FEED_EAT_DURATION_MS;
      setFacingDirection(nextFaceRight);
      clearFeedProgressTimer();
      setFeedProgressValue(0);

      const eatStartedAt = Date.now();
      const updateFeedProgress = () => {
        const progress = (Date.now() - eatStartedAt) / FEED_EAT_DURATION_MS;
        setFeedProgressValue(progress);
        if (progress >= 1) {
          feedProgressTickTimerRef.current = null;
          return;
        }
        feedProgressTickTimerRef.current = window.setTimeout(updateFeedProgress, 90);
      };
      updateFeedProgress();

      const feedAction = availableActions.includes('feed')
        ? 'feed'
        : availableActions.includes('idle')
          ? 'idle'
          : defaultAction;
      playForcedAction(feedAction);
      forcedActionUntilRef.current = Math.max(forcedActionUntilRef.current, eatingUntilRef.current);

      if (forcedIdleTimerRef.current !== null) {
        window.clearTimeout(forcedIdleTimerRef.current);
        forcedIdleTimerRef.current = null;
      }
      if (feedAction !== 'idle' && availableActions.includes('idle')) {
        forcedIdleTimerRef.current = window.setTimeout(() => {
          actionRef.current = 'idle';
          setAction('idle');
        }, FEED_EAT_DURATION_MS);
      }

      if (feedCommitTimerRef.current !== null) {
        window.clearTimeout(feedCommitTimerRef.current);
      }
      feedCommitTimerRef.current = window.setTimeout(() => {
        const currentEatingDropId = eatingDropIdRef.current;
        if (!currentEatingDropId || currentEatingDropId !== drop.id) {
          feedCommitTimerRef.current = null;
          return;
        }
        finalizeFeedSession(currentEatingDropId);
      }, FEED_EAT_DURATION_MS);

      return true;
    };

    const tryStartAssignedFeed = (
      current: {x: number; y: number},
      target: {dropId: string; dropX: number; dropY: number; faceRight: boolean; x: number; y: number},
    ) => {
      const drop = {id: target.dropId, x: target.dropX, y: target.dropY};
      const feedFaces = [target.faceRight, !target.faceRight];

      const canStartFrom = (point: {x: number; y: number}, nextFaceRight: boolean) => {
        const anchor = getFeedAnchorPosition(point, nextFaceRight);
        const deltaX = drop.x - anchor.x;
        const deltaY = drop.y - anchor.y;
        const isWithin =
          Math.abs(deltaX) <= FEED_ARRIVE_X_TOLERANCE
          && Math.abs(deltaY) <= FEED_ARRIVE_Y_TOLERANCE;
        const canSnap =
          !isWithin
          && Math.abs(deltaX) <= FEED_NEAR_SNAP_X_TOLERANCE
          && Math.abs(deltaY) <= FEED_NEAR_SNAP_Y_TOLERANCE;

        if (!isWithin && !canSnap) return false;
        return startEatingSession(drop, nextFaceRight, anchor, target.dropId);
      };

      for (const feedFace of feedFaces) {
        if (canStartFrom(current, feedFace)) {
          return true;
        }
      }

      const approachDeltaX = target.x - current.x;
      const approachDeltaY = target.y - current.y;
      const approachDistance = Math.hypot(approachDeltaX, approachDeltaY * 1.18);
      const canSnapToApproach =
        Math.abs(approachDeltaX) <= FEED_APPROACH_SNAP_X_TOLERANCE
        && Math.abs(approachDeltaY) <= FEED_APPROACH_SNAP_Y_TOLERANCE;
      const isNearApproach = canSnapToApproach || approachDistance <= FEED_APPROACH_SNAP_DISTANCE;

      if (!isNearApproach) return false;

      const snappedPos = {x: target.x, y: target.y};
      posRef.current = snappedPos;
      setMotionTransitionProfile(0, 'linear');
      setPos(snappedPos);
      onMove(pet.instanceId, snappedPos.x, snappedPos.y);

      for (const feedFace of feedFaces) {
        if (canStartFrom(snappedPos, feedFace)) {
          return true;
        }
      }

      return false;
    };

    const getLocalCrowdPenalty = (x: number, y: number) => {
      let penalty = 0;
      sceneSpritePetsRef.current.forEach((other) => {
        if (other.instanceId === pet.instanceId) return;
        const dx = x - other.x;
        const dy = y - other.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 3.2) {
          penalty += (3.2 - distance) * 1.8;
          return;
        }
        if (distance < 8.8) {
          penalty += (8.8 - distance) * 0.22;
        }
      });
      return penalty;
    };

    const updateBehaviorMode = () => {
      const now = Date.now();
      if (now < behaviorRef.current.expiresAt) return;

      const nextMode: 'roam' | 'explore' =
        behaviorRef.current.mode === 'roam'
          ? (Math.random() < 0.27 ? 'explore' : 'roam')
          : 'roam';
      behaviorRef.current = {
        mode: nextMode,
        expiresAt:
          now
          + (nextMode === 'explore'
            ? 4200 + Math.random() * 3600
            : 10000 + Math.random() * 9000),
      };
    };

    const maybeShiftTerritory = (current: {x: number; y: number}) => {
      const now = Date.now();
      if (now < territoryShiftAtRef.current) return;

      const centerX = (bounds.xMin + bounds.xMax) / 2;
      const sideBias = current.x >= centerX ? 1 : -1;
      const driftX = (Math.random() - 0.5) * (mini ? 16 : 24);
      const driftY = (Math.random() - 0.5) * (mini ? 4 : 6);
      const sidePush = sideBias * (mini ? 2.5 : 4.2);

      const nextTerritory = {
        x: clamp(current.x + driftX + sidePush, bounds.xMin + 1.8, bounds.xMax - 1.8),
        y: clamp(current.y + driftY, bounds.yMin + 0.8, bounds.yMax - 0.8),
      };

      territoryRef.current = nextTerritory;
      homeRef.current = {
        x: nextTerritory.x,
        y: nextTerritory.y,
      };
      territoryShiftAtRef.current = now + 12000 + Math.random() * 11000;
    };

    const pickMoveCandidate = (current: {x: number; y: number}, nearEdge: boolean) => {
      updateBehaviorMode();
      maybeShiftTerritory(current);
      const mode = behaviorRef.current.mode;
      const home = homeRef.current;
      const territory = territoryRef.current;

      if (Math.random() < (nearEdge ? 0.58 : 0.24)) {
        homeRef.current = {
          x: clamp(
            home.x * 0.58
            + territory.x * 0.42
            + (nearEdge ? (Math.random() - 0.5) * 6.8 : (Math.random() - 0.5) * 2.8),
            bounds.xMin + 1.5,
            bounds.xMax - 1.5,
          ),
          y: clamp(
            home.y * 0.56
            + territory.y * 0.44
            + (nearEdge ? (Math.random() - 0.5) * 2.5 : (Math.random() - 0.5) * 1.4),
            bounds.yMin + 0.9,
            bounds.yMax - 0.9,
          ),
        };
      }

      const candidates: Array<{x: number; y: number; score: number}> = [];
      for (let attempt = 0; attempt < 11; attempt += 1) {
        const roamRadiusX = mini ? 9.5 : 13;
        const roamRadiusY = mini ? 3.2 : 4.6;
        const targetX = mode === 'explore'
          ? current.x + (Math.random() - 0.5) * (nearEdge ? 19 : 24)
          : homeRef.current.x + (Math.random() - 0.5) * roamRadiusX * 2;
        const targetY = mode === 'explore'
          ? current.y + (Math.random() - 0.5) * (nearEdge ? 6 : 8.6)
          : homeRef.current.y + (Math.random() - 0.5) * roamRadiusY * 2;

        const vectorX = targetX - current.x;
        const vectorY = targetY - current.y;
        const vectorLength = Math.hypot(vectorX, vectorY) || 1;
        const normalizedX = vectorX / vectorLength;
        const normalizedY = vectorY / vectorLength;

        const strideX =
          mode === 'explore'
            ? (nearEdge ? 3 + Math.random() * 3.2 : 3.8 + Math.random() * 4.2)
            : (nearEdge ? 2.4 + Math.random() * 2.2 : 2 + Math.random() * 3.1);
        const strideY =
          mode === 'explore'
            ? (nearEdge ? 0.5 + Math.random() * 1.1 : 0.65 + Math.random() * 1.35)
            : (nearEdge ? 0.34 + Math.random() * 0.9 : 0.24 + Math.random() * 0.95);

        const candidateX = clamp(
          current.x + normalizedX * strideX + (Math.random() - 0.5) * 0.85,
          bounds.xMin,
          bounds.xMax,
        );
        const candidateY = clamp(
          current.y + normalizedY * strideY + (Math.random() - 0.5) * 0.42,
          bounds.yMin,
          bounds.yMax,
        );

        const deltaX = candidateX - current.x;
        const deltaY = candidateY - current.y;
        if (Math.abs(deltaX) < 0.4 && Math.abs(deltaY) < 0.18) continue;
        if (isPositionBlocked(candidateX, candidateY)) continue;

        const movementScore = Math.hypot(deltaX, deltaY) * 1.24;
        const crowdPenalty = getLocalCrowdPenalty(candidateX, candidateY);
        const distanceToHome = Math.hypot(candidateX - homeRef.current.x, candidateY - homeRef.current.y);
        const distanceToTerritory = Math.hypot(candidateX - territory.x, candidateY - territory.y);
        const homePenalty = mode === 'roam'
          ? Math.max(0, distanceToHome - (mini ? 9.5 : 12.5)) * 0.58
          : Math.max(0, (mini ? 3.3 : 4.2) - distanceToHome) * 0.34;
        const territoryPenalty = mode === 'roam'
          ? Math.max(0, distanceToTerritory - (mini ? 12 : 16)) * 0.46
          : Math.max(0, distanceToTerritory - (mini ? 18 : 24)) * 0.18;
        const score = movementScore - crowdPenalty - homePenalty - territoryPenalty;

        candidates.push({x: candidateX, y: candidateY, score});
      }

      if (candidates.length > 0) {
        candidates.sort((a, b) => b.score - a.score);
        return candidates[0];
      }

      const blockers = sceneSpritePetsRef.current.filter((other) => {
        if (other.instanceId === pet.instanceId) return false;
        return Math.abs(other.x - current.x) < 5.4 && Math.abs(other.y - current.y) < 3.2;
      });

      if (blockers.length > 0) {
        const nearest = [...blockers].sort((left, right) => {
          const leftDistance = Math.hypot(left.x - current.x, left.y - current.y);
          const rightDistance = Math.hypot(right.x - current.x, right.y - current.y);
          return leftDistance - rightDistance;
        })[0];

        if (nearest) {
          const awayX = current.x - nearest.x;
          const awayY = current.y - nearest.y;
          const awayLength = Math.hypot(awayX, awayY) || 1;
          const perpendicular: Array<{x: number; y: number}> = [
            {x: -awayY / awayLength, y: awayX / awayLength},
            {x: awayY / awayLength, y: -awayX / awayLength},
          ];
          for (const vector of perpendicular) {
            const slideX = clamp(current.x + vector.x * (2.2 + Math.random() * 1.8), bounds.xMin, bounds.xMax);
            const slideY = clamp(current.y + vector.y * (0.55 + Math.random() * 0.85), bounds.yMin, bounds.yMax);
            if (!isPositionBlocked(slideX, slideY)) {
              return {x: slideX, y: slideY, score: -0.1};
            }
          }
        }
      }

      return null;
    };

    const findEmergencyMoveCandidate = (current: {x: number; y: number}) => {
      const ringSteps = 10;
      const strideRadii = mini ? [2.2, 3.4, 4.8, 6.2] : [2.8, 4.2, 5.8, 7.2];

      for (const radius of strideRadii) {
        for (let step = 0; step < ringSteps; step += 1) {
          const angle = (Math.PI * 2 * step) / ringSteps + Math.random() * 0.12;
          const candidateX = clamp(current.x + Math.cos(angle) * radius, bounds.xMin, bounds.xMax);
          const candidateY = clamp(
            current.y + Math.sin(angle) * radius * (mini ? 0.42 : 0.5),
            bounds.yMin,
            bounds.yMax,
          );
          if (!isPositionBlocked(candidateX, candidateY)) {
            return {x: candidateX, y: candidateY};
          }
        }
      }

      const blockers = sceneSpritePetsRef.current.filter((other) => {
        if (other.instanceId === pet.instanceId) return false;
        return Math.abs(other.x - current.x) < 6.2 && Math.abs(other.y - current.y) < 3.6;
      });
      if (blockers.length === 0) return null;

      const nearest = [...blockers].sort((left, right) => {
        const leftDistance = Math.hypot(left.x - current.x, left.y - current.y);
        const rightDistance = Math.hypot(right.x - current.x, right.y - current.y);
        return leftDistance - rightDistance;
      })[0];
      if (!nearest) return null;

      const awayX = current.x - nearest.x;
      const awayY = current.y - nearest.y;
      const length = Math.hypot(awayX, awayY) || 1;
      return {
        x: clamp(current.x + (awayX / length) * (mini ? 3 : 3.8), bounds.xMin, bounds.xMax),
        y: clamp(current.y + (awayY / length) * (mini ? 1.1 : 1.4), bounds.yMin, bounds.yMax),
      };
    };

    const getRestDelay = (nextAction: PetSpriteAction, nearEdge = false) => {
      if (nextAction !== 'idle') {
        return nearEdge ? 1000 + Math.random() * 600 : 1300 + Math.random() * 800;
      }

      const idleConfig = getPetSpriteConfigByKey(pet.petId, 'idle');
      const frameCount = idleConfig?.frameCount ?? 6;

      if (frameCount <= 4) {
        return nearEdge ? 2400 + Math.random() * 800 : 3000 + Math.random() * 1200;
      }
      if (frameCount <= 6) {
        return nearEdge ? 2100 + Math.random() * 700 : 2600 + Math.random() * 1000;
      }
      if (frameCount <= 10) {
        return nearEdge ? 1800 + Math.random() * 700 : 2200 + Math.random() * 900;
      }

      return nearEdge ? 1600 + Math.random() * 600 : 2000 + Math.random() * 800;
    };

    const getTravelDistance = (
      from: {x: number; y: number},
      to: {x: number; y: number},
    ) => Math.hypot(to.x - from.x, (to.y - from.y) * 1.22);

    const getTravelDurationMs = (
      from: {x: number; y: number},
      to: {x: number; y: number},
      mode: 'move' | 'chase',
    ) => {
      const distance = getTravelDistance(from, to);
      const speed = mode === 'chase' ? SCENE_PET_CHASE_SPEED : SCENE_PET_MOVE_SPEED;
      const rawDuration = (distance / Math.max(0.1, speed)) * 1000;

      if (mode === 'chase') {
        return clamp(
          Math.round(rawDuration),
          mini ? 420 : 520,
          mini ? 980 : 1320,
        );
      }

      return clamp(
        Math.round(rawDuration),
        mini ? 760 : 920,
        mini ? 1880 : 2480,
      );
    };

    const hasEnoughDisplacement = (
      from: {x: number; y: number},
      to: {x: number; y: number},
    ) => getTravelDistance(from, to) >= (mini ? 0.72 : 0.95);

    const pickFeedChaseCandidate = (
      current: {x: number; y: number},
      target: {x: number; y: number},
    ) => {
      const deltaX = target.x - current.x;
      const deltaY = target.y - current.y;
      const currentDistance = Math.hypot(deltaX, deltaY * 1.22) || 1;
      const normalizedX = deltaX / currentDistance;
      const normalizedY = deltaY / currentDistance;
      const sideX = -normalizedY;
      const sideY = normalizedX;
      const forwardStride = clamp(currentDistance * 0.72, mini ? 1.8 : 2.4, mini ? 3.2 : 4.8);
      const lateralStride = mini ? 0.38 : 0.62;
      const verticalBias = mini ? 0.78 : 0.86;
      const candidateVariants = [
        {forward: 1, lateral: 0},
        {forward: 0.88, lateral: 0},
        {forward: 1, lateral: 0.55},
        {forward: 1, lateral: -0.55},
        {forward: 0.78, lateral: 1.05},
        {forward: 0.78, lateral: -1.05},
      ];

      const rankedCandidates = candidateVariants
        .map((variant) => {
          const candidateX = clamp(
            current.x + normalizedX * forwardStride * variant.forward + sideX * lateralStride * variant.lateral,
            bounds.xMin,
            bounds.xMax,
          );
          const candidateY = clamp(
            current.y + normalizedY * forwardStride * verticalBias * variant.forward + sideY * lateralStride * 0.55 * variant.lateral,
            bounds.yMin,
            bounds.yMax,
          );
          const pressure = getCollisionPressure(candidateX, candidateY, true);
          const blocked = pressure > 0.01;
          const targetDistance = Math.hypot(target.x - candidateX, (target.y - candidateY) * 1.22);
          const progress = currentDistance - targetDistance;
          const crowdPenalty = getLocalCrowdPenalty(candidateX, candidateY);

          return {
            x: candidateX,
            y: candidateY,
            blocked,
            pressure,
            progress,
            targetDistance,
            crowdPenalty,
            score: progress * 2.8 - pressure * 2.2 - crowdPenalty * 0.12,
          };
        })
        .filter((candidate) => hasEnoughDisplacement(current, candidate))
        .sort((left, right) =>
          Number(left.blocked) - Number(right.blocked)
          || right.score - left.score
          || left.targetDistance - right.targetDistance
        );

      const openCandidate = rankedCandidates.find((candidate) => !candidate.blocked && candidate.progress > 0.05);
      if (openCandidate) return openCandidate;

      const softCandidate = rankedCandidates.find((candidate) => candidate.pressure < 0.18 && candidate.progress > 0.08);
      if (softCandidate) return softCandidate;

      if (currentDistance <= FEED_CHASE_NEAR_DISTANCE) {
        const nearCandidate = rankedCandidates.find((candidate) => !candidate.blocked) ?? rankedCandidates[0];
        if (nearCandidate) return nearCandidate;
      }

      return null;
    };

    const run = () => {
      if (!alive) return;
      if (!documentVisibleRef.current) {
        timer = schedule(run, 260);
        return;
      }
      const now = Date.now();
    if (now < forcedActionUntilRef.current) {
      timer = schedule(run, 130 + Math.random() * 120);
      return;
    }
    if (eatingDropIdRef.current) {
      if (now >= eatingUntilRef.current + 120) {
        finalizeFeedSession(eatingDropIdRef.current);
        timer = schedule(run, 90 + Math.random() * 90);
        return;
      }
      timer = schedule(run, 80);
      return;
    }
    if (queuedActionIntentRef.current && now >= movingUntilRef.current) {
      const queuedIntent = queuedActionIntentRef.current;
      queuedActionIntentRef.current = null;
        triggerAction(queuedIntent);
        timer = schedule(run, 120 + Math.random() * 140);
        return;
      }
      const currentAtStart = posRef.current;
      let feedTarget = feedMoveTargetRef.current;
      if (feedTarget) {
        if (activeFeedDropIds.has(feedTarget.dropId) && tryStartAssignedFeed(currentAtStart, feedTarget)) {
          timer = schedule(run, 180 + Math.random() * 100);
          return;
        }
        if (feedStuckAttemptsRef.current > 0) {
          const reroutedTarget = pickFeedApproachTarget(feedTarget.dropX, feedTarget.dropY, currentAtStart);
          const currentPressure = getCollisionPressure(feedTarget.x, feedTarget.y, true);
          if (
            reroutedTarget
            && (
              reroutedTarget.pressure + 0.02 < currentPressure
              || reroutedTarget.faceRight !== feedTarget.faceRight
            )
          ) {
            feedTarget = {
              ...feedTarget,
              x: reroutedTarget.x,
              y: reroutedTarget.y,
              faceRight: reroutedTarget.faceRight,
            };
            feedMoveTargetRef.current = feedTarget;
          }
        }
        const approachDeltaX = feedTarget.x - currentAtStart.x;
        const approachDeltaY = feedTarget.y - currentAtStart.y;
        const approachDistance = Math.hypot(approachDeltaX, approachDeltaY * 1.18);
        const shouldSnapToApproach =
          (
            Math.abs(approachDeltaX) <= FEED_APPROACH_SNAP_X_TOLERANCE
            && Math.abs(approachDeltaY) <= FEED_APPROACH_SNAP_Y_TOLERANCE
          )
          || approachDistance <= FEED_APPROACH_SNAP_DISTANCE;

        if (shouldSnapToApproach) {
          const snappedPos = {x: feedTarget.x, y: feedTarget.y};
          posRef.current = snappedPos;
          setMotionTransitionProfile(0, 'linear');
          setPos(snappedPos);
          onMove(pet.instanceId, snappedPos.x, snappedPos.y);
          setFacingDirection(feedTarget.faceRight);

          if (activeFeedDropIds.has(feedTarget.dropId) && tryStartAssignedFeed(snappedPos, feedTarget)) {
            timer = schedule(run, 180 + Math.random() * 100);
            return;
          }

          feedStuckAttemptsRef.current += 1;
          if (feedStuckAttemptsRef.current >= FEED_CHASE_STUCK_LIMIT) {
            const failedDropId = feedTarget.dropId;
            feedMoveTargetRef.current = null;
            movingUntilRef.current = 0;
            setFeedProgressValue(null);
            setNextAction(availableActions.includes('idle') ? 'idle' : defaultAction);
            onFeedChaseFailedRef.current?.({
              instanceId: pet.instanceId,
              dropId: failedDropId,
            });
            timer = schedule(run, 130 + Math.random() * 110);
            return;
          }

          timer = schedule(run, 90 + Math.random() * 70);
          return;
        }

        const chaseCandidate = pickFeedChaseCandidate(currentAtStart, feedTarget);
        const nextX = chaseCandidate?.x ?? currentAtStart.x;
        const nextY = chaseCandidate?.y ?? currentAtStart.y;

        if (!chaseCandidate || !hasEnoughDisplacement(currentAtStart, {x: nextX, y: nextY})) {
          feedStuckAttemptsRef.current += 1;
          if (feedStuckAttemptsRef.current >= FEED_CHASE_STUCK_LIMIT) {
            const failedDropId = feedTarget.dropId;
            feedMoveTargetRef.current = null;
            movingUntilRef.current = 0;
            setFeedProgressValue(null);
            setNextAction(availableActions.includes('idle') ? 'idle' : defaultAction);
            onFeedChaseFailedRef.current?.({
              instanceId: pet.instanceId,
              dropId: failedDropId,
            });
            timer = schedule(run, 130 + Math.random() * 110);
            return;
          }
          setNextAction(availableActions.includes('idle') ? 'idle' : defaultAction);
          setFeedProgressValue(null);
          timer = schedule(run, 170 + Math.random() * 110);
          return;
        }
        feedStuckAttemptsRef.current = 0;

        const nextPos = {x: nextX, y: nextY};
        const chaseDuration = getTravelDurationMs(currentAtStart, nextPos, 'chase');
        posRef.current = nextPos;
        setMotionTransitionProfile(chaseDuration, 'linear');
        setPos(nextPos);
        onMove(pet.instanceId, nextX, nextY);
        if (Math.abs(nextX - currentAtStart.x) > 0.16) {
          setFacingDirection(nextX >= currentAtStart.x);
        }
        setNextAction(availableActions.includes('move') ? 'move' : defaultAction);

        movingUntilRef.current = Date.now() + chaseDuration;
        schedule(() => {
          if (!alive) return;
          movingUntilRef.current = 0;
          timer = schedule(run, 90 + Math.random() * 90);
        }, chaseDuration);
        return;
      }
      const edgeTouchTolerance = 0.15;
      const atLeftEdge = currentAtStart.x <= bounds.xMin + edgeTouchTolerance;
      const atRightEdge = currentAtStart.x >= bounds.xMax - edgeTouchTolerance;
      const facingOutward = (atLeftEdge && !faceRightRef.current) || (atRightEdge && faceRightRef.current);

      if (facingOutward) {
        const nextFaceRight = atLeftEdge;
        setFacingDirection(nextFaceRight, true);
        directionRef.current.x = nextFaceRight ? 1 : -1;
        setNextAction('idle');
        timer = schedule(run, 120 + Math.random() * 140);
        return;
      }

      if (shouldMoveNow()) {
        const current = currentAtStart;
        let nextX = current.x;
        let nextY = current.y;
        let moved = false;
        const edgeGuardX = 4.2;
        const edgeGuardY = 3;
        const nearEdge =
          current.x <= bounds.xMin + edgeGuardX ||
          current.x >= bounds.xMax - edgeGuardX ||
          current.y <= bounds.yMin + edgeGuardY ||
          current.y >= bounds.yMax - edgeGuardY;
        const chosenCandidate = pickMoveCandidate(current, nearEdge);
        if (chosenCandidate) {
          const candidatePos = {x: chosenCandidate.x, y: chosenCandidate.y};
          if (hasEnoughDisplacement(current, candidatePos)) {
            nextX = candidatePos.x;
            nextY = candidatePos.y;
            moved = true;
          }
        }

        if (!moved) {
          blockedStreakRef.current += 1;
          const emergencyCandidate = findEmergencyMoveCandidate(current);
          if (emergencyCandidate) {
            if (hasEnoughDisplacement(current, emergencyCandidate)) {
              nextX = emergencyCandidate.x;
              nextY = emergencyCandidate.y;
              moved = true;
            }
          }
        }

        if (!moved) {
          directionRef.current.x = directionRef.current.x === 1 ? -1 : 1;
          directionRef.current.y = directionRef.current.y === 1 ? -1 : 1;
          setNextAction('idle');
          timer = schedule(run, 140 + Math.random() * 160);
          return;
        }

        if (moved) {
          if (isPositionBlocked(nextX, nextY)) {
            blockedStreakRef.current += 1;
            setNextAction(availableActions.includes('idle') ? 'idle' : defaultAction);
            movingUntilRef.current = 0;
            timer = schedule(run, 120 + Math.random() * 120);
            return;
          }
          blockedStreakRef.current = 0;
          moveCooldownRef.current = nearEdge ? 0 : Math.random() < 0.6 ? 0 : 1;
          const deltaX = nextX - current.x;
          const deltaY = nextY - current.y;
          directionRef.current.x = deltaX >= 0 ? 1 : -1;
          directionRef.current.y = deltaY >= 0 ? 1 : -1;
          if (Math.abs(deltaX) > 0.28) {
            setFacingDirection(nextX >= current.x);
          }
          const nextPos = {x: nextX, y: nextY};
          const normalMoveDuration = getTravelDurationMs(current, nextPos, 'move');
          posRef.current = nextPos;
          setMotionTransitionProfile(normalMoveDuration, 'linear');
          setPos(nextPos);
          onMove(pet.instanceId, nextX, nextY);
          setNextAction('move');
          movingUntilRef.current = Date.now() + normalMoveDuration + 60;

          schedule(() => {
            if (!alive) return;
            movingUntilRef.current = 0;
            if (queuedActionIntentRef.current) {
              const queuedIntent = queuedActionIntentRef.current;
              queuedActionIntentRef.current = null;
              triggerAction(queuedIntent);
              timer = schedule(run, 120 + Math.random() * 120);
              return;
            }
            const nextRestAction = pickRestAction();
            setNextAction(nextRestAction);
            timer = schedule(run, getRestDelay(nextRestAction, nearEdge));
          }, normalMoveDuration + 40);
          return;
        }
      }

      const nextRestAction = pickRestAction();
      setNextAction(nextRestAction);
      timer = schedule(run, getRestDelay(nextRestAction));
    };

    const initialDelay = feedMoveRequest?.instanceId === pet.instanceId ? 36 : 1200 + Math.random() * 1000;
    timer = schedule(run, initialDelay);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [activeFeedDropIds, availableActions, bounds.xMax, bounds.xMin, bounds.yMax, bounds.yMin, clearFeedProgressTimer, defaultAction, feedMoveRequest?.nonce, finalizeFeedSession, getCollisionPressure, getFeedAnchorPosition, getInteractionCenter, isPositionBlocked, mini, moveLoopMs, onMove, pet.instanceId, pet.petId, pet.state, pickFeedApproachTarget, sceneSize.width, setMotionTransitionProfile]);

  if (!spriteOption) return null;

  const baseFlip = Boolean(spriteOption.flipX);
  const finalFlipX = faceRight ? baseFlip : !baseFlip;

  return (
    <div
      className="absolute whitespace-nowrap transition-[left,top] ease-in-out pointer-events-none"
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        zIndex: getLayerZIndex(pos.y),
        transform: `scale(${visualScale})`,
        transitionDuration: motionReady ? `${motionTransitionMs}ms` : '0ms',
        transitionTimingFunction: motionTimingFunction,
      }}>
      <div
        className="relative"
        style={speciesVisualOffsetPx
          ? {
              transform: `translateY(${speciesVisualOffsetPx}px)`,
            }
          : undefined}
      >
        {feedProgress !== null && (
          <div
            className="pointer-events-none absolute z-30"
            style={{
              left: `${hitCenterPx.x}px`,
              top: `${Math.max(0, hitTopPx - 4)}px`,
              width: `${clamp(hitWidthPx + 10, 28, 44)}px`,
              transform: 'translate(-50%, -100%)',
            }}>
            <div
              className={cn(
                'h-1.5 overflow-hidden rounded-full border backdrop-blur-sm',
                isDarkBackdrop ? 'border-white/15 bg-white/15' : 'border-slate-200/90 bg-slate-200/95',
              )}>
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-120 ease-out',
                  isDarkBackdrop ? 'bg-amber-300' : 'bg-amber-500',
                )}
                style={{width: `${Math.round(feedProgress * 100)}%`}}
              />
            </div>
          </div>
        )}
        <SpriteActor
          spriteKey={spriteOption.key}
          action={action}
          scale={scale}
          flipX={finalFlipX}
          seed={actionSeed}
          ariaLabel={spriteOption.label}
          className="pointer-events-none relative z-10 drop-shadow-[0_5px_8px_rgba(15,23,42,0.18)]"
        />
        {debugHitArea && (
          <>
            <span
              className="pointer-events-none absolute z-20 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-100 bg-cyan-400 shadow-[0_0_0_2px_rgba(8,145,178,0.18)]"
              style={{
                left: `${hitCenterPx.x}px`,
                top: `${hitCenterPx.y}px`,
              }}
            />
            <span
              className="pointer-events-none absolute z-20 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-100 bg-amber-400 shadow-[0_0_0_2px_rgba(245,158,11,0.18)]"
              style={{
                left: `${feedAnchorPx.x}px`,
                top: `${feedAnchorPx.y}px`,
              }}
            />
            <span
              className="pointer-events-none absolute z-20 rounded bg-cyan-500/85 px-1 py-[1px] text-[8px] font-semibold leading-none text-white"
              style={{
                left: `${hitCenterPx.x}px`,
                top: `${Math.max(0, hitCenterPx.y - 16)}px`,
                transform: 'translateX(-50%)',
              }}>
              点击中心
            </span>
            <span
              className="pointer-events-none absolute z-20 rounded bg-amber-500/85 px-1 py-[1px] text-[8px] font-semibold leading-none text-white"
              style={{
                left: `${feedAnchorPx.x}px`,
                top: `${Math.max(0, feedAnchorPx.y - 16)}px`,
                transform: 'translateX(-50%)',
              }}>
              吃食点
            </span>
          </>
        )}
        {onSelect && (
          <button
            type="button"
            aria-label={`查看${pet.nickname ?? spriteOption.label}`}
            className={cn(
              'absolute z-20 pointer-events-auto cursor-pointer rounded-full border-0 bg-transparent p-0',
              debugHitArea && 'border border-rose-400/90 bg-rose-300/15 shadow-[0_0_0_1px_rgba(255,255,255,0.35)]',
            )}
            style={{
              left: `${hitLeftPx}px`,
              top: `${hitTopPx}px`,
              width: `${hitWidthPx}px`,
              height: `${hitHeightPx}px`,
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              if (onSelect) {
                onSelect(pet);
                return;
              }
              triggerAction('happy');
            }}>
            {debugHitArea && (
              <span className="pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 rounded bg-black/55 px-1 py-[1px] text-[8px] font-semibold leading-none text-white">
                {Math.round(hitWidthPx)}×{Math.round(hitHeightPx)}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

interface PetSceneProps {
  mini?: boolean;
  isDarkBackdrop?: boolean;
  magicBroomEnabled?: boolean;
  magicBroomHomePosition?: FacilityPoint;
  magicBroomPlacementActive?: boolean;
  sceneSurfaceRef?: React.MutableRefObject<HTMLDivElement | null>;
  onPetSelect?: (pet: CompletedPet) => void;
  onSceneBlankClick?: () => void;
  onSceneBlankPointer?: (point: {x: number; y: number}) => void;
  onWasteSpotsChange?: (spots: SceneWasteSpot[]) => void;
  highlightedWasteId?: string | null;
  cleanedWasteRequest?: SceneWasteCleanupRequest | null;
  onRuntimePetPointChange?: (
    instanceId: string,
    points: {
      interactionX: number;
      interactionY: number;
      bubbleX: number;
      bubbleY: number;
      feedX: number;
      feedY: number;
      feedLeftX: number;
      feedLeftY: number;
      feedRightX: number;
      feedRightY: number;
    },
  ) => void;
  actionRequest?: ScenePetActionRequest | null;
  feedMoveRequests?: Record<string, ScenePetFeedMoveRequest>;
  onPetFeedStarted?: (payload: {instanceId: string; dropId: string}) => boolean;
  onPetFeedArrived?: (payload: {instanceId: string; dropId: string; x: number; y: number}) => void;
  onPetFeedChaseFailed?: (payload: {instanceId: string; dropId: string}) => void;
  feedDrops?: SceneFeedDrop[];
  debugHitArea?: boolean;
}

export function PetScene({
  mini = false,
  isDarkBackdrop = false,
  magicBroomEnabled = false,
  magicBroomHomePosition = MAGIC_BROOM_HOME_DEFAULT,
  magicBroomPlacementActive = false,
  sceneSurfaceRef,
  onPetSelect,
  onSceneBlankClick,
  onSceneBlankPointer,
  onWasteSpotsChange,
  highlightedWasteId = null,
  cleanedWasteRequest = null,
  onRuntimePetPointChange,
  actionRequest,
  feedMoveRequests = {},
  onPetFeedStarted,
  onPetFeedArrived,
  onPetFeedChaseFailed,
  feedDrops = [],
  debugHitArea = false,
}: PetSceneProps) {
  const currentTheme = useStore((state) => state.currentTheme);
  const completedPets = useStore((state) => state.completedPets);
  const customPets = useStore((state) => state.customPets);
  const cleanCompletedPetWaste = useStore((state) => state.cleanCompletedPetWaste);
  const syncPetData = useStore((state) => state.syncPetData);
  const updatePetPositionsBatch = useStore((state) => state.updatePetPositionsBatch);
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const [sceneSize, setSceneSize] = useState({width: 0, height: 0});
  const [spriteAssetsReady, setSpriteAssetsReady] = useState(false);
  const [sceneWasteSpots, setSceneWasteSpots] = useState<SceneWasteSpot[]>([]);
  const runtimeSceneSpritePetsRef = useRef<SceneSpritePetLite[]>([]);
  const runtimeSceneSpriteIndexRef = useRef(new Map<string, number>());
  const pendingPositionUpdatesRef = useRef(new Map<string, {x: number; y: number}>());
  const lastFlushAtRef = useRef(0);
  const setSceneElementRef = useCallback((node: HTMLDivElement | null) => {
    sceneRef.current = node;
    if (sceneSurfaceRef) {
      sceneSurfaceRef.current = node;
    }
  }, [sceneSurfaceRef]);

  useEffect(() => {
    syncPetData();
  }, [syncPetData]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      syncPetData();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [syncPetData]);

  useEffect(() => {
    const element = sceneRef.current;
    if (!element) return;

    const updateSize = () => {
      setSceneSize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const petsInTheme = useMemo(
    () => completedPets.filter((pet) => pet.theme === currentTheme),
    [completedPets, currentTheme],
  );

  useEffect(() => {
    if (!cleanedWasteRequest) return;
    setSceneWasteSpots((previous) => {
      const next = previous.filter((spot) => spot.id !== cleanedWasteRequest.id);
      return next.length === previous.length ? previous : next;
    });
  }, [cleanedWasteRequest]);

  useEffect(() => {
    const next = petsInTheme.flatMap((pet) =>
      (pet.wasteSpots ?? []).map((spot) => ({
        id: spot.id,
        instanceId: pet.instanceId,
        x: spot.x,
        y: spot.y,
      })),
    );

    setSceneWasteSpots((previous) => {
      if (
        previous.length === next.length
        && previous.every((spot, index) =>
          spot.id === next[index]?.id
          && spot.instanceId === next[index]?.instanceId
          && Math.abs(spot.x - (next[index]?.x ?? 0)) < 0.001
          && Math.abs(spot.y - (next[index]?.y ?? 0)) < 0.001,
        )
      ) {
        return previous;
      }
      return next;
    });
  }, [petsInTheme]);
  const sceneSpritePets = useMemo(
    () =>
      petsInTheme
        .filter((pet) => !pet.isDead)
        .filter((pet) => isPetSpriteKey(pet.petId))
        .map((pet) => ({
          instanceId: pet.instanceId,
          petId: pet.petId,
          x: pet.x,
          y: pet.y,
        })),
    [petsInTheme],
  );

  useEffect(() => {
    const nextRuntimePets = sceneSpritePets.map((pet) => ({...pet}));
    runtimeSceneSpritePetsRef.current = nextRuntimePets;
    runtimeSceneSpriteIndexRef.current = new Map(
      nextRuntimePets.map((pet, index) => [pet.instanceId, index]),
    );
  }, [sceneSpritePets]);

  const flushPositionUpdates = useCallback(() => {
    if (pendingPositionUpdatesRef.current.size === 0) return;
    const updates = Array.from(pendingPositionUpdatesRef.current.entries()).map(([instanceId, pos]) => ({
      instanceId,
      x: pos.x,
      y: pos.y,
    }));
    pendingPositionUpdatesRef.current.clear();
    lastFlushAtRef.current = Date.now();
    updatePetPositionsBatch(updates);
  }, [updatePetPositionsBatch]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      flushPositionUpdates();
    }, 1200);
    return () => {
      window.clearInterval(timer);
      flushPositionUpdates();
    };
  }, [flushPositionUpdates]);

  const handleSpriteMove = useCallback((instanceId: string, x: number, y: number) => {
    const runtimeIndex = runtimeSceneSpriteIndexRef.current.get(instanceId);
    if (runtimeIndex !== undefined) {
      const current = runtimeSceneSpritePetsRef.current[runtimeIndex];
      if (current) {
        current.x = x;
        current.y = y;
      }
    }

    pendingPositionUpdatesRef.current.set(instanceId, {x, y});
    const now = Date.now();
    if (
      pendingPositionUpdatesRef.current.size >= 8
      || now - lastFlushAtRef.current > 1800
    ) {
      flushPositionUpdates();
    }
  }, [flushPositionUpdates]);

  const sceneSpritePetIdKey = useMemo(() => (
    Array.from(new Set(sceneSpritePets.map((pet) => pet.petId))).sort().join('|')
  ), [sceneSpritePets]);
  const activeFeedDropIds = useMemo(
    () => new Set(feedDrops.map((drop) => drop.id)),
    [feedDrops],
  );
  useEffect(() => {
    onWasteSpotsChange?.(sceneWasteSpots);
  }, [onWasteSpotsChange, sceneWasteSpots]);
  const handleAutoCleanWaste = useCallback((spot: SceneWasteSpot) => {
    const cleaned = cleanCompletedPetWaste(spot.instanceId, spot.id);
    if (!cleaned) return;

    setSceneWasteSpots((previous) => previous.filter((item) => item.id !== spot.id));
  }, [cleanCompletedPetWaste]);

  useEffect(() => {
    let cancelled = false;
    const spritePetIds = sceneSpritePetIdKey ? sceneSpritePetIdKey.split('|').filter(Boolean) : [];

    if (spritePetIds.length === 0) {
      setSpriteAssetsReady(true);
      return () => {
        cancelled = true;
      };
    }

    const paths = new Set<string>();
    spritePetIds.forEach((petId) => {
      SPRITE_ACTIONS.forEach((action) => {
        const config = getPetSpriteConfigByKey(petId, action);
        if (config?.path) paths.add(config.path);
      });
    });

    if (paths.size === 0) {
      setSpriteAssetsReady(true);
      return () => {
        cancelled = true;
      };
    }

    preloadSpritePaths(Array.from(paths)).then(() => {
      if (cancelled) return;
      setSpriteAssetsReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [sceneSpritePetIdKey]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="pointer-events-none absolute inset-x-0 bottom-[-9%] z-0 h-[30%]"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(15,23,42,0.14) 0%, rgba(15,23,42,0.06) 42%, rgba(15,23,42,0) 76%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-[-7%] z-0 h-[30%]"
        style={{
          background:
            'linear-gradient(180deg, rgba(15,23,42,0) 0%, rgba(15,23,42,0.04) 60%, rgba(15,23,42,0.08) 100%)',
        }}
      />
      <div
        ref={setSceneElementRef}
        className="absolute inset-x-0 top-0 bottom-24 overflow-hidden pointer-events-auto"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
            const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100);
            onSceneBlankPointer?.({x, y});
          }
          onSceneBlankClick?.();
        }}>
        {SHOW_SCENE_MOVE_BOUNDS && (
          <div
            className="pointer-events-none absolute z-[9999] rounded-md border-2 border-rose-500/85"
            style={{
              left: `${SCENE_X_MIN}%`,
              top: `${SCENE_BOTTOM_MIN}%`,
              width: `${SCENE_X_MAX - SCENE_X_MIN}%`,
              height: `${SCENE_BOTTOM_MAX - SCENE_BOTTOM_MIN}%`,
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.45)',
            }}
          />
        )}
        {sceneWasteSpots.map((spot) => (
          <div
            key={spot.id}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
            style={{
              left: `${spot.x}%`,
              top: `${spot.y}%`,
              zIndex: getLayerZIndex(spot.y) - 1,
            }}>
            <div
              className={cn(
                'relative transition-all duration-150',
                highlightedWasteId === spot.id ? 'scale-[1.08] -translate-y-0.5' : '',
              )}>
              {highlightedWasteId === spot.id && (
                <div className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-200/90 bg-emerald-200/25 shadow-[0_0_0_3px_rgba(110,231,183,0.2)]" />
              )}
              <WasteIcon mini={mini} />
            </div>
          </div>
        ))}
        {feedDrops.map((drop) => (
          (() => {
            const lifeProgress = clamp((Date.now() - drop.createdAt) / Math.max(1, drop.ttlMs), 0, 1);
            return (
              <div
                key={drop.id}
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-full transition-opacity duration-200"
                style={{
                  left: `${drop.x}%`,
                  top: `${drop.y}%`,
                  zIndex: getLayerZIndex(drop.y) - 1,
                  opacity: 1 - lifeProgress * 0.45,
                }}>
                <div className="inline-flex items-center">
                  <FoodSprite
                    foodId={drop.foodId}
                    size={16}
                    className="drop-shadow-[0_2px_4px_rgba(15,23,42,0.2)]"
                  />
                </div>
              </div>
            );
          })()
        ))}
        {magicBroomEnabled && currentTheme === 'A' && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${magicBroomHomePosition.x}%`,
              top: `${magicBroomHomePosition.y}%`,
              zIndex: 90,
            }}>
            <div className="relative flex flex-col items-center">
              {magicBroomPlacementActive && (
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-200/90 bg-[rgba(252,255,252,0.96)] px-2.5 py-1 text-[9px] font-black text-emerald-800 shadow-[0_8px_18px_rgba(16,185,129,0.16)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  扫把停靠点
                </div>
              )}
              <div className="relative h-7 w-12">
                <div className={cn(
                  'absolute left-1/2 top-1/2 h-[18px] w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border',
                  magicBroomPlacementActive
                    ? 'border-emerald-300/85 bg-emerald-200/18 shadow-[0_0_0_2px_rgba(110,231,183,0.14),0_6px_18px_rgba(16,185,129,0.14)]'
                    : (isDarkBackdrop
                      ? 'border-white/20 bg-white/6 shadow-[0_4px_10px_rgba(15,23,42,0.18)]'
                      : 'border-emerald-200/70 bg-[rgba(241,253,244,0.38)] shadow-[0_4px_10px_rgba(34,197,94,0.08)]'),
                )} />
                <div className={cn(
                  'absolute left-1/2 top-1/2 h-2.5 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border',
                  magicBroomPlacementActive
                    ? 'border-emerald-300/75'
                    : (isDarkBackdrop ? 'border-white/14' : 'border-emerald-200/55'),
                )} />
                <div className={cn(
                  'absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[3px] border',
                  magicBroomPlacementActive
                    ? 'border-emerald-400/90 bg-emerald-200/85 shadow-[0_0_10px_rgba(16,185,129,0.22)]'
                    : (isDarkBackdrop
                      ? 'border-white/28 bg-white/18'
                      : 'border-emerald-300/70 bg-white/78'),
                )} />
                <div className={cn(
                  'absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full',
                  magicBroomPlacementActive
                    ? 'bg-emerald-600/90'
                    : (isDarkBackdrop ? 'bg-white/45' : 'bg-emerald-500/65'),
                )} />
                {magicBroomPlacementActive && (
                  <>
                    <div className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-300/45 animate-ping" />
                    <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-200/28" />
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        <MagicBroomLayer
          active={magicBroomEnabled && currentTheme === 'A'}
          mini={mini}
          homePosition={magicBroomHomePosition}
          wasteSpots={sceneWasteSpots}
          onCleanSpot={handleAutoCleanWaste}
        />
        {petsInTheme.map((pet) => {
          if (pet.isDead) {
            return <DeadPetInstance key={pet.instanceId} pet={pet} mini={mini} onSelect={onPetSelect} />;
          }

          if (isPetSpriteKey(pet.petId)) {
            if (!spriteAssetsReady) return null;
            return (
              <SpritePetInstance
                key={pet.instanceId}
                pet={pet}
                mini={mini}
                isDarkBackdrop={isDarkBackdrop}
                onMove={handleSpriteMove}
                onRuntimePetPointChange={onRuntimePetPointChange}
                onSelect={onPetSelect}
                actionRequest={actionRequest}
                feedMoveRequest={feedMoveRequests[pet.instanceId] ?? null}
                activeFeedDropIds={activeFeedDropIds}
                onFeedStarted={onPetFeedStarted}
                onFeedArrived={onPetFeedArrived}
                onFeedChaseFailed={onPetFeedChaseFailed}
                debugHitArea={debugHitArea}
                sceneSize={sceneSize}
                sceneSpritePetsRef={runtimeSceneSpritePetsRef}
              />
            );
          }

          if (currentTheme === 'custom') {
            const customPet = customPets.find((item) => item.id === pet.petId);
            if (!customPet) return null;

            return (
              <BasicPetInstance
                key={pet.instanceId}
                pet={pet}
                mini={mini}
                theme={currentTheme}
              onSelect={onPetSelect}>
                <div className="relative flex flex-col items-center">
                  <img
                    src={customPet.image}
                    alt={customPet.name}
                    className={cn('object-contain drop-shadow-xl', mini ? 'w-8 h-8' : 'w-12 h-12')}
                  />
                </div>
              </BasicPetInstance>
            );
          }

          const petDef = PETS.find((item) => item.id === pet.petId);
          if (!petDef) return null;

          let emoji = petDef.base;
          if (pet.state === 'focus') emoji = petDef.focus;
          if (pet.state === 'heal') emoji = petDef.heal;
          if (pet.state === 'active') emoji = petDef.active;

          return (
            <BasicPetInstance
              key={pet.instanceId}
              pet={pet}
              mini={mini}
              theme={currentTheme}
              onSelect={onPetSelect}>
              <div className="relative">
                <span className={cn('drop-shadow-md', mini ? 'text-lg' : 'text-2xl')}>{emoji}</span>
              </div>
            </BasicPetInstance>
          );
        })}
      </div>
    </div>
  );
}
