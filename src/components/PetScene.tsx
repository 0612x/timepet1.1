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
import {SpriteActor} from './SpriteActor';
import {ensureSpritePathLoaded, preloadSpritePaths} from '../utils/spriteAssetLoader';
import {
  SCENE_BOTTOM_MAX,
  SCENE_BOTTOM_MIN,
  SCENE_X_MAX,
  SCENE_X_MIN,
} from '../constants/sceneBounds';

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
  onMove: (id: string, x: number, y: number) => void;
  onSelect?: (pet: CompletedPet) => void;
  actionRequest?: ScenePetActionRequest | null;
  feedMoveRequest?: ScenePetFeedMoveRequest | null;
  onFeedArrived?: (payload: {instanceId: string; dropId: string}) => void;
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

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const SPRITE_ACTIONS: PetSpriteAction[] = ['idle', 'move', 'feed', 'happy'];
const getLayerZIndex = (y: number) => 100 + Math.round(y * 10);
const SHOW_SCENE_MOVE_BOUNDS = false;
const SCENE_POOP_ICON_PATHS = [
  '/images/pets/farm/farm_poop.png',
  '/images/pets/farm/poop.png',
  '/images/pets/farm/farm_waste.png',
] as const;
const WASTE_VISIBLE_THRESHOLD = 28;
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
    <div className="pointer-events-none">
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

