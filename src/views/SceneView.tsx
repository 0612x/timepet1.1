import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Archive, ChevronLeft, ChevronRight, Cloud, Lock, MoonStar, Palette, Sparkles, Sun, Sunset, Waves, Wheat, X} from 'lucide-react';
import {
  PetScene,
  type SceneFeedDrop,
  type ScenePetActionRequest,
  type ScenePetFeedMoveRequest,
  type SceneWasteSpot,
} from '../components/PetScene';
import {PetBoardSheet} from '../components/PetBoardSheet';
import {SpriteActor} from '../components/SpriteActor';
import {cn} from '../utils/cn';
import {useStore, type CompletedPet} from '../store/useStore';
import {PETS, type ThemeType} from '../data/pets';
import {getPetSpriteOptionByKey, hasPetSpriteAction, isPetSpriteKey, type PetSpriteAction} from '../data/petSprites';
import {formatZhDate, getSimulatedDate} from '../utils/date';
import {SCENE_BOTTOM_MAX, SCENE_BOTTOM_MIN, SCENE_X_MAX, SCENE_X_MIN} from '../constants/sceneBounds';
import {assignFeedTargets} from '../utils/feedSystem';
import {
  getHealthLabel,
  getMoodLabel,
  getPetMetric,
  getSatietyLabel,
} from '../utils/petStatus';

const SCENE_TABS: Array<{theme: ThemeType; label: string; locked?: boolean}> = [
  {theme: 'A', label: '农场'},
  {theme: 'B', label: '深海', locked: true},
  {theme: 'custom', label: '手绘'},
];

type FarmSkyPhase = 'day' | 'noon' | 'dusk' | 'night';

const FARM_BACKGROUND_PATHS: Record<FarmSkyPhase, string> = {
  day: '/images/scenes/farm/farm_day.png',
  noon: '/images/scenes/farm/farm_noon.png',
  dusk: '/images/scenes/farm/farm_dusk.png',
  night: '/images/scenes/farm/farm_night.png',
};

const getFarmSkyPhase = (hour: number): FarmSkyPhase => {
  if (hour >= 16 && hour < 19) return 'dusk';
  if (hour >= 11 && hour < 16) return 'noon';
  if (hour >= 6 && hour < 11) return 'day';
  return 'night';
};

const FARM_SKY_TEST_ORDER: Array<FarmSkyPhase | null> = [null, 'day', 'noon', 'dusk', 'night'];
const FARM_SKY_PHASE_LABELS: Record<FarmSkyPhase, string> = {
  day: '白天',
  noon: '正午',
  dusk: '傍晚',
  night: '夜晚',
};

const QUALITY_LABELS: Record<CompletedPet['quality'], string> = {
  common: '普通',
  rare: '稀有',
  epic: '史诗',
};

const STATE_LABELS: Record<CompletedPet['state'], string> = {
  base: '基础',
  focus: '专注',
  heal: '治愈',
  active: '活力',
};

const STATE_TONE: Record<CompletedPet['state'], string> = {
  base: 'border-slate-200 bg-slate-100 text-slate-600',
  focus: 'border-indigo-200 bg-indigo-100 text-indigo-700',
  heal: 'border-emerald-200 bg-emerald-100 text-emerald-700',
  active: 'border-amber-200 bg-amber-100 text-amber-700',
};
const CARD_TRANSITION_MS = 180;
const FARM_SCENE_TRANSITION_MS = 420;
const CARD_DIRECT_FEED_MS = 1300;
const CARD_DIRECT_CHEER_MS = 1100;
const SCENE_FEEDBACK_TTL_MS = 1450;
const SCENE_DEBUG_HIT_AREAS = false;
const FEED_DROP_TTL_MS = 30_000;
const FEED_DROP_BURST_COUNT = 3;
const FEED_BLOCK_SATIETY = 100;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

interface RuntimePetPoints {
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
}

interface CardFeedSession {
  instanceId: string;
  startedAt: number;
  endsAt: number;
}

type SceneFeedbackMetricKind = 'mood' | 'satiety';

interface SceneFeedbackMetric {
  kind: SceneFeedbackMetricKind;
  delta: number;
}

interface SceneFeedbackItem {
  id: string;
  instanceId: string;
  x: number;
  y: number;
  metrics: SceneFeedbackMetric[];
}

type SceneToolType = 'feed' | 'clean';

interface SceneToolDragState {
  tool: SceneToolType;
  pointerId: number;
  clientX: number;
  clientY: number;
  overDock: boolean;
  overScene: boolean;
  sceneX: number | null;
  sceneY: number | null;
  hoveredWasteInstanceId: string | null;
}

function getFarmSkyOverlayClass(phase: FarmSkyPhase) {
  if (phase === 'night') {
    return 'bg-[linear-gradient(180deg,rgba(2,6,23,0.18),rgba(2,6,23,0.34)_58%,rgba(2,6,23,0.18))]';
  }
  if (phase === 'noon') {
    return 'bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.03)_60%,rgba(255,255,255,0.02))]';
  }
  if (phase === 'dusk') {
    return 'bg-[linear-gradient(180deg,rgba(15,23,42,0.06),rgba(15,23,42,0.2)_60%,rgba(15,23,42,0.08))]';
  }
  return 'bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.1)_62%,rgba(255,255,255,0.02))]';
}

function resolveSceneCardAction(petId: string, state: CompletedPet['state']): PetSpriteAction {
  const preferredByState: Record<CompletedPet['state'], PetSpriteAction> = {
    base: 'idle',
    focus: 'move',
    heal: 'happy',
    active: 'feed',
  };
  const preferredAction = preferredByState[state];
  if (hasPetSpriteAction(petId, preferredAction)) return preferredAction;
  if (hasPetSpriteAction(petId, 'idle')) return 'idle';
  if (hasPetSpriteAction(petId, 'move')) return 'move';
  if (hasPetSpriteAction(petId, 'happy')) return 'happy';
  return 'feed';
}

