import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Archive, Cloud, Lock, MoonStar, Palette, Sparkles, Sun, Sunset, Waves, X} from 'lucide-react';
import {
  PetScene,
  type SceneFeedDrop,
  type ScenePetActionRequest,
  type ScenePetFeedMoveRequest,
} from '../components/PetScene';
import {PetBoardSheet} from '../components/PetBoardSheet';
import {SpriteActor} from '../components/SpriteActor';
import {cn} from '../utils/cn';
import {useStore, type CompletedPet} from '../store/useStore';
import {PETS, type ThemeType} from '../data/pets';
import {getPetSpriteOptionByKey, hasPetSpriteAction, isPetSpriteKey, type PetSpriteAction} from '../data/petSprites';
import {formatZhDate, getSimulatedDate} from '../utils/date';
import {SCENE_BOTTOM_MAX, SCENE_BOTTOM_MIN, SCENE_X_MAX, SCENE_X_MIN} from '../constants/sceneBounds';
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
const SCENE_DEBUG_HIT_AREAS = false;
const FEED_DROP_TTL_MS = 20_000;
const FEED_BLOCK_SATIETY = 92;
const FEED_SCATTER_RADIUS = 18;
const FEED_SCATTER_MAX_TARGETS = 6;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

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
    cleanSceneWaste,
  } = useStore();
  const [showPetBoard, setShowPetBoard] = useState(false);
  const [farmSkyPhaseOverride, setFarmSkyPhaseOverride] = useState<FarmSkyPhase | null>(null);
  const [selectedPetInstanceId, setSelectedPetInstanceId] = useState<string | null>(null);
  const [cardPetSnapshot, setCardPetSnapshot] = useState<CompletedPet | null>(null);
  const [cardVisible, setCardVisible] = useState(false);
  const [farmOutgoingBackgroundPath, setFarmOutgoingBackgroundPath] = useState<string | null>(null);
  const [farmOutgoingSkyPhase, setFarmOutgoingSkyPhase] = useState<FarmSkyPhase | null>(null);
  const [sceneActionRequest, setSceneActionRequest] = useState<ScenePetActionRequest | null>(null);
  const [sceneFeedMoveRequest, setSceneFeedMoveRequest] = useState<ScenePetFeedMoveRequest | null>(null);
  const [sceneFeedDrops, setSceneFeedDrops] = useState<SceneFeedDrop[]>([]);
  const [isScatterFeedMode, setIsScatterFeedMode] = useState(false);
  const sceneFeedDropTimersRef = useRef<number[]>([]);
  const feedingPetIdsRef = useRef(new Set<string>());

  const today = useMemo(
    () => formatZhDate(getSimulatedDate(simulatedDateOffset)),
    [simulatedDateOffset],
  );
  const farmSkyPhase = useMemo(
    () => farmSkyPhaseOverride ?? getFarmSkyPhase(new Date().getHours()),
    [farmSkyPhaseOverride],
  );
  const farmBackgroundPath = FARM_BACKGROUND_PATHS[farmSkyPhase];
  const farmVisualRef = useRef<{backgroundPath: string; skyPhase: FarmSkyPhase}>({
    backgroundPath: farmBackgroundPath,
    skyPhase: farmSkyPhase,
  });
  const farmVisualTimerRef = useRef<number | null>(null);

  const isOceanLocked = currentTheme === 'B';
  const effectiveTheme: ThemeType = currentTheme === 'C' ? 'A' : currentTheme;
  const petsInTheme = completedPets.filter((pet) => pet.theme === effectiveTheme);
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

  useEffect(() => {
    if (!selectedPetInstanceId) return;
    const exists = petsInTheme.some((pet) => pet.instanceId === selectedPetInstanceId);
    if (!exists) {
      setSelectedPetInstanceId(null);
    }
  }, [petsInTheme, selectedPetInstanceId]);
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
    return () => {
      if (farmVisualTimerRef.current !== null) {
        window.clearTimeout(farmVisualTimerRef.current);
      }
      sceneFeedDropTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      sceneFeedDropTimersRef.current = [];
      feedingPetIdsRef.current.clear();
    };
  }, []);
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
  const selectedSpriteAction = cardPet
    ? resolveSceneCardAction(cardPet.petId, cardPet.state)
    : 'idle';
  const cardHealth = cardPet ? getPetMetric(cardPet, 'health') : 0;
  const cardSatiety = cardPet ? getPetMetric(cardPet, 'satiety') : 0;
  const cardMood = cardPet ? getPetMetric(cardPet, 'mood') : 0;
  const isSelectedPetFull = cardSatiety >= FEED_BLOCK_SATIETY;

  const queueSceneAction = (instanceId: string, action: ScenePetActionRequest['action']) => {
    setSceneActionRequest((previous) => ({
      instanceId,
      action,
      nonce: (previous?.nonce ?? 0) + 1,
    }));
  };
  const queueSceneFeedMoveRequest = (instanceId: string, drop: Pick<SceneFeedDrop, 'id' | 'x' | 'y'>) => {
    setSceneFeedMoveRequest((previous) => ({
      instanceId,
      dropId: drop.id,
      x: drop.x,
      y: drop.y,
      nonce: (previous?.nonce ?? 0) + 1,
    }));
  };

  const handlePetSelect = (pet: CompletedPet) => {
    setSelectedPetInstanceId(pet.instanceId);
    cheerCompletedPet(pet.instanceId);
    queueSceneAction(pet.instanceId, 'happy');
  };

  const spawnFeedDrop = (x: number, y: number, ttlMs = FEED_DROP_TTL_MS) => {
    const dropId = `feed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const createdAt = Date.now();
    const drop: SceneFeedDrop = {id: dropId, x, y, createdAt, ttlMs};

    setSceneFeedDrops((previous) => ([
      ...previous.filter((drop) => Date.now() - drop.createdAt < drop.ttlMs).slice(-8),
      drop,
    ]));
    const removeFeedDropTimer = window.setTimeout(() => {
      setSceneFeedDrops((previous) => previous.filter((drop) => drop.id !== dropId));
      sceneFeedDropTimersRef.current = sceneFeedDropTimersRef.current.filter((timer) => timer !== removeFeedDropTimer);
    }, ttlMs);
    sceneFeedDropTimersRef.current.push(removeFeedDropTimer);
    return drop;
  };

  const scheduleFeedForPet = (instanceId: string, drop: Pick<SceneFeedDrop, 'id' | 'x' | 'y'>, actionDelay: number) => {
    if (feedingPetIdsRef.current.has(instanceId)) return false;
    feedingPetIdsRef.current.add(instanceId);

    const queueFeedMoveTimer = window.setTimeout(() => {
      queueSceneFeedMoveRequest(instanceId, drop);
      sceneFeedDropTimersRef.current = sceneFeedDropTimersRef.current.filter((timer) => timer !== queueFeedMoveTimer);
    }, actionDelay);

    sceneFeedDropTimersRef.current.push(queueFeedMoveTimer);
    return true;
  };

  const handleFeedSelectedPet = () => {
    if (!cardPet) return;
    if (cardSatiety >= FEED_BLOCK_SATIETY) return;

    const dropX = clamp(cardPet.x + (Math.random() - 0.5) * 5.5, SCENE_X_MIN + 1.5, SCENE_X_MAX - 1.5);
    const dropY = clamp(cardPet.y + 5 + Math.random() * 2, SCENE_BOTTOM_MIN + 1.2, SCENE_BOTTOM_MAX + 2.5);
    const drop = spawnFeedDrop(dropX, dropY);
    scheduleFeedForPet(
      cardPet.instanceId,
      drop,
      90 + Math.random() * 80,
    );
  };

  const handleSceneScatterFeed = (point: {x: number; y: number}) => {
    if (!isScatterFeedMode || effectiveTheme !== 'A') return;

    const centerX = clamp(point.x, SCENE_X_MIN + 1.5, SCENE_X_MAX - 1.5);
    const centerY = clamp(point.y, SCENE_BOTTOM_MIN + 1.2, SCENE_BOTTOM_MAX + 2.5);

    const candidates = petsInTheme
      .map((pet) => {
        const dx = pet.x - centerX;
        const dy = (pet.y - centerY) * 1.35;
        const distance = Math.hypot(dx, dy);
        return {pet, distance, satiety: getPetMetric(pet, 'satiety')};
      })
      .filter((item) => item.satiety < FEED_BLOCK_SATIETY)
      .filter((item) => !feedingPetIdsRef.current.has(item.pet.instanceId))
      .sort((left, right) => left.distance - right.distance);

    const targetPool = (
      candidates.filter((item) => item.distance <= FEED_SCATTER_RADIUS).length > 0
        ? candidates.filter((item) => item.distance <= FEED_SCATTER_RADIUS)
        : candidates
    ).slice(0, FEED_SCATTER_MAX_TARGETS);

    targetPool.forEach((item, index) => {
      const drop = spawnFeedDrop(
        clamp(centerX + (Math.random() - 0.5) * 3.6, SCENE_X_MIN + 1.5, SCENE_X_MAX - 1.5),
        clamp(centerY + (Math.random() - 0.5) * 2.8, SCENE_BOTTOM_MIN + 1.2, SCENE_BOTTOM_MAX + 2.5),
        1800 + index * 90,
      );
      scheduleFeedForPet(
        item.pet.instanceId,
        drop,
        120 + index * 90 + Math.random() * 60,
      );
    });
  };

  useEffect(() => {
    if (effectiveTheme === 'A') return;
    setIsScatterFeedMode(false);
  }, [effectiveTheme]);

  const handlePetFeedArrived = ({instanceId, dropId}: {instanceId: string; dropId: string}) => {
    feedCompletedPet(instanceId);
    feedingPetIdsRef.current.delete(instanceId);
    setSceneFeedDrops((previous) => previous.filter((drop) => drop.id !== dropId));
  };

  const handleCleanCurrentScene = () => {
    cleanSceneWaste(effectiveTheme);
  };

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
              onClick={() => setIsScatterFeedMode((previous) => !previous)}
              className={cn(
                'inline-flex h-7 shrink-0 items-center rounded-lg border px-2.5 text-[10px] font-bold transition-all active:scale-[0.98]',
                isScatterFeedMode
                  ? (isDarkBackdrop
                    ? 'border-amber-200/45 bg-amber-300/20 text-amber-100 hover:bg-amber-300/24'
                    : 'border-amber-200 bg-amber-100 text-amber-700 hover:bg-amber-200')
                  : (isDarkBackdrop
                    ? 'border-white/18 bg-black/28 text-white hover:bg-black/34'
                    : 'border-slate-200 bg-white/90 text-slate-700 hover:bg-white'),
              )}>
              撒饲料：{isScatterFeedMode ? '开' : '关'}
            </button>
            <button
              onClick={handleCleanCurrentScene}
              className={cn(
                'inline-flex h-7 shrink-0 items-center rounded-lg border px-2.5 text-[10px] font-bold transition-all active:scale-[0.98]',
                isDarkBackdrop
                  ? 'border-emerald-200/30 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/15'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100',
              )}>
              清理便便
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
              onPetSelect={handlePetSelect}
              onSceneBlankClick={() => {
                if (!isScatterFeedMode) {
                  setSelectedPetInstanceId(null);
                }
              }}
              onSceneBlankPointer={handleSceneScatterFeed}
              actionRequest={sceneActionRequest}
              feedMoveRequest={sceneFeedMoveRequest}
              onPetFeedArrived={handlePetFeedArrived}
              feedDrops={sceneFeedDrops}
              debugHitArea={SCENE_DEBUG_HIT_AREAS}
            />
          </div>
        )}
      </div>

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
                disabled={isSelectedPetFull}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={handleFeedSelectedPet}
                className={cn(
                  'inline-flex h-7 items-center justify-center rounded-lg border text-[10px] font-black transition-all active:scale-[0.98]',
                  isSelectedPetFull &&
                    (isDarkBackdrop
                      ? 'cursor-not-allowed border-white/12 bg-white/8 text-white/45 active:scale-100'
                      : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 active:scale-100'),
                  !isSelectedPetFull && isDarkBackdrop
                    ? 'border-amber-200/35 bg-amber-200/15 text-amber-100 hover:bg-amber-200/20'
                    : !isSelectedPetFull
                      ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                      : '',
                )}>
                {isSelectedPetFull ? '已饱' : '喂食'}
              </button>
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={handleCleanCurrentScene}
                className={cn(
                  'inline-flex h-7 items-center justify-center rounded-lg border text-[10px] font-black transition-all active:scale-[0.98]',
                  isDarkBackdrop
                    ? 'border-emerald-200/35 bg-emerald-200/15 text-emerald-100 hover:bg-emerald-200/20'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
                )}>
                清理
              </button>
            </div>
          </section>
        </div>
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