function getPetWasteDropPosition(
  pet: CompletedPet,
  mini: boolean,
  sceneSize: {width: number; height: number},
) {
  const jitterX = (hashToUnit(`${pet.instanceId}:waste:x`) - 0.5) * (mini ? 1.2 : 1.8);
  const jitterY = (hashToUnit(`${pet.instanceId}:waste:y`) - 0.5) * (mini ? 0.7 : 1.1);

  if (isPetSpriteKey(pet.petId)) {
    const idleConfig = getPetSpriteConfigByKey(pet.petId, 'idle')
      ?? getPetSpriteConfigByKey(pet.petId, 'move');
    const frameWidth = idleConfig?.frameWidth ?? 32;
    const frameHeight = idleConfig?.frameHeight ?? 32;
    const speciesSizeFactor = SPECIES_SIZE_FACTOR[pet.petId] ?? 1;
    const targetVisualHeight = (mini ? 46 : 72) * speciesSizeFactor;
    const normalizedScale = targetVisualHeight / frameHeight;
    const scale = normalizedScale * (mini ? 1 : 1.02);
    const visualScale = mini ? 0.92 : 1.06;
    const spriteWidthPx = frameWidth * scale * visualScale;
    const spriteHeightPx = frameHeight * scale * visualScale;
    const widthPercent = sceneSize.width > 0 ? (spriteWidthPx / sceneSize.width) * 100 : (mini ? 8 : 10);
    const heightPercent = sceneSize.height > 0 ? (spriteHeightPx / sceneSize.height) * 100 : (mini ? 10 : 13);

    return {
      x: clamp(pet.x + widthPercent * 0.5 + jitterX, SCENE_X_MIN, SCENE_X_MAX),
      y: clamp(pet.y + heightPercent + jitterY, SCENE_BOTTOM_MIN, SCENE_BOTTOM_MAX + 6),
    };
  }

  return {
    x: clamp(pet.x + (mini ? 2.2 : 2.8) + jitterX, SCENE_X_MIN, SCENE_X_MAX),
    y: clamp(pet.y + (mini ? 4.8 : 6.2) + jitterY, SCENE_BOTTOM_MIN, SCENE_BOTTOM_MAX + 6),
  };
}

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
        'absolute whitespace-nowrap pointer-events-auto',
        getAnimationClass(pet.variant, theme),
      )}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.(pet);
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
  onMove,
  onSelect,
  actionRequest,
  feedMoveRequest,
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
  const feedMoveTargetRef = useRef<{x: number; y: number; dropId: string} | null>(null);
  const feedCommitTimerRef = useRef<number | null>(null);
  const feedStuckAttemptsRef = useRef(0);
  const onFeedArrivedRef = useRef(onFeedArrived);
  const onFeedChaseFailedRef = useRef(onFeedChaseFailed);
  const forcedIdleTimerRef = useRef<number | null>(null);
  const movingUntilRef = useRef(0);
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
  const moveDuration = mini ? 1600 : 2200;
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
  const spriteWidthPx = actorWidthPx * visualScale;
  const spriteHeightPx = actorHeightPx * visualScale;
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
      const yMin = bottomMinPercent - spriteHeightPercent;
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

  const [action, setAction] = useState<PetSpriteAction>(defaultAction);
  const actionRef = useRef<PetSpriteAction>(defaultAction);

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
  }, [pos]);

  useEffect(() => {
    actionRef.current = action;
  }, [action]);

  useEffect(() => {
    onFeedArrivedRef.current = onFeedArrived;
  }, [onFeedArrived]);

  useEffect(() => {
    onFeedChaseFailedRef.current = onFeedChaseFailed;
  }, [onFeedChaseFailed]);

  useEffect(() => {
    faceRightRef.current = faceRight;
  }, [faceRight]);

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
      queuedActionIntentRef.current = null;
      movingUntilRef.current = 0;
      feedMoveTargetRef.current = null;
      feedStuckAttemptsRef.current = 0;
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
    setPos(nextPos);
    onMove(pet.instanceId, clampedX, clampedY);
  }, [bounds.xMax, bounds.xMin, bounds.yMax, bounds.yMin, onMove, pet.instanceId]);

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
    feedMoveTargetRef.current = {
      x: clamp(feedMoveRequest.x, bounds.xMin, bounds.xMax),
      y: clamp(feedMoveRequest.y, bounds.yMin, bounds.yMax),
      dropId: feedMoveRequest.dropId,
    };
    feedStuckAttemptsRef.current = 0;
  }, [bounds.xMax, bounds.xMin, bounds.yMax, bounds.yMin, feedMoveRequest, pet.instanceId]);

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

    const getCollisionHalfWidthPercent = (petId: string) => {
      if (sceneSize.width <= 0) return mini ? 2.2 : 2.8;
      const cfg = getPetSpriteConfigByKey(petId, 'idle') ?? getPetSpriteConfigByKey(petId, 'move');
      const width = cfg?.frameWidth ?? 32;
      const height = cfg?.frameHeight ?? 32;
      const targetHeight = mini ? 46 : 72;
      const actorScale = (targetHeight / height) * (mini ? 1 : 1.02) * (mini ? 0.92 : 1.06);
      const widthPercent = (width * actorScale / sceneSize.width) * 100;
      return Math.max(2.6, widthPercent * 0.34);
    };

    const isPositionBlocked = (x: number, y: number) => {
      const selfHalfWidth = getCollisionHalfWidthPercent(pet.petId);
      const verticalThreshold = mini ? 2.4 : 3.4;
      return sceneSpritePetsRef.current.some((other) => {
        if (other.instanceId === pet.instanceId) return false;
        const otherHalfWidth = getCollisionHalfWidthPercent(other.petId);
        const minGapX = (selfHalfWidth + otherHalfWidth) * 0.9;
        return Math.abs(other.x - x) < minGapX && Math.abs(other.y - y) < verticalThreshold;
      });
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

    const hasEnoughDisplacement = (
      from: {x: number; y: number},
      to: {x: number; y: number},
    ) => getTravelDistance(from, to) >= (mini ? 0.72 : 0.95);

    const run = () => {
      if (!alive) return;
      const now = Date.now();
      if (now < forcedActionUntilRef.current) {
        timer = schedule(run, 130 + Math.random() * 120);
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
      const feedTarget = feedMoveTargetRef.current;
      if (feedTarget) {
        const deltaX = feedTarget.x - currentAtStart.x;
        const deltaY = feedTarget.y - currentAtStart.y;
        const distance = Math.hypot(deltaX, deltaY * 1.28);

        if (distance <= 1.35) {
          feedStuckAttemptsRef.current = 0;
          feedMoveTargetRef.current = null;
          movingUntilRef.current = 0;
          const feedAction = availableActions.includes('feed')
            ? 'feed'
            : availableActions.includes('idle')
              ? 'idle'
              : defaultAction;
          playForcedAction(feedAction);

          if (feedCommitTimerRef.current !== null) {
            window.clearTimeout(feedCommitTimerRef.current);
          }
          feedCommitTimerRef.current = window.setTimeout(() => {
            onFeedArrivedRef.current?.({
              instanceId: pet.instanceId,
              dropId: feedTarget.dropId,
            });
            feedCommitTimerRef.current = null;
          }, 220 + Math.random() * 120);

          timer = schedule(run, 180 + Math.random() * 100);
          return;
        }

        const stepX = Math.min(Math.abs(deltaX), mini ? 3.2 : 4.2);
        const stepY = Math.min(Math.abs(deltaY), mini ? 1.2 : 1.6);
        let nextX = clamp(
          currentAtStart.x + Math.sign(deltaX || 1) * stepX,
          bounds.xMin,
          bounds.xMax,
        );
        let nextY = clamp(
          currentAtStart.y + Math.sign(deltaY || 1) * stepY,
          bounds.yMin,
          bounds.yMax,
        );

        if (isPositionBlocked(nextX, nextY) && distance > 2.4) {
          const sidestepY = clamp(
            currentAtStart.y + (Math.random() > 0.5 ? 1 : -1) * (mini ? 0.8 : 1.1),
            bounds.yMin,
            bounds.yMax,
          );
          if (!isPositionBlocked(nextX, sidestepY)) {
            nextY = sidestepY;
          } else {
            const sidestepX = clamp(
              currentAtStart.x + (Math.random() > 0.5 ? 1 : -1) * (mini ? 1.8 : 2.6),
              bounds.xMin,
              bounds.xMax,
            );
            if (!isPositionBlocked(sidestepX, nextY)) {
              nextX = sidestepX;
            }
          }
        }

        if (isPositionBlocked(nextX, nextY)) {
          feedStuckAttemptsRef.current += 1;
          if (feedStuckAttemptsRef.current >= 2) {
            const failedDropId = feedTarget.dropId;
            feedMoveTargetRef.current = null;
            movingUntilRef.current = 0;
            setNextAction(availableActions.includes('idle') ? 'idle' : defaultAction);
            onFeedChaseFailedRef.current?.({
              instanceId: pet.instanceId,
              dropId: failedDropId,
            });
            timer = schedule(run, 130 + Math.random() * 110);
            return;
          }
          setNextAction(availableActions.includes('idle') ? 'idle' : defaultAction);
          movingUntilRef.current = 0;
          timer = schedule(run, 120 + Math.random() * 100);
          return;
        }

        if (!hasEnoughDisplacement(currentAtStart, {x: nextX, y: nextY})) {
          feedStuckAttemptsRef.current += 1;
          if (feedStuckAttemptsRef.current >= 2) {
            const failedDropId = feedTarget.dropId;
            feedMoveTargetRef.current = null;
            movingUntilRef.current = 0;
            setNextAction(availableActions.includes('idle') ? 'idle' : defaultAction);
            onFeedChaseFailedRef.current?.({
              instanceId: pet.instanceId,
              dropId: failedDropId,
            });
            timer = schedule(run, 130 + Math.random() * 110);
            return;
          }
          setNextAction(availableActions.includes('idle') ? 'idle' : defaultAction);
          timer = schedule(run, 120 + Math.random() * 90);
          return;
        }
        feedStuckAttemptsRef.current = 0;

        const nextPos = {x: nextX, y: nextY};
        posRef.current = nextPos;
        setPos(nextPos);
        onMove(pet.instanceId, nextX, nextY);
        setFacingDirection(nextX >= currentAtStart.x);
        setNextAction(availableActions.includes('move') ? 'move' : defaultAction);

        const chaseDuration = mini ? 900 : 1200;
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
          posRef.current = nextPos;
          setPos(nextPos);
          onMove(pet.instanceId, nextX, nextY);
          setNextAction('move');
          movingUntilRef.current = Date.now() + moveDuration + 60;

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
          }, moveDuration + 40);
          return;
        }
      }

      const nextRestAction = pickRestAction();
      setNextAction(nextRestAction);
      timer = schedule(run, getRestDelay(nextRestAction));
    };

    timer = schedule(run, 1200 + Math.random() * 1000);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [availableActions, bounds.xMax, bounds.xMin, bounds.yMax, bounds.yMin, defaultAction, mini, moveDuration, onMove, pet.instanceId, pet.petId, pet.state, sceneSize.width]);

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
        transitionDuration: motionReady ? `${moveDuration}ms` : '0ms',
      }}>
      <div className="relative">
        <SpriteActor
          spriteKey={spriteOption.key}
          action={action}
          scale={scale}
          flipX={finalFlipX}
          seed={actionSeed}
          ariaLabel={spriteOption.label}
          className="pointer-events-none relative z-10 drop-shadow-[0_5px_8px_rgba(15,23,42,0.18)]"
        />
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
  onPetSelect?: (pet: CompletedPet) => void;
  onSceneBlankClick?: () => void;
  onSceneBlankPointer?: (point: {x: number; y: number}) => void;
  actionRequest?: ScenePetActionRequest | null;
  feedMoveRequest?: ScenePetFeedMoveRequest | null;
  onPetFeedArrived?: (payload: {instanceId: string; dropId: string}) => void;
  onPetFeedChaseFailed?: (payload: {instanceId: string; dropId: string}) => void;
  feedDrops?: SceneFeedDrop[];
  debugHitArea?: boolean;
}