export function SceneView() {
  const {
    currentTheme,
    setCurrentTheme,
    simulatedDateOffset,
    completedPets,
    customPets,
    renameCompletedPet,
    discardCompletedPet,
    clearScenePets,
    spawnAllScenePets,
    feedCompletedPet,
    cheerCompletedPet,
    cleanCompletedPetWaste,
  } = useStore();
  const [showPetBoard, setShowPetBoard] = useState(false);
  const [farmSkyPhaseOverride, setFarmSkyPhaseOverride] = useState<FarmSkyPhase | null>(null);
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());
  const [selectedPetInstanceId, setSelectedPetInstanceId] = useState<string | null>(null);
  const [cardPetSnapshot, setCardPetSnapshot] = useState<CompletedPet | null>(null);
  const [cardVisible, setCardVisible] = useState(false);
  const [farmOutgoingBackgroundPath, setFarmOutgoingBackgroundPath] = useState<string | null>(null);
  const [farmOutgoingSkyPhase, setFarmOutgoingSkyPhase] = useState<FarmSkyPhase | null>(null);
  const [sceneActionRequest, setSceneActionRequest] = useState<ScenePetActionRequest | null>(null);
  const [sceneFeedMoveRequests, setSceneFeedMoveRequests] = useState<Record<string, ScenePetFeedMoveRequest>>({});
  const [sceneFeedDrops, setSceneFeedDrops] = useState<SceneFeedDrop[]>([]);
  const [sceneWasteSpots, setSceneWasteSpots] = useState<SceneWasteSpot[]>([]);
  const [toolDragState, setToolDragState] = useState<SceneToolDragState | null>(null);
  const [sceneToolDockOpen, setSceneToolDockOpen] = useState(false);
  const [cardFeedSession, setCardFeedSession] = useState<CardFeedSession | null>(null);
  const [cardFeedProgress, setCardFeedProgress] = useState<number | null>(null);
  const [cardCheerSession, setCardCheerSession] = useState<CardFeedSession | null>(null);
  const [cardCheerProgress, setCardCheerProgress] = useState<number | null>(null);
  const [sceneFeedbackItems, setSceneFeedbackItems] = useState<SceneFeedbackItem[]>([]);
  const sceneFeedDropTimersRef = useRef<number[]>([]);
  const cardFeedTickTimerRef = useRef<number | null>(null);
  const cardFeedCompleteTimerRef = useRef<number | null>(null);
  const cardCheerTickTimerRef = useRef<number | null>(null);
  const cardCheerCompleteTimerRef = useRef<number | null>(null);
  const sceneFeedbackTimersRef = useRef<number[]>([]);
  const sceneFeedDropsRef = useRef<SceneFeedDrop[]>([]);
  const sceneFeedbackItemsRef = useRef<SceneFeedbackItem[]>([]);
  const sceneSurfaceRef = useRef<HTMLDivElement | null>(null);
  const sceneToolDockRef = useRef<HTMLDivElement | null>(null);
  const sceneWasteSpotsRef = useRef<SceneWasteSpot[]>([]);
  const toolDragStateRef = useRef<SceneToolDragState | null>(null);
  const runtimePetPointsRef = useRef(new Map<string, RuntimePetPoints>());
  const feedingPetIdsRef = useRef(new Set<string>());
  const feedDropAssignmentsRef = useRef(new Map<string, string>());
  const petFeedAssignmentsRef = useRef(new Map<string, string>());
  const feedDropClaimRef = useRef(new Map<string, string>());
  const sceneFeedMoveNonceRef = useRef(0);

  const today = useMemo(
    () => formatZhDate(getSimulatedDate(simulatedDateOffset)),
    [simulatedDateOffset],
  );
  const farmSkyPhase = useMemo(
    () => farmSkyPhaseOverride ?? getFarmSkyPhase(currentHour),
    [currentHour, farmSkyPhaseOverride],
  );
  const farmBackgroundPath = FARM_BACKGROUND_PATHS[farmSkyPhase];
  const farmVisualRef = useRef<{backgroundPath: string; skyPhase: FarmSkyPhase}>({
    backgroundPath: farmBackgroundPath,
    skyPhase: farmSkyPhase,
  });
  const farmVisualTimerRef = useRef<number | null>(null);

  const isOceanLocked = currentTheme === 'B';
  const effectiveTheme: ThemeType = currentTheme === 'C' ? 'A' : currentTheme;
  const petsInTheme = useMemo(
    () => completedPets.filter((pet) => pet.theme === effectiveTheme),
    [completedPets, effectiveTheme],
  );
  const selectedPet = useMemo(
    () => petsInTheme.find((pet) => pet.instanceId === selectedPetInstanceId) ?? null,
    [petsInTheme, selectedPetInstanceId],
  );
  const cardPet = useMemo(
    () => (selectedPet && !isOceanLocked ? selectedPet : cardPetSnapshot),
    [cardPetSnapshot, isOceanLocked, selectedPet],
  );
  const selectedSpriteOption = useMemo(
    () => (cardPet ? getPetSpriteOptionByKey(cardPet.petId) : null),
    [cardPet],
  );
  const selectedCustomPet = useMemo(
    () =>
      cardPet?.theme === 'custom'
        ? customPets.find((item) => item.id === cardPet.petId) ?? null
        : null,
    [cardPet, customPets],
  );
  const selectedLegacyPet = useMemo(
    () =>
      cardPet && !isPetSpriteKey(cardPet.petId) && cardPet.theme !== 'custom'
        ? PETS.find((item) => item.id === cardPet.petId) ?? null
        : null,
    [cardPet],
  );
  const selectedSpeciesName = cardPet
    ? selectedSpriteOption?.label
      ?? selectedCustomPet?.name
      ?? selectedLegacyPet?.name
      ?? cardPet.petId
    : '';
  const selectedDisplayName = cardPet
    ? cardPet.nickname
      ?? selectedSpriteOption?.label
      ?? selectedCustomPet?.name
      ?? selectedLegacyPet?.name
      ?? cardPet.petId
    : '';
  const currentThemeLabel = SCENE_TABS.find((item) => item.theme === effectiveTheme)?.label ?? '农场';

  const getThemeIcon = (theme: ThemeType) => {
    switch (theme) {
      case 'A':
        return <Cloud size={14} />;
      case 'B':
        return <Waves size={14} />;
      case 'custom':
        return <Palette size={14} />;
      case 'C':
        return <Cloud size={14} />;
    }
  };

  const getThemeBackground = () => {
    switch (effectiveTheme) {
      case 'A':
        return 'bg-gradient-to-b from-[#e8f9f2] to-[#d7f0dc]';
      case 'B':
        return 'bg-[radial-gradient(circle,_#1a2a6c,_#112240,_#000000)]';
      case 'custom':
        return 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50 via-white to-purple-50';
      default:
        return 'bg-gradient-to-b from-[#e8f9f2] to-[#d7f0dc]';
    }
  };

  const isFarmDark = effectiveTheme === 'A' && (farmSkyPhase === 'dusk' || farmSkyPhase === 'night');
  const isDarkBackdrop = effectiveTheme === 'B' || isFarmDark;
  const sceneWasteTotal = useMemo(
    () => sceneWasteSpots.reduce((total, spot) => total + spot.count, 0),
    [sceneWasteSpots],
  );
  const isSceneToolDragging = toolDragState !== null;
  const isSceneToolDockExpanded = sceneToolDockOpen || isSceneToolDragging;
  const handleSwitchTheme = (theme: ThemeType, locked?: boolean) => {
    if (locked) return;
    setCurrentTheme(theme);
  };
  const handleCycleFarmSkyPhase = () => {
    setFarmSkyPhaseOverride((previous) => {
      const currentIndex = FARM_SKY_TEST_ORDER.findIndex((item) => item === previous);
      const safeIndex = currentIndex >= 0 ? currentIndex : 0;
      const nextIndex = (safeIndex + 1) % FARM_SKY_TEST_ORDER.length;
      return FARM_SKY_TEST_ORDER[nextIndex];
    });
  };
  const farmSkyPhaseText = farmSkyPhaseOverride ? FARM_SKY_PHASE_LABELS[farmSkyPhaseOverride] : '自动';
  const sceneTimeLabel = effectiveTheme === 'A'
    ? FARM_SKY_PHASE_LABELS[farmSkyPhase]
    : effectiveTheme === 'B'
      ? '深海'
      : '创作时段';
  const sceneTimeBadgeClass = effectiveTheme === 'A'
    ? farmSkyPhase === 'day'
      ? (isDarkBackdrop ? 'border-amber-200/30 bg-amber-200/18 text-amber-100' : 'border-amber-200 bg-amber-100 text-amber-700')
      : farmSkyPhase === 'noon'
        ? (isDarkBackdrop ? 'border-yellow-200/30 bg-yellow-200/18 text-yellow-100' : 'border-yellow-200 bg-yellow-100 text-yellow-700')
      : farmSkyPhase === 'dusk'
        ? (isDarkBackdrop ? 'border-orange-200/30 bg-orange-200/18 text-orange-100' : 'border-orange-200 bg-orange-100 text-orange-700')
        : (isDarkBackdrop ? 'border-indigo-200/35 bg-indigo-200/20 text-indigo-100' : 'border-indigo-200 bg-indigo-100 text-indigo-700')
    : effectiveTheme === 'B'
      ? (isDarkBackdrop ? 'border-cyan-200/30 bg-cyan-200/16 text-cyan-100' : 'border-cyan-200 bg-cyan-100 text-cyan-700')
      : 'border-fuchsia-200 bg-fuchsia-100 text-fuchsia-700';
  const sceneTimeIcon = effectiveTheme === 'A'
    ? farmSkyPhase === 'day'
      ? <Sun size={11} />
      : farmSkyPhase === 'noon'
        ? <Sun size={11} />
      : farmSkyPhase === 'dusk'
        ? <Sunset size={11} />
        : <MoonStar size={11} />
    : effectiveTheme === 'B'
      ? <Waves size={11} />
      : <Palette size={11} />;
  const topInfoPillToneClass = isDarkBackdrop
    ? 'border border-white/16 bg-black/28 text-white/90'
    : 'border border-slate-200/70 bg-white/82 text-slate-600';
  const clearCardFeedTimers = useCallback(() => {
    if (cardFeedTickTimerRef.current !== null) {
      window.clearTimeout(cardFeedTickTimerRef.current);
      cardFeedTickTimerRef.current = null;
    }
    if (cardFeedCompleteTimerRef.current !== null) {
      window.clearTimeout(cardFeedCompleteTimerRef.current);
      cardFeedCompleteTimerRef.current = null;
    }
  }, []);
  const clearCardCheerTimers = useCallback(() => {
    if (cardCheerTickTimerRef.current !== null) {
      window.clearTimeout(cardCheerTickTimerRef.current);
      cardCheerTickTimerRef.current = null;
    }
    if (cardCheerCompleteTimerRef.current !== null) {
      window.clearTimeout(cardCheerCompleteTimerRef.current);
      cardCheerCompleteTimerRef.current = null;
    }
  }, []);
  const getFeedbackAnchor = useCallback((
    instanceId: string,
    preferredPoint: 'interaction' | 'feed' = 'interaction',
    fallback?: {x: number; y: number},
  ) => {
    const runtimePoints = runtimePetPointsRef.current.get(instanceId);
    if (runtimePoints) {
      if (typeof runtimePoints.bubbleX === 'number' && typeof runtimePoints.bubbleY === 'number') {
        return {x: runtimePoints.bubbleX, y: runtimePoints.bubbleY};
      }
      return preferredPoint === 'feed'
        ? {x: runtimePoints.feedX, y: runtimePoints.feedY}
        : {x: runtimePoints.interactionX, y: runtimePoints.interactionY};
    }

    if (fallback) return fallback;

    const pet = useStore.getState().completedPets.find((item) => item.instanceId === instanceId);
    if (pet) {
      return {
        x: pet.x,
        y: pet.y,
      };
    }

    return {x: 50, y: 50};
  }, []);
  const pushSceneFeedback = useCallback((
    instanceId: string,
    metrics: SceneFeedbackMetric[],
    options?: {
      preferredPoint?: 'interaction' | 'feed';
      anchor?: {x: number; y: number};
    },
  ) => {
    const filteredMetrics = metrics
      .map((metric) => ({
        ...metric,
        delta: Math.round(metric.delta * 10) / 10,
      }))
      .filter((metric) => metric.delta > 0);
    if (filteredMetrics.length === 0) return;

    const baseAnchor = getFeedbackAnchor(
      instanceId,
      options?.preferredPoint ?? 'interaction',
      options?.anchor,
    );
    const existingCount = sceneFeedbackItemsRef.current.filter((item) => item.instanceId === instanceId).length;
    const item: SceneFeedbackItem = {
      id: `scene-feedback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      instanceId,
      x: baseAnchor.x,
      y: baseAnchor.y - existingCount * 1.8,
      metrics: filteredMetrics,
    };

    setSceneFeedbackItems((previous) => {
      const next = [...previous.slice(-15), item];
      sceneFeedbackItemsRef.current = next;
      return next;
    });

    const timerId = window.setTimeout(() => {
      setSceneFeedbackItems((previous) => {
        const next = previous.filter((feedback) => feedback.id !== item.id);
        sceneFeedbackItemsRef.current = next;
        return next;
      });
      sceneFeedbackTimersRef.current = sceneFeedbackTimersRef.current.filter((timer) => timer !== timerId);
    }, SCENE_FEEDBACK_TTL_MS);
    sceneFeedbackTimersRef.current.push(timerId);
  }, [getFeedbackAnchor]);

  useEffect(() => {
    if (!selectedPetInstanceId) return;
    const exists = petsInTheme.some((pet) => pet.instanceId === selectedPetInstanceId);
    if (!exists) {
      setSelectedPetInstanceId(null);
    }
  }, [petsInTheme, selectedPetInstanceId]);
  useEffect(() => {
    if (effectiveTheme === 'A') return;
    setSceneToolDockOpen(false);
  }, [effectiveTheme]);
  useEffect(() => {
    if (farmSkyPhaseOverride !== null) return;

    let timerId: number | null = null;

    const syncCurrentHour = () => {
      setCurrentHour((previous) => {
        const nextHour = new Date().getHours();
        return previous === nextHour ? previous : nextHour;
      });
    };

    const scheduleNextSync = () => {
      const now = new Date();
      const nextHourTime = new Date(now);
      nextHourTime.setHours(now.getHours() + 1, 0, 0, 0);
      const delay = Math.max(1000, nextHourTime.getTime() - now.getTime() + 80);
      timerId = window.setTimeout(() => {
        syncCurrentHour();
        scheduleNextSync();
      }, delay);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      syncCurrentHour();
    };

    syncCurrentHour();
    scheduleNextSync();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [farmSkyPhaseOverride]);
  useEffect(() => {
    const previousVisual = farmVisualRef.current;
    const hasVisualChanged =
      previousVisual.backgroundPath !== farmBackgroundPath
      || previousVisual.skyPhase !== farmSkyPhase;
    farmVisualRef.current = {
      backgroundPath: farmBackgroundPath,
      skyPhase: farmSkyPhase,
    };

    if (effectiveTheme !== 'A') {
      if (farmVisualTimerRef.current !== null) {
        window.clearTimeout(farmVisualTimerRef.current);
        farmVisualTimerRef.current = null;
      }
      setFarmOutgoingBackgroundPath(null);
      setFarmOutgoingSkyPhase(null);
      return;
    }

    if (!hasVisualChanged) return;

    if (farmVisualTimerRef.current !== null) {
      window.clearTimeout(farmVisualTimerRef.current);
    }

    setFarmOutgoingBackgroundPath(previousVisual.backgroundPath);
    setFarmOutgoingSkyPhase(previousVisual.skyPhase);
    farmVisualTimerRef.current = window.setTimeout(() => {
      setFarmOutgoingBackgroundPath(null);
      setFarmOutgoingSkyPhase(null);
      farmVisualTimerRef.current = null;
    }, FARM_SCENE_TRANSITION_MS);
  }, [effectiveTheme, farmBackgroundPath, farmSkyPhase]);
  useEffect(() => {
    sceneFeedDropsRef.current = sceneFeedDrops;
  }, [sceneFeedDrops]);
  useEffect(() => {
    sceneWasteSpotsRef.current = sceneWasteSpots;
  }, [sceneWasteSpots]);
  useEffect(() => {
    toolDragStateRef.current = toolDragState;
  }, [toolDragState]);
  useEffect(() => {
    sceneFeedbackItemsRef.current = sceneFeedbackItems;
  }, [sceneFeedbackItems]);
  useEffect(() => {
    const nextPoints = new Map<string, RuntimePetPoints>();
    petsInTheme.forEach((pet) => {
      const existing = runtimePetPointsRef.current.get(pet.instanceId);
      nextPoints.set(
        pet.instanceId,
        existing ?? {
          interactionX: pet.x,
          interactionY: pet.y,
          bubbleX: pet.x,
          bubbleY: pet.y,
          feedX: pet.x,
          feedY: pet.y,
          feedLeftX: pet.x,
          feedLeftY: pet.y,
          feedRightX: pet.x,
          feedRightY: pet.y,
        },
      );
    });
    runtimePetPointsRef.current = nextPoints;
  }, [petsInTheme]);
  useEffect(() => {
    return () => {
      if (farmVisualTimerRef.current !== null) {
        window.clearTimeout(farmVisualTimerRef.current);
      }
      clearCardFeedTimers();
      clearCardCheerTimers();
      sceneFeedDropTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      sceneFeedDropTimersRef.current = [];
      sceneFeedbackTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      sceneFeedbackTimersRef.current = [];
      feedingPetIdsRef.current.clear();
      feedDropAssignmentsRef.current.clear();
      petFeedAssignmentsRef.current.clear();
      feedDropClaimRef.current.clear();
    };
  }, [clearCardCheerTimers, clearCardFeedTimers]);
  useEffect(() => {
    if (selectedPet && !isOceanLocked) {
      setCardPetSnapshot(selectedPet);
      const rafId = window.requestAnimationFrame(() => {
        setCardVisible(true);
      });
      return () => window.cancelAnimationFrame(rafId);
    }

    if (!cardPetSnapshot) return;
    setCardVisible(false);
    const timeoutId = window.setTimeout(() => {
      setCardPetSnapshot(null);
    }, CARD_TRANSITION_MS);
    return () => window.clearTimeout(timeoutId);
  }, [cardPetSnapshot, isOceanLocked, selectedPet]);
  useEffect(() => {
    if (!cardFeedSession) {
      clearCardFeedTimers();
      setCardFeedProgress(null);
      return;
    }

    clearCardFeedTimers();
    const {instanceId, startedAt, endsAt} = cardFeedSession;
    const totalMs = Math.max(1, endsAt - startedAt);
    const updateProgress = () => {
      setCardFeedProgress(clamp((Date.now() - startedAt) / totalMs, 0, 1));
    };

    updateProgress();

    const tick = () => {
      updateProgress();
      cardFeedTickTimerRef.current = window.setTimeout(tick, 60);
    };
    cardFeedTickTimerRef.current = window.setTimeout(tick, 60);

    cardFeedCompleteTimerRef.current = window.setTimeout(() => {
      const beforePet = useStore.getState().completedPets.find((pet) => pet.instanceId === instanceId);
      const fed = feedCompletedPet(instanceId);
      const afterPet = useStore.getState().completedPets.find((pet) => pet.instanceId === instanceId);
      if (fed && beforePet && afterPet) {
        pushSceneFeedback(
          instanceId,
          [
            {kind: 'satiety', delta: getPetMetric(afterPet, 'satiety') - getPetMetric(beforePet, 'satiety')},
            {kind: 'mood', delta: getPetMetric(afterPet, 'mood') - getPetMetric(beforePet, 'mood')},
          ],
          {preferredPoint: 'feed'},
        );
      }
      clearCardFeedTimers();
      setCardFeedProgress(null);
      setCardFeedSession((current) => (
        current?.instanceId === instanceId && current.startedAt === startedAt
          ? null
          : current
      ));
    }, Math.max(0, endsAt - Date.now()));

    return clearCardFeedTimers;
  }, [cardFeedSession, clearCardFeedTimers, feedCompletedPet, pushSceneFeedback]);
  useEffect(() => {
    if (!cardCheerSession) {
      clearCardCheerTimers();
      setCardCheerProgress(null);
      return;
    }

    clearCardCheerTimers();
    const {instanceId, startedAt, endsAt} = cardCheerSession;
    const totalMs = Math.max(1, endsAt - startedAt);
    const updateProgress = () => {
      setCardCheerProgress(clamp((Date.now() - startedAt) / totalMs, 0, 1));
    };

    updateProgress();

    const tick = () => {
      updateProgress();
      cardCheerTickTimerRef.current = window.setTimeout(tick, 60);
    };
    cardCheerTickTimerRef.current = window.setTimeout(tick, 60);

    cardCheerCompleteTimerRef.current = window.setTimeout(() => {
      const beforePet = useStore.getState().completedPets.find((pet) => pet.instanceId === instanceId);
      const cheered = cheerCompletedPet(instanceId);
      const afterPet = useStore.getState().completedPets.find((pet) => pet.instanceId === instanceId);
      if (cheered && beforePet && afterPet) {
        pushSceneFeedback(
          instanceId,
          [{kind: 'mood', delta: getPetMetric(afterPet, 'mood') - getPetMetric(beforePet, 'mood')}],
          {preferredPoint: 'interaction'},
        );
      }
      clearCardCheerTimers();
      setCardCheerProgress(null);
      setCardCheerSession((current) => (
        current?.instanceId === instanceId && current.startedAt === startedAt
          ? null
          : current
      ));
    }, Math.max(0, endsAt - Date.now()));

    return clearCardCheerTimers;
  }, [cardCheerSession, cheerCompletedPet, clearCardCheerTimers, pushSceneFeedback]);
  useEffect(() => {
    if (!cardFeedSession) return;
    const exists = completedPets.some((pet) => pet.instanceId === cardFeedSession.instanceId);
    if (exists) return;
    clearCardFeedTimers();
    setCardFeedSession(null);
    setCardFeedProgress(null);
  }, [cardFeedSession, clearCardFeedTimers, completedPets]);
  useEffect(() => {
    if (!cardCheerSession) return;
    const exists = completedPets.some((pet) => pet.instanceId === cardCheerSession.instanceId);
    if (exists) return;
    clearCardCheerTimers();
    setCardCheerSession(null);
    setCardCheerProgress(null);
  }, [cardCheerSession, clearCardCheerTimers, completedPets]);
  const isCardActionBusy = Boolean(cardFeedSession || cardCheerSession);
  const isSelectedPetCardFeeding = cardPet
    ? cardFeedSession?.instanceId === cardPet.instanceId
    : false;
  const isSelectedPetCardCheering = cardPet
    ? cardCheerSession?.instanceId === cardPet.instanceId
    : false;
  const selectedSpriteAction = cardPet
    ? (
      isSelectedPetCardFeeding && hasPetSpriteAction(cardPet.petId, 'feed')
        ? 'feed'
        : isSelectedPetCardCheering && hasPetSpriteAction(cardPet.petId, 'happy')
          ? 'happy'
        : resolveSceneCardAction(cardPet.petId, cardPet.state)
    )
    : 'idle';
  const cardHealth = cardPet ? getPetMetric(cardPet, 'health') : 0;
  const cardSatiety = cardPet ? getPetMetric(cardPet, 'satiety') : 0;
  const cardMood = cardPet ? getPetMetric(cardPet, 'mood') : 0;
  const isSelectedPetFull = cardSatiety >= FEED_BLOCK_SATIETY;
  const activeCardCheerAnchor = cardCheerSession
    ? getFeedbackAnchor(cardCheerSession.instanceId, 'interaction')
    : null;

  const queueSceneAction = (instanceId: string, action: ScenePetActionRequest['action']) => {
    setSceneActionRequest((previous) => ({
      instanceId,
      action,
      nonce: (previous?.nonce ?? 0) + 1,
    }));
  };
  const queueSceneFeedMoveRequest = (instanceId: string, drop: Pick<SceneFeedDrop, 'id' | 'x' | 'y'>) => {
    sceneFeedMoveNonceRef.current += 1;
    setSceneFeedMoveRequests((previous) => ({
      ...previous,
      [instanceId]: {
        instanceId,
        dropId: drop.id,
        x: drop.x,
        y: drop.y,
        nonce: sceneFeedMoveNonceRef.current,
      },
    }));
  };
  const handleRuntimePetPointChange = useCallback((
    instanceId: string,
    points: RuntimePetPoints,
  ) => {
    runtimePetPointsRef.current.set(instanceId, points);
  }, []);
  const triggerCardCheer = useCallback((pet: CompletedPet | null) => {
    if (!pet) return false;
    if (cardFeedSession || cardCheerSession) return false;

    const startedAt = Date.now();
    queueSceneAction(pet.instanceId, 'happy');
    setCardCheerProgress(0);
    setCardCheerSession({
      instanceId: pet.instanceId,
      startedAt,
      endsAt: startedAt + CARD_DIRECT_CHEER_MS,
    });
    return true;
  }, [cardCheerSession, cardFeedSession]);
  const clearSceneFeedMoveRequests = (instanceIds: string[]) => {
    if (instanceIds.length === 0) return;
    setSceneFeedMoveRequests((previous) => {
      let changed = false;
      const next = {...previous};
      instanceIds.forEach((instanceId) => {
        if (!next[instanceId]) return;
        delete next[instanceId];
        changed = true;
      });
      return changed ? next : previous;
    });
  };

  const handlePetSelect = (pet: CompletedPet) => {
    setSelectedPetInstanceId(pet.instanceId);
    setSceneToolDockOpen(false);
    triggerCardCheer(pet);
  };

  const releasePetFeedAssignment = (instanceId: string) => {
    const assignedDropId = petFeedAssignmentsRef.current.get(instanceId);
    if (assignedDropId) {
      petFeedAssignmentsRef.current.delete(instanceId);
      if (feedDropAssignmentsRef.current.get(assignedDropId) === instanceId) {
        feedDropAssignmentsRef.current.delete(assignedDropId);
      }
      if (feedDropClaimRef.current.get(assignedDropId) === instanceId) {
        feedDropClaimRef.current.delete(assignedDropId);
      }
    }
    feedingPetIdsRef.current.delete(instanceId);
    clearSceneFeedMoveRequests([instanceId]);
  };

  const releaseDropFeedAssignment = (dropId: string) => {
    const assignedInstanceId = feedDropAssignmentsRef.current.get(dropId);
    feedDropAssignmentsRef.current.delete(dropId);
    if (assignedInstanceId) {
      if (petFeedAssignmentsRef.current.get(assignedInstanceId) === dropId) {
        petFeedAssignmentsRef.current.delete(assignedInstanceId);
      }
      feedingPetIdsRef.current.delete(assignedInstanceId);
      clearSceneFeedMoveRequests([assignedInstanceId]);
    }
    if (feedDropClaimRef.current.get(dropId) === assignedInstanceId) {
      feedDropClaimRef.current.delete(dropId);
    }
  };

  const spawnFeedDrop = (x: number, y: number, ttlMs = FEED_DROP_TTL_MS) => {
    const dropId = `feed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const createdAt = Date.now();
    return {
      id: dropId,
      x,
      y,
      createdAt,
      ttlMs,
    } satisfies SceneFeedDrop;
  };
  const commitFeedDrops = useCallback((drops: SceneFeedDrop[]) => {
    if (drops.length === 0) return [];

    const now = Date.now();
    const retainedDrops = sceneFeedDropsRef.current.filter((item) => now - item.createdAt < item.ttlMs);
    const appendedDrops = [...retainedDrops, ...drops];
    const nextDrops = appendedDrops.slice(-8);
    const droppedIds = appendedDrops
      .slice(0, Math.max(0, appendedDrops.length - nextDrops.length))
      .map((drop) => drop.id);

    droppedIds.forEach((dropId) => {
      releaseDropFeedAssignment(dropId);
    });

    sceneFeedDropsRef.current = nextDrops;
    setSceneFeedDrops(nextDrops);

    drops.forEach((drop) => {
      const removeFeedDropTimer = window.setTimeout(() => {
        const nextDropsAfterRemoval = sceneFeedDropsRef.current.filter((item) => item.id !== drop.id);
        sceneFeedDropsRef.current = nextDropsAfterRemoval;
        setSceneFeedDrops(nextDropsAfterRemoval);
        releaseDropFeedAssignment(drop.id);
        sceneFeedDropTimersRef.current = sceneFeedDropTimersRef.current.filter((timer) => timer !== removeFeedDropTimer);
      }, drop.ttlMs);
      sceneFeedDropTimersRef.current.push(removeFeedDropTimer);
    });

    return nextDrops;
  }, []);
  const spawnFeedBurst = useCallback((x: number, y: number, ttlMs = FEED_DROP_TTL_MS) => {
    const spreadOffsets = [
      {x: -2.3, y: 0.4},
      {x: 0, y: -0.45},
      {x: 2.3, y: 0.3},
    ].slice(0, FEED_DROP_BURST_COUNT);
    const burstDrops = spreadOffsets.map((offset, index) => {
      const jitterX = (Math.random() - 0.5) * 0.7;
      const jitterY = (Math.random() - 0.5) * 0.45;
      return spawnFeedDrop(
        clamp(x + offset.x + jitterX, SCENE_X_MIN + 1.2, SCENE_X_MAX - 1.2),
        clamp(y + offset.y + jitterY + index * 0.03, SCENE_BOTTOM_MIN + 1, SCENE_BOTTOM_MAX + 2.5),
        ttlMs,
      );
    });
    return commitFeedDrops(burstDrops);
  }, [commitFeedDrops]);

  const reserveFeedForPet = (instanceId: string, drop: Pick<SceneFeedDrop, 'id' | 'x' | 'y'>) => {
    if (feedDropAssignmentsRef.current.has(drop.id)) return false;
    if (feedingPetIdsRef.current.has(instanceId) || petFeedAssignmentsRef.current.has(instanceId)) return false;

    feedDropAssignmentsRef.current.set(drop.id, instanceId);
    petFeedAssignmentsRef.current.set(instanceId, drop.id);
    feedingPetIdsRef.current.add(instanceId);
    queueSceneFeedMoveRequest(instanceId, drop);
    return true;
  };
  const assignPendingFeedDrops = useCallback((drops = sceneFeedDropsRef.current) => {
    if (drops.length === 0) return;

    const unassignedDrops = drops.filter((drop) => !feedDropAssignmentsRef.current.has(drop.id));
    if (unassignedDrops.length === 0) return;

    const availablePets = petsInTheme
      .map((pet) => ({
        pet,
        satiety: getPetMetric(pet, 'satiety'),
        runtimePoints: runtimePetPointsRef.current.get(pet.instanceId) ?? {
          interactionX: pet.x,
          interactionY: pet.y,
          bubbleX: pet.x,
          bubbleY: pet.y,
          feedX: pet.x,
          feedY: pet.y,
          feedLeftX: pet.x,
          feedLeftY: pet.y,
          feedRightX: pet.x,
          feedRightY: pet.y,
        },
      }))
      .filter((item) => item.satiety < FEED_BLOCK_SATIETY)
      .filter((item) => !feedingPetIdsRef.current.has(item.pet.instanceId));
    if (availablePets.length === 0) return;

    const assignments = assignFeedTargets(
      unassignedDrops.map((drop) => ({
        id: drop.id,
        x: drop.x,
        y: drop.y,
        createdAt: drop.createdAt,
      })),
      availablePets.map((item) => ({
        instanceId: item.pet.instanceId,
        points: {
          judgeX: item.runtimePoints.interactionX,
          judgeY: item.runtimePoints.interactionY,
        },
      })),
    );
    if (assignments.length === 0) return;

    const dropMap = new Map<string, SceneFeedDrop>(
      unassignedDrops.map((drop) => [drop.id, drop] as const),
    );
    assignments.forEach((assignment) => {
      const drop = dropMap.get(assignment.dropId);
      if (!drop) return;
      reserveFeedForPet(assignment.instanceId, drop);
    });
  }, [petsInTheme]);
  const getSceneToolPlacement = useCallback((clientX: number, clientY: number) => {
    const sceneElement = sceneSurfaceRef.current;
    if (!sceneElement) {
      return {
        overScene: false,
        sceneX: null,
        sceneY: null,
      };
    }

    const rect = sceneElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return {
        overScene: false,
        sceneX: null,
        sceneY: null,
      };
    }

    const overScene =
      clientX >= rect.left
      && clientX <= rect.right
      && clientY >= rect.top
      && clientY <= rect.bottom;

    if (!overScene) {
      return {
        overScene: false,
        sceneX: null,
        sceneY: null,
      };
    }

    const rawSceneX = ((clientX - rect.left) / rect.width) * 100;
    const rawSceneY = ((clientY - rect.top) / rect.height) * 100;
    return {
      overScene: true,
      sceneX: clamp(rawSceneX, SCENE_X_MIN + 1.5, SCENE_X_MAX - 1.5),
      sceneY: clamp(rawSceneY, SCENE_BOTTOM_MIN + 1.2, SCENE_BOTTOM_MAX + 2.5),
    };
  }, []);
  const getSceneClientPoint = useCallback((sceneX: number, sceneY: number) => {
    const sceneElement = sceneSurfaceRef.current;
    if (!sceneElement) return null;
    const rect = sceneElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: rect.left + (sceneX / 100) * rect.width,
      y: rect.top + (sceneY / 100) * rect.height,
    };
  }, []);
  const findHoveredWasteInstanceId = useCallback((clientX: number, clientY: number) => {
    const sceneElement = sceneSurfaceRef.current;
    if (!sceneElement) return null;
    const rect = sceneElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const snapRadius = Math.max(28, Math.min(54, rect.width * 0.055));
    let matchedInstanceId: string | null = null;
    let matchedDistance = Number.POSITIVE_INFINITY;

    sceneWasteSpotsRef.current.forEach((spot) => {
      const spotClientX = rect.left + (spot.x / 100) * rect.width;
      const spotClientY = rect.top + (spot.y / 100) * rect.height;
      const distance = Math.hypot(clientX - spotClientX, clientY - spotClientY);
      if (distance > snapRadius || distance >= matchedDistance) return;
      matchedDistance = distance;
      matchedInstanceId = spot.instanceId;
    });

    return matchedInstanceId;
  }, []);
  const isPointerInsideSceneToolDock = useCallback((clientX: number, clientY: number) => {
    const dockElement = sceneToolDockRef.current;
    if (!dockElement) return false;
    const rect = dockElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;

    return (
      clientX >= rect.left
      && clientX <= rect.right
      && clientY >= rect.top
      && clientY <= rect.bottom
    );
  }, []);
  const buildSceneToolDragState = useCallback((
    tool: SceneToolType,
    pointerId: number,
    clientX: number,
    clientY: number,
  ): SceneToolDragState => {
    const placement = getSceneToolPlacement(clientX, clientY);
    return {
      tool,
      pointerId,
      clientX,
      clientY,
      overDock: isPointerInsideSceneToolDock(clientX, clientY),
      overScene: placement.overScene,
      sceneX: placement.sceneX,
      sceneY: placement.sceneY,
      hoveredWasteInstanceId: tool === 'clean' ? findHoveredWasteInstanceId(clientX, clientY) : null,
    };
  }, [findHoveredWasteInstanceId, getSceneToolPlacement, isPointerInsideSceneToolDock]);
  const finishSceneToolDrag = useCallback((dragState: SceneToolDragState) => {
    if (dragState.tool === 'feed' && effectiveTheme === 'A' && dragState.overScene && dragState.sceneX !== null && dragState.sceneY !== null) {
      const nextDrops = spawnFeedBurst(dragState.sceneX, dragState.sceneY);
      assignPendingFeedDrops(nextDrops);
      return;
    }

    if (dragState.tool === 'clean' && dragState.hoveredWasteInstanceId) {
      cleanCompletedPetWaste(dragState.hoveredWasteInstanceId);
    }
  }, [assignPendingFeedDrops, cleanCompletedPetWaste, effectiveTheme, spawnFeedBurst]);
  const handleSceneToolCardPointerDown = useCallback((tool: SceneToolType) => (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    if (tool === 'feed' && effectiveTheme !== 'A') return;
    if (tool === 'clean' && sceneWasteTotal <= 0) return;

    event.preventDefault();
    event.stopPropagation();
    setSelectedPetInstanceId(null);
    setToolDragState(buildSceneToolDragState(tool, event.pointerId, event.clientX, event.clientY));
  }, [buildSceneToolDragState, effectiveTheme, sceneWasteTotal]);

  const handleFeedSelectedPet = () => {
    if (!cardPet) return;
    if (cardSatiety >= FEED_BLOCK_SATIETY) return;
    if (cardCheerSession) return;
    if (cardFeedSession?.instanceId === cardPet.instanceId) return;
    if (feedingPetIdsRef.current.has(cardPet.instanceId)) return;

    const startedAt = Date.now();
    queueSceneAction(cardPet.instanceId, 'feed');
    setCardFeedProgress(0);
    setCardFeedSession({
      instanceId: cardPet.instanceId,
      startedAt,
      endsAt: startedAt + CARD_DIRECT_FEED_MS,
    });
  };
  const handleCheerSelectedPet = () => {
    if (!cardPet) return;
    triggerCardCheer(cardPet);
  };
  useEffect(() => {
    if (!isSceneToolDragging) return;

    const handlePointerMove = (event: PointerEvent) => {
      const currentDragState = toolDragStateRef.current;
      if (!currentDragState || event.pointerId !== currentDragState.pointerId) return;
      event.preventDefault();
      setToolDragState(buildSceneToolDragState(currentDragState.tool, event.pointerId, event.clientX, event.clientY));
    };
    const handlePointerUp = (event: PointerEvent) => {
      const currentDragState = toolDragStateRef.current;
      if (!currentDragState || event.pointerId !== currentDragState.pointerId) return;
      event.preventDefault();
      const nextDragState = buildSceneToolDragState(currentDragState.tool, event.pointerId, event.clientX, event.clientY);
      if (nextDragState.overDock) {
        setToolDragState(null);
        return;
      }
      finishSceneToolDrag(nextDragState);
      setToolDragState(null);
    };
    const handlePointerCancel = (event: PointerEvent) => {
      const currentDragState = toolDragStateRef.current;
      if (!currentDragState || event.pointerId !== currentDragState.pointerId) return;
      event.preventDefault();
      setToolDragState(null);
    };

    window.addEventListener('pointermove', handlePointerMove, {passive: false});
    window.addEventListener('pointerup', handlePointerUp, {passive: false});
    window.addEventListener('pointercancel', handlePointerCancel, {passive: false});
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [buildSceneToolDragState, finishSceneToolDrag, isSceneToolDragging]);
  const handlePetFeedStarted = ({instanceId, dropId}: {instanceId: string; dropId: string}) => {
    const assignedDropId = petFeedAssignmentsRef.current.get(instanceId);
    const assignedPetId = feedDropAssignmentsRef.current.get(dropId);
    if (assignedDropId !== dropId || assignedPetId !== instanceId) {
      releasePetFeedAssignment(instanceId);
      assignPendingFeedDrops();
      return false;
    }

    const currentClaimOwner = feedDropClaimRef.current.get(dropId);
    if (currentClaimOwner && currentClaimOwner !== instanceId) {
      releasePetFeedAssignment(instanceId);
      assignPendingFeedDrops();
      return false;
    }

    feedDropClaimRef.current.set(dropId, instanceId);
    return true;
  };

  useEffect(() => {
    if (effectiveTheme !== 'A') return;
    assignPendingFeedDrops(sceneFeedDrops);
  }, [assignPendingFeedDrops, effectiveTheme, sceneFeedDrops]);
  useEffect(() => {
    if (!toolDragState) return;
    if (toolDragState.tool === 'feed' && effectiveTheme !== 'A') {
      setToolDragState(null);
      return;
    }
    if (toolDragState.tool === 'clean' && sceneWasteTotal <= 0) {
      setToolDragState(null);
    }
  }, [effectiveTheme, sceneWasteTotal, toolDragState]);

  const handlePetFeedArrived = ({instanceId, dropId, x, y}: {instanceId: string; dropId: string; x: number; y: number}) => {
    const assignedDropId = petFeedAssignmentsRef.current.get(instanceId);
    const assignedPetId = feedDropAssignmentsRef.current.get(dropId);
    if (assignedDropId !== dropId || assignedPetId !== instanceId) {
      releasePetFeedAssignment(instanceId);
      assignPendingFeedDrops();
      return;
    }

    const currentDrop = sceneFeedDropsRef.current.find((item) => item.id === dropId);
    if (!currentDrop) {
      releasePetFeedAssignment(instanceId);
      assignPendingFeedDrops();
      return;
    }

    const claimOwner = feedDropClaimRef.current.get(dropId);
    if (claimOwner && claimOwner !== instanceId) {
      releasePetFeedAssignment(instanceId);
      assignPendingFeedDrops();
      return;
    }

    const beforePet = useStore.getState().completedPets.find((pet) => pet.instanceId === instanceId);
    const fed = feedCompletedPet(instanceId);
    const afterPet = useStore.getState().completedPets.find((pet) => pet.instanceId === instanceId);
    releasePetFeedAssignment(instanceId);
    if (feedDropClaimRef.current.get(dropId) === instanceId) {
      feedDropClaimRef.current.delete(dropId);
    }
    if (!fed) {
      assignPendingFeedDrops();
      return;
    }
    if (beforePet && afterPet) {
      pushSceneFeedback(
        instanceId,
        [
          {kind: 'satiety', delta: getPetMetric(afterPet, 'satiety') - getPetMetric(beforePet, 'satiety')},
          {kind: 'mood', delta: getPetMetric(afterPet, 'mood') - getPetMetric(beforePet, 'mood')},
        ],
        {preferredPoint: 'feed', anchor: {x, y}},
      );
    }

    const nextDropsAfterEat = sceneFeedDropsRef.current.filter((drop) => drop.id !== dropId);
    sceneFeedDropsRef.current = nextDropsAfterEat;
    setSceneFeedDrops(nextDropsAfterEat);
    assignPendingFeedDrops(nextDropsAfterEat);
  };
  const handlePetFeedChaseFailed = ({instanceId, dropId}: {instanceId: string; dropId: string}) => {
    const assignedDropId = petFeedAssignmentsRef.current.get(instanceId);
    if (assignedDropId !== dropId) return;
    releasePetFeedAssignment(instanceId);
    if (feedDropClaimRef.current.get(dropId) === instanceId) {
      feedDropClaimRef.current.delete(dropId);
    }
    const dropStillExists = sceneFeedDropsRef.current.some((drop) => drop.id === dropId);
    if (!dropStillExists) return;
    assignPendingFeedDrops();
  };

  const formatFeedbackDelta = (value: number) => {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
  };
  const getFeedbackMetricMeta = (kind: SceneFeedbackMetricKind) => {
    if (kind === 'satiety') {
      return {
        icon: '🌾',
        label: '饱食',
        secondaryTone: isDarkBackdrop ? 'text-amber-100/78' : 'text-amber-700/78',
      };
    }

    return {
      icon: '💗',
      label: '心情',
      secondaryTone: isDarkBackdrop ? 'text-rose-100/78' : 'text-rose-700/78',
    };
  };
  const toolDragPreviewPoint = toolDragState?.overScene && toolDragState.sceneX !== null && toolDragState.sceneY !== null
    ? getSceneClientPoint(toolDragState.sceneX, toolDragState.sceneY)
    : null;
  const activeHoveredWaste = toolDragState?.hoveredWasteInstanceId
    ? sceneWasteSpots.find((spot) => spot.instanceId === toolDragState.hoveredWasteInstanceId) ?? null
    : null;
  const hoveredWastePreviewPoint = activeHoveredWaste
    ? getSceneClientPoint(activeHoveredWaste.x, activeHoveredWaste.y)
    : null;
  const isSceneToolCancelHover = toolDragState?.overDock ?? false;

  return (
    <div
      className={cn(
        'relative isolate h-full min-h-0 flex-1 flex flex-col overflow-hidden transition-colors duration-150',
        getThemeBackground(),
      )}>
      {effectiveTheme === 'A' && (
        <>
          <div
            className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
            <div
              className="absolute inset-0 bg-no-repeat"
              style={{
                backgroundImage: `url(${farmBackgroundPath})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center bottom',
                imageRendering: 'pixelated',
              }}
            />
            {farmOutgoingBackgroundPath && (
              <div
                className="scene-fade-out absolute inset-0 bg-no-repeat"
                style={{
                  backgroundImage: `url(${farmOutgoingBackgroundPath})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center bottom',
                  imageRendering: 'pixelated',
                }}
              />
            )}
          </div>
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
            <div className={cn('absolute inset-0 transition-colors duration-300', getFarmSkyOverlayClass(farmSkyPhase))} />
            {farmOutgoingSkyPhase && (
              <div className={cn('scene-fade-out absolute inset-0', getFarmSkyOverlayClass(farmOutgoingSkyPhase))} />
            )}
          </div>
        </>
      )}

      <div className="absolute inset-x-0 top-0 z-20 pointer-events-none px-3 pt-2">
        <div className="pointer-events-auto">
          <div className="flex max-w-full items-center gap-1.5">
            <div
              className={cn(
                'inline-flex h-7 shrink-0 items-center gap-2 rounded-full px-3 text-[10px] font-semibold leading-none transition-colors duration-300',
                sceneTimeBadgeClass,
              )}>
              {sceneTimeIcon}
              <span className="truncate">{sceneTimeLabel}</span>
            </div>

            <div
              className={cn(
                'inline-flex h-7 min-w-0 max-w-[68%] items-center rounded-full px-3 text-[10px] font-semibold leading-none',
                topInfoPillToneClass,
              )}>
              <span className="truncate">{today} · {currentThemeLabel} · {petsInTheme.length}只</span>
            </div>
          </div>

          <div className="mt-1.5 flex items-center gap-2">
            <div
              className={cn(
                'inline-flex h-9 shrink-0 items-center gap-1 rounded-xl p-1 backdrop-blur-md',
                isDarkBackdrop
                  ? 'border border-white/12 bg-black/26'
                  : 'border border-slate-200/70 bg-white/78',
              )}>
              {SCENE_TABS.map((tab) => {
                const active = effectiveTheme === tab.theme;
                return (
                  <button
                    key={tab.theme}
                    onClick={() => handleSwitchTheme(tab.theme, tab.locked)}
                    disabled={tab.locked}
                    className={cn(
                      'inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition-all',
                      isDarkBackdrop &&
                        (active
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-white/85 hover:bg-white/10'),
                      !isDarkBackdrop &&
                        (active
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100/85'),
                      tab.locked &&
                        (isDarkBackdrop
                          ? 'cursor-not-allowed text-white/40 hover:bg-transparent'
                          : 'cursor-not-allowed text-slate-300 hover:bg-transparent'),
                    )}>
                    {tab.locked ? <Lock size={12} /> : getThemeIcon(tab.theme)}
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setShowPetBoard(true)}
              className={cn(
                'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-[11px] font-semibold transition-all',
                isDarkBackdrop
                  ? 'border-white/18 bg-black/28 text-white/95 hover:bg-black/34'
                  : 'border-slate-200 bg-white/88 text-slate-700 hover:bg-white',
              )}
              title="宠物库">
              <Archive size={14} />
              <span>宠物库</span>
            </button>
          </div>
        </div>

        {effectiveTheme === 'A' && (
          <div className="pointer-events-auto mt-1.5 flex flex-nowrap gap-1.5 overflow-x-auto pb-0.5">
            <button
              onClick={handleCycleFarmSkyPhase}
              className={cn(
                'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[10px] font-bold transition-all active:scale-[0.98]',
                isDarkBackdrop
                  ? 'border-white/18 bg-black/28 text-white hover:bg-black/34'
                  : 'border-slate-200 bg-white/90 text-slate-700 hover:bg-white',
              )}>
              <Sparkles size={12} />
              时间测试：{farmSkyPhaseText}
            </button>
            <button
              onClick={spawnAllScenePets}
              className={cn(
                'inline-flex h-7 shrink-0 items-center rounded-lg border px-2.5 text-[10px] font-bold transition-all active:scale-[0.98]',
                isDarkBackdrop
                  ? 'border-white/18 bg-black/28 text-white hover:bg-black/34'
                  : 'border-slate-200 bg-white/90 text-slate-700 hover:bg-white',
              )}>
              一键全宠
            </button>
            <button
              onClick={clearScenePets}
              className={cn(
                'inline-flex h-7 shrink-0 items-center rounded-lg border px-2.5 text-[10px] font-bold transition-all active:scale-[0.98]',
                isDarkBackdrop
                  ? 'border-rose-200/30 bg-rose-300/10 text-rose-100 hover:bg-rose-300/15'
                  : 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100',
              )}>
                清空场景
              </button>
            </div>
        )}
      </div>

      <div className="relative flex-1 overflow-visible pb-24">
        {effectiveTheme === 'custom' && (
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage: 'radial-gradient(#4f46e5 2px, transparent 2px)',
              backgroundSize: '30px 30px',
            }}
          />
        )}

        {isOceanLocked ? (
          <div className="absolute inset-0 flex items-center justify-center px-5">
            <div className="w-full max-w-sm rounded-[28px] border border-white/20 bg-white/12 p-6 text-center text-white backdrop-blur-md">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
                <Lock size={22} />
              </div>
              <p className="text-sm font-black">深海场景开发中</p>
              <p className="mt-1 text-xs text-white/70">当前已锁定，先在农场养成更多动物。</p>
              <button
                onClick={() => setCurrentTheme('A')}
                className="mt-4 inline-flex h-10 items-center justify-center rounded-2xl bg-white px-4 text-xs font-black text-slate-800 transition-all active:scale-[0.98]">
                回到农场
              </button>
            </div>
          </div>
        ) : (
          <div className="absolute -left-[7%] -right-[7%] -top-[15%] -bottom-[25%]">
            <PetScene
              isDarkBackdrop={isDarkBackdrop}
              sceneSurfaceRef={sceneSurfaceRef}
              onWasteSpotsChange={setSceneWasteSpots}
              highlightedWasteInstanceId={toolDragState?.tool === 'clean' ? toolDragState.hoveredWasteInstanceId : null}
              onPetSelect={isSceneToolDragging ? undefined : handlePetSelect}
              onSceneBlankClick={() => {
                setSelectedPetInstanceId(null);
                setSceneToolDockOpen(false);
              }}
              onRuntimePetPointChange={handleRuntimePetPointChange}
              actionRequest={sceneActionRequest}
              onPetFeedStarted={handlePetFeedStarted}
              onPetFeedArrived={handlePetFeedArrived}
              onPetFeedChaseFailed={handlePetFeedChaseFailed}
              feedDrops={sceneFeedDrops}
              feedMoveRequests={sceneFeedMoveRequests}
              debugHitArea={SCENE_DEBUG_HIT_AREAS}
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 bottom-24 z-[4200]">
              {cardCheerSession && activeCardCheerAnchor && cardCheerProgress !== null && (
                <div
                  className="absolute"
                  style={{
                    left: `${activeCardCheerAnchor.x}%`,
                    top: `${activeCardCheerAnchor.y}%`,
                    transform: 'translate(-50%, -120%)',
                  }}>
                  <div
                    className={cn(
                      'h-1.5 w-11 overflow-hidden rounded-full border shadow-[0_3px_8px_rgba(15,23,42,0.14)] backdrop-blur-sm',
                      isDarkBackdrop ? 'border-white/15 bg-white/15' : 'border-slate-200/90 bg-slate-200/95',
                    )}>
                    <div
                      className={cn(
                        'h-full rounded-full transition-[width] duration-75',
                        isDarkBackdrop ? 'bg-violet-300' : 'bg-violet-500',
                      )}
                      style={{width: `${Math.round(cardCheerProgress * 100)}%`}}
                    />
                  </div>
                </div>
              )}
              {sceneFeedbackItems.map((feedback) => {
                const [primaryMetric, secondaryMetric] = feedback.metrics;
                if (!primaryMetric) return null;
                const primaryMeta = getFeedbackMetricMeta(primaryMetric.kind);
                const secondaryMeta = secondaryMetric ? getFeedbackMetricMeta(secondaryMetric.kind) : null;

                return (
                  <div
                    key={feedback.id}
                    className="scene-feedback-bubble absolute"
                    style={{
                      left: `${feedback.x}%`,
                      top: `${feedback.y}%`,
                    }}>
                    <div
                      className={cn(
                        'relative min-w-[78px] rounded-2xl border px-2.5 py-1.5 shadow-[0_5px_12px_rgba(15,23,42,0.14)] backdrop-blur-[6px]',
                        isDarkBackdrop
                          ? 'border-white/12 bg-black/28'
                          : 'border-white/80 bg-white/84',
                      )}>
                      <div
                        className={cn(
                          'flex items-center gap-1 text-[10px] font-black leading-none',
                          isDarkBackdrop ? 'text-white' : 'text-slate-700',
                        )}>
                        <span className="text-[10px] leading-none">{primaryMeta.icon}</span>
                        <span>{primaryMeta.label} +{formatFeedbackDelta(primaryMetric.delta)}</span>
                      </div>
                      {secondaryMetric && secondaryMeta && (
                        <div className={cn('mt-1 flex items-center gap-1 text-[9px] font-bold leading-none', secondaryMeta.secondaryTone)}>
                          <span className="text-[9px] leading-none">{secondaryMeta.icon}</span>
                          <span>{secondaryMeta.label} +{formatFeedbackDelta(secondaryMetric.delta)}</span>
                        </div>
                      )}
                      <span
                        className={cn(
                          'absolute left-1/2 top-full h-2.5 w-2.5 -translate-x-1/2 -translate-y-[45%] rotate-45 border-r border-b',
                          isDarkBackdrop
                            ? 'border-white/12 bg-black/28'
                            : 'border-white/80 bg-white/84',
                        )}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {effectiveTheme === 'A' && (
        <div ref={sceneToolDockRef} className="pointer-events-none absolute bottom-24 left-0.5 z-[4850]">
          <div
            className={cn(
              'relative flex items-center transition-transform duration-150',
              isSceneToolCancelHover ? 'scale-[1.02]' : '',
            )}>
            <div
              className={cn(
                'overflow-hidden transition-[width,opacity] duration-220 ease-out',
                isSceneToolDockExpanded ? 'w-[78px] opacity-100' : 'w-0 opacity-0',
              )}>
              <div className="pointer-events-auto flex w-[78px] flex-col gap-1.5">
                <button
                  type="button"
                  onPointerDown={handleSceneToolCardPointerDown('feed')}
                  className={cn(
                    'group relative inline-flex h-11 w-[78px] items-center justify-center gap-1.5 rounded-[20px] border px-2.5 text-[11px] font-black shadow-[0_6px_18px_rgba(15,23,42,0.07)] transition-all active:scale-[0.98] touch-none',
                    isSceneToolCancelHover
                      ? (isDarkBackdrop
                        ? 'border-rose-200/70 bg-rose-300/20 text-rose-50 shadow-[0_12px_28px_rgba(251,113,133,0.18)]'
                        : 'border-rose-200 bg-rose-50 text-rose-700 shadow-[0_12px_24px_rgba(251,113,133,0.14)]')
                      : toolDragState?.tool === 'feed'
                      ? (isDarkBackdrop
                        ? 'border-amber-200/65 bg-amber-300/24 text-amber-50 shadow-[0_12px_28px_rgba(251,191,36,0.22)]'
                        : 'border-amber-200 bg-amber-100 text-amber-900 shadow-[0_12px_24px_rgba(245,158,11,0.18)]')
                      : (isDarkBackdrop
                        ? 'border-white/8 bg-black/10 text-white/58 hover:bg-black/14'
                        : 'border-white/55 bg-white/56 text-slate-600 hover:bg-white/70'),
                  )}>
                  <span
                    className={cn(
                      'inline-flex h-6 w-6 items-center justify-center rounded-full border text-[13px] shadow-sm transition-transform duration-150 group-active:scale-95',
                      isSceneToolCancelHover
                        ? (isDarkBackdrop
                          ? 'border-rose-200/45 bg-rose-200/20 text-rose-50'
                          : 'border-rose-200 bg-white/92 text-rose-500')
                        : toolDragState?.tool === 'feed'
                        ? (isDarkBackdrop
                          ? 'border-amber-200/45 bg-amber-200/20'
                          : 'border-amber-200 bg-white/92')
                        : (isDarkBackdrop
                          ? 'border-white/8 bg-white/6 text-white/72'
                          : 'border-white/72 bg-white/70 text-slate-500'),
                    )}>
                    <Wheat size={12} strokeWidth={2.4} />
                  </span>
                  <span className={cn(isSceneToolCancelHover ? 'opacity-100' : toolDragState?.tool === 'feed' ? '' : 'opacity-78')}>
                    {isSceneToolCancelHover ? '取消' : '投喂'}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={sceneWasteTotal <= 0}
                  onPointerDown={handleSceneToolCardPointerDown('clean')}
                  className={cn(
                    'group relative inline-flex h-11 w-[78px] items-center justify-center gap-1.5 rounded-[20px] border px-2.5 text-[11px] font-black shadow-[0_6px_18px_rgba(15,23,42,0.07)] transition-all active:scale-[0.98] touch-none',
                    isSceneToolCancelHover
                      ? (isDarkBackdrop
                        ? 'border-rose-200/70 bg-rose-300/20 text-rose-50 shadow-[0_12px_28px_rgba(251,113,133,0.18)]'
                        : 'border-rose-200 bg-rose-50 text-rose-700 shadow-[0_12px_24px_rgba(251,113,133,0.14)]')
                      : '',
                    sceneWasteTotal <= 0 &&
                      (isDarkBackdrop
                        ? 'cursor-not-allowed border-white/10 bg-white/6 text-white/38 shadow-none'
                        : 'cursor-not-allowed border-slate-200/80 bg-slate-100/88 text-slate-400 shadow-none'),
                    !isSceneToolCancelHover && sceneWasteTotal > 0 && toolDragState?.tool === 'clean'
                      ? (isDarkBackdrop
                        ? 'border-emerald-200/65 bg-emerald-300/24 text-emerald-50 shadow-[0_12px_28px_rgba(52,211,153,0.2)]'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-900 shadow-[0_12px_24px_rgba(16,185,129,0.16)]')
                      : !isSceneToolCancelHover && sceneWasteTotal > 0
                        ? (isDarkBackdrop
                          ? 'border-white/8 bg-black/10 text-white/58 hover:bg-black/14'
                          : 'border-white/55 bg-white/56 text-slate-600 hover:bg-white/70')
                        : '',
                  )}>
                  <span
                    className={cn(
                      'inline-flex h-6 w-6 items-center justify-center rounded-full border text-[13px] shadow-sm transition-transform duration-150 group-active:scale-95',
                      isSceneToolCancelHover
                        ? (isDarkBackdrop
                          ? 'border-rose-200/45 bg-rose-200/20 text-rose-50'
                          : 'border-rose-200 bg-white/92 text-rose-500')
                        : sceneWasteTotal > 0 && toolDragState?.tool === 'clean'
                        ? (isDarkBackdrop
                          ? 'border-emerald-200/45 bg-emerald-200/20'
                          : 'border-emerald-200 bg-white/92')
                        : (isDarkBackdrop
                          ? 'border-white/8 bg-white/6 text-white/72'
                          : 'border-white/72 bg-white/70 text-slate-500'),
                    )}>
                    <Sparkles size={12} strokeWidth={2.3} />
                  </span>
                  <span className={cn(isSceneToolCancelHover ? 'opacity-100' : sceneWasteTotal > 0 && toolDragState?.tool === 'clean' ? '' : 'opacity-78')}>
                    {isSceneToolCancelHover ? '取消' : '清理'}
                  </span>
                  {sceneWasteTotal > 0 && (
                    <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full border border-white/85 bg-emerald-400 px-1 text-[9px] leading-4 text-emerald-950 shadow-[0_2px_6px_rgba(16,185,129,0.24)]">
                      {sceneWasteTotal}
                    </span>
                  )}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSceneToolDockOpen((previous) => !previous)}
              className={cn(
                'pointer-events-auto ml-0.5 inline-flex h-[62px] w-5.5 shrink-0 flex-col items-center justify-center gap-0.5 rounded-r-[16px] rounded-l-[10px] border shadow-[0_7px_16px_rgba(15,23,42,0.08)] backdrop-blur-md transition-all active:scale-[0.98]',
                isSceneToolCancelHover
                  ? (isDarkBackdrop
                    ? 'border-rose-200/70 bg-rose-300/20 text-rose-50'
                    : 'border-rose-200 bg-rose-50 text-rose-700')
                  : (isDarkBackdrop
                    ? 'border-white/10 bg-black/18 text-white/76 hover:bg-black/24'
                    : 'border-white/78 bg-white/72 text-slate-600 hover:bg-white/86'),
              )}
              title={isSceneToolDockExpanded ? '收起工具' : '展开工具'}>
              <div className="flex flex-col items-center gap-1">
                <Wheat size={9} strokeWidth={2.3} className={cn(isSceneToolCancelHover ? 'text-current' : toolDragState?.tool === 'feed' ? 'text-amber-500' : '')} />
                <Sparkles size={9} strokeWidth={2.2} className={cn(isSceneToolCancelHover ? 'text-current' : toolDragState?.tool === 'clean' ? 'text-emerald-500' : '')} />
              </div>
              {sceneWasteTotal > 0 && (
                <span className="absolute right-0.5 top-1 h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_2px_rgba(255,255,255,0.82)]" />
              )}
              <span className="absolute bottom-1">
                {isSceneToolCancelHover
                  ? <X size={10} strokeWidth={2.7} />
                  : isSceneToolDockExpanded
                    ? <ChevronLeft size={10} strokeWidth={2.7} />
                    : <ChevronRight size={10} strokeWidth={2.7} />}
              </span>
            </button>
          </div>
        </div>
      )}

      {cardPet && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-[5000] flex justify-end px-3">
          <section
            className={cn(
              'pointer-events-auto relative w-[192px] rounded-xl border p-2 backdrop-blur-[2px]',
              'transform-gpu transition-all duration-150 ease-out',
              cardVisible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-2 scale-[0.985] opacity-0',
              isDarkBackdrop
                ? 'border-white/12 bg-black/24 text-white shadow-[0_6px_16px_rgba(2,6,23,0.24)]'
                : 'border-slate-200/75 bg-white/82 text-slate-700 shadow-[0_6px_14px_rgba(15,23,42,0.12)]',
            )}>
            <div className="flex items-start justify-between gap-2 pr-1">
              <div className="min-w-0 pr-8">
                <p className={cn('truncate text-sm font-black', isDarkBackdrop ? 'text-white' : 'text-slate-800')}>
                  {selectedDisplayName}
                </p>
                <p className={cn('mt-0.5 text-[9px] font-semibold', isDarkBackdrop ? 'text-white/68' : 'text-slate-400')}>
                  点空白可关闭
                </p>
              </div>
              <button
                type="button"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setSelectedPetInstanceId(null);
                }}
                className={cn(
                  'absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-xl border transition-colors touch-manipulation',
                  isDarkBackdrop
                    ? 'border-white/20 bg-white/10 text-white/85 hover:bg-white/18'
                    : 'border-slate-200 bg-white/95 text-slate-500 hover:bg-slate-100',
                )}>
                <X size={14} />
              </button>
            </div>

            <div
              className={cn(
                'mt-1.5 flex h-[64px] items-center justify-center rounded-lg border',
                isDarkBackdrop
                  ? 'border-white/10 bg-white/[0.05]'
                  : 'border-slate-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(238,242,255,0.76))]',
              )}>
              {selectedSpriteOption ? (
                <SpriteActor
                  spriteKey={selectedSpriteOption.key}
                  action={selectedSpriteAction}
                  scale={Math.min(selectedSpriteOption.sceneScale ?? 2.2, 2.35)}
                  flipX={selectedSpriteOption.flipX}
                    ariaLabel={selectedDisplayName}
                    className="drop-shadow-[0_8px_18px_rgba(15,23,42,0.24)]"
                  />
                ) : selectedCustomPet ? (
                  <img
                    src={selectedCustomPet.image}
                    alt={selectedCustomPet.name}
                    className="h-14 w-14 object-contain drop-shadow-[0_8px_16px_rgba(15,23,42,0.2)]"
                  />
                ) : selectedLegacyPet ? (
                <span className="text-3xl drop-shadow-[0_8px_16px_rgba(15,23,42,0.16)]">
                  {cardPet.state === 'focus'
                    ? selectedLegacyPet.focus
                    : cardPet.state === 'heal'
                      ? selectedLegacyPet.heal
                      : cardPet.state === 'active'
                        ? selectedLegacyPet.active
                        : selectedLegacyPet.base}
                </span>
              ) : (
                <span className={cn('text-xs font-semibold', isDarkBackdrop ? 'text-white/60' : 'text-slate-400')}>
                  无可用预览
                </span>
              )}
            </div>

            <div className="mt-1.5 grid grid-cols-2 gap-1">
              <div
                className={cn(
                  'rounded-lg border px-1.5 py-0.5 text-center',
                  isDarkBackdrop ? 'border-white/15 bg-white/[0.05]' : 'border-slate-200 bg-white/85',
                )}>
                <p className={cn('text-[9px] font-semibold', isDarkBackdrop ? 'text-white/55' : 'text-slate-400')}>品质</p>
                <p className={cn('text-[10px] font-black', isDarkBackdrop ? 'text-white' : 'text-slate-700')}>
                  {QUALITY_LABELS[cardPet.quality]}
                </p>
              </div>
              <div className={cn('rounded-lg border px-1.5 py-0.5 text-center', STATE_TONE[cardPet.state])}>
                <p className="text-[9px] font-semibold opacity-70">状态</p>
                <p className="text-[10px] font-black">{STATE_LABELS[cardPet.state]}</p>
              </div>
            </div>

            <div
              className={cn(
                'mt-1.5 space-y-1 rounded-lg border px-2 py-1.5 text-[10px]',
                isDarkBackdrop
                  ? 'border-white/15 bg-white/[0.05] text-white/85'
                  : 'border-slate-200 bg-white/85 text-slate-600',
              )}>
              <div className="flex items-center justify-between gap-2">
                <span className={cn('font-semibold', isDarkBackdrop ? 'text-white/60' : 'text-slate-400')}>品种</span>
                <span className="truncate font-bold">{selectedSpeciesName}</span>
              </div>
              <div className="space-y-1.5 pt-0.5">
                {[
                  {
                    label: '健康',
                    value: cardHealth,
                    tip: getHealthLabel(cardHealth),
                    tone: isDarkBackdrop ? 'bg-emerald-300' : 'bg-emerald-500',
                  },
                  {
                    label: '饱腹',
                    value: cardSatiety,
                    tip: getSatietyLabel(cardSatiety),
                    tone: isDarkBackdrop ? 'bg-amber-300' : 'bg-amber-500',
                  },
                  {
                    label: '心情',
                    value: cardMood,
                    tip: getMoodLabel(cardMood),
                    tone: isDarkBackdrop ? 'bg-violet-300' : 'bg-violet-500',
                  },
                ].map((metric) => {
                  const value = Math.max(0, Math.min(100, Math.round(metric.value)));
                  return (
                    <div key={metric.label} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn('text-[9px] font-semibold', isDarkBackdrop ? 'text-white/65' : 'text-slate-500')}>
                          {metric.label} · {metric.tip}
                        </span>
                        <span className={cn('text-[9px] font-black tabular-nums', isDarkBackdrop ? 'text-white/90' : 'text-slate-700')}>
                          {value}
                        </span>
                      </div>
                      <div className={cn('h-1.5 overflow-hidden rounded-full', isDarkBackdrop ? 'bg-white/15' : 'bg-slate-200')}>
                        <div
                          className={cn('h-full rounded-full transition-[width] duration-300', metric.tone)}
                          style={{width: `${value}%`}}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-1">
              <button
                type="button"
                disabled={isSelectedPetFull || isCardActionBusy}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={handleFeedSelectedPet}
                className={cn(
                  'relative inline-flex h-7 items-center justify-center overflow-hidden rounded-lg border text-[10px] font-black transition-all active:scale-[0.98]',
                  isSelectedPetFull &&
                    (isDarkBackdrop
                      ? 'cursor-not-allowed border-white/12 bg-white/8 text-white/45 active:scale-100'
                      : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 active:scale-100'),
                  isSelectedPetCardFeeding && isDarkBackdrop
                    ? 'cursor-wait border-amber-200/35 bg-amber-200/15 text-amber-100 active:scale-100'
                    : isSelectedPetCardFeeding
                      ? 'cursor-wait border-amber-200 bg-amber-50 text-amber-700 active:scale-100'
                      : '',
                  !isSelectedPetFull && !isSelectedPetCardFeeding && isDarkBackdrop
                    ? 'border-amber-200/35 bg-amber-200/15 text-amber-100 hover:bg-amber-200/20'
                    : !isSelectedPetFull && !isSelectedPetCardFeeding
                      ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                      : '',
                )}>
                {isSelectedPetCardFeeding && (
                  <div
                    className={cn(
                      'absolute inset-y-0 left-0 rounded-[inherit] transition-[width] duration-75',
                      isDarkBackdrop ? 'bg-amber-200/28' : 'bg-amber-200/75',
                    )}
                    style={{width: `${Math.round((cardFeedProgress ?? 0) * 100)}%`}}
                  />
                )}
                <span className="relative z-[1]">
                  {isSelectedPetFull ? '已饱' : isSelectedPetCardFeeding ? '喂食中' : '喂食'}
                </span>
              </button>
              <button
                type="button"
                disabled={isCardActionBusy}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={handleCheerSelectedPet}
                className={cn(
                  'relative inline-flex h-7 items-center justify-center overflow-hidden rounded-lg border text-[10px] font-black transition-all active:scale-[0.98]',
                  isCardActionBusy &&
                    (isDarkBackdrop
                      ? 'cursor-not-allowed border-white/12 bg-white/8 text-white/45 active:scale-100'
                      : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 active:scale-100'),
                  isSelectedPetCardCheering && isDarkBackdrop
                    ? 'cursor-wait border-rose-200/35 bg-rose-200/15 text-rose-100 active:scale-100'
                    : isSelectedPetCardCheering
                      ? 'cursor-wait border-rose-200 bg-rose-50 text-rose-700 active:scale-100'
                      : '',
                  !isCardActionBusy && isDarkBackdrop
                    ? 'border-rose-200/35 bg-rose-200/15 text-rose-100 hover:bg-rose-200/20'
                    : !isCardActionBusy
                      ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                      : '',
                )}>
                {isSelectedPetCardCheering && (
                  <div
                    className={cn(
                      'absolute inset-y-0 left-0 rounded-[inherit] transition-[width] duration-75',
                      isDarkBackdrop ? 'bg-rose-200/28' : 'bg-rose-200/75',
                    )}
                    style={{width: `${Math.round((cardCheerProgress ?? 0) * 100)}%`}}
                  />
                )}
                <span className="relative z-[1]">
                  {isSelectedPetCardCheering ? '抚摸中' : '抚摸'}
                </span>
              </button>
            </div>
          </section>
        </div>
      )}

      {toolDragState && (
        <>
          <div className="fixed inset-0 z-[5300] touch-none" />
          <div className="pointer-events-none fixed inset-x-0 bottom-[6.35rem] z-[5460] flex justify-center px-4">
            <div
              className={cn(
                'inline-flex max-w-[220px] items-center rounded-full border px-3 py-1.5 text-[10px] font-black shadow-[0_10px_30px_rgba(15,23,42,0.16)] backdrop-blur-md',
                isSceneToolCancelHover
                  ? 'border-rose-200/90 bg-[rgba(255,241,242,0.96)] text-rose-700'
                  : toolDragState.tool === 'feed'
                  ? 'border-amber-200/90 bg-[rgba(255,251,235,0.94)] text-amber-800'
                  : 'border-emerald-200/90 bg-[rgba(236,253,245,0.94)] text-emerald-800',
              )}>
              {isSceneToolCancelHover
                ? '松手取消本次操作'
                : toolDragState.tool === 'feed'
                ? (toolDragState.overScene ? `圆环是实际落点，松手撒出 ${FEED_DROP_BURST_COUNT} 份饲料` : '拖到场景里，圆环会显示落点')
                : (toolDragState.hoveredWasteInstanceId ? '绿色圆环是清理目标，松手生效' : '拖到便便上方，圆环会锁定目标')}
            </div>
          </div>
          {toolDragState.tool === 'feed' && toolDragPreviewPoint && (
            <div
              className="pointer-events-none fixed z-[5450]"
              style={{
                left: toolDragPreviewPoint.x,
                top: toolDragPreviewPoint.y,
                transform: 'translate(-50%, -92%)',
              }}>
              <div className="flex flex-col items-center gap-1">
                <div className="rounded-full border border-amber-200/90 bg-[rgba(255,251,235,0.96)] px-2 py-0.5 text-[9px] font-black text-amber-800 shadow-[0_8px_20px_rgba(245,158,11,0.14)]">
                  落点
                </div>
                <div className="relative h-10 w-10">
                  <div className="absolute inset-0 rounded-full border-2 border-amber-300/95 bg-amber-100/18 shadow-[0_8px_20px_rgba(245,158,11,0.14)] backdrop-blur-sm" />
                  <div className="absolute inset-[7px] rounded-full border border-dashed border-amber-400/90" />
                  <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500 shadow-[0_0_0_3px_rgba(251,191,36,0.18)]" />
                  <div className="absolute inset-0 rounded-full border border-amber-300/55 animate-ping" />
                </div>
              </div>
            </div>
          )}
          {toolDragState.tool === 'clean' && hoveredWastePreviewPoint && (
            <div
              className="pointer-events-none fixed z-[5450]"
              style={{
                left: hoveredWastePreviewPoint.x,
                top: hoveredWastePreviewPoint.y,
                transform: 'translate(-50%, -94%)',
              }}>
              <div className="flex flex-col items-center gap-1">
                <div className="rounded-full border border-emerald-200/90 bg-[rgba(236,253,245,0.96)] px-2 py-0.5 text-[9px] font-black text-emerald-800 shadow-[0_8px_20px_rgba(16,185,129,0.14)]">
                  清理目标
                </div>
                <div className="relative flex h-10 w-10 items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-2 border-emerald-300/95 bg-emerald-100/18 shadow-[0_8px_20px_rgba(16,185,129,0.14)] backdrop-blur-sm" />
                  <div className="absolute inset-[7px] rounded-full border border-dashed border-emerald-400/90" />
                  <div className="absolute inset-0 rounded-full border border-emerald-300/55 animate-ping" />
                  <Sparkles size={14} strokeWidth={2.3} className="relative text-emerald-600" />
                </div>
              </div>
            </div>
          )}
          <div
            className="pointer-events-none fixed z-[5500]"
            style={{
              left: toolDragState.clientX,
              top: toolDragState.clientY,
              transform: 'translate(14px, -72px) rotate(-5deg)',
            }}>
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full border shadow-[0_16px_32px_rgba(15,23,42,0.14)] backdrop-blur-md',
                toolDragState.tool === 'feed'
                  ? 'border-amber-200/90 bg-[linear-gradient(180deg,rgba(255,251,235,0.96),rgba(255,244,214,0.94))] text-amber-800'
                  : 'border-emerald-200/90 bg-[linear-gradient(180deg,rgba(236,253,245,0.96),rgba(220,252,231,0.94))] text-emerald-800',
              )}>
              {toolDragState.tool === 'feed' ? (
                <Wheat size={16} strokeWidth={2.4} />
              ) : (
                <Sparkles size={16} strokeWidth={2.3} />
              )}
            </div>
          </div>
        </>
      )}

      <PetBoardSheet
        open={showPetBoard}
        currentTheme={effectiveTheme}
        completedPets={completedPets}
        customPets={customPets}
        onRename={renameCompletedPet}
        onDiscard={discardCompletedPet}
        onClose={() => setShowPetBoard(false)}
      />
    </div>
  );
}