export function PetScene({
  mini = false,
  onPetSelect,
  onSceneBlankClick,
  onSceneBlankPointer,
  actionRequest,
  feedMoveRequest,
  onPetFeedArrived,
  onPetFeedChaseFailed,
  feedDrops = [],
  debugHitArea = false,
}: PetSceneProps) {
  const currentTheme = useStore((state) => state.currentTheme);
  const completedPets = useStore((state) => state.completedPets);
  const customPets = useStore((state) => state.customPets);
  const syncPetData = useStore((state) => state.syncPetData);
  const updatePetPositionsBatch = useStore((state) => state.updatePetPositionsBatch);
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const [sceneSize, setSceneSize] = useState({width: 0, height: 0});
  const [spriteAssetsReady, setSpriteAssetsReady] = useState(false);
  const [sceneWasteSpots, setSceneWasteSpots] = useState<Record<string, {x: number; y: number}>>({});
  const runtimeSceneSpritePetsRef = useRef<SceneSpritePetLite[]>([]);
  const runtimeSceneSpriteIndexRef = useRef(new Map<string, number>());
  const pendingPositionUpdatesRef = useRef(new Map<string, {x: number; y: number}>());
  const lastFlushAtRef = useRef(0);

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
    setSceneWasteSpots((previous) => {
      const next = {...previous};
      let changed = false;
      const currentIds = new Set(petsInTheme.map((pet) => pet.instanceId));

      Object.keys(next).forEach((instanceId) => {
        if (currentIds.has(instanceId)) return;
        delete next[instanceId];
        changed = true;
      });

      petsInTheme.forEach((pet) => {
        const wasteLevel = pet.wasteLevel ?? 0;
        if (wasteLevel >= WASTE_VISIBLE_THRESHOLD) {
          if (!next[pet.instanceId]) {
            next[pet.instanceId] = getPetWasteDropPosition(pet, mini, sceneSize);
            changed = true;
          }
          return;
        }
        if (wasteLevel < WASTE_VISIBLE_THRESHOLD && next[pet.instanceId]) {
          delete next[pet.instanceId];
          changed = true;
        }
      });

      return changed ? next : previous;
    });
  }, [mini, petsInTheme, sceneSize]);
  const sceneSpritePets = useMemo(
    () =>
      petsInTheme
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
        ref={sceneRef}
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
        {Object.entries(sceneWasteSpots).map(([instanceId, position]) => (
          <div
            key={`waste-${instanceId}`}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
            style={{
              left: `${position.x}%`,
              top: `${position.y}%`,
              zIndex: getLayerZIndex(position.y) - 1,
            }}>
            <WasteIcon mini={mini} />
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
                <div className="inline-flex items-center rounded-full border border-amber-300/70 bg-amber-100/95 px-1.5 py-0.5 text-[10px] leading-none text-amber-700 shadow-[0_2px_6px_rgba(15,23,42,0.14)]">
                  🌾
                </div>
              </div>
            );
          })()
        ))}
        {petsInTheme.map((pet) => {
          if (isPetSpriteKey(pet.petId)) {
            if (!spriteAssetsReady) return null;
            return (
              <SpritePetInstance
                key={pet.instanceId}
                pet={pet}
                mini={mini}
                onMove={handleSpriteMove}
                onSelect={onPetSelect}
                actionRequest={actionRequest}
                feedMoveRequest={feedMoveRequest}
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
