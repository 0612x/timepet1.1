import React, {useEffect, useMemo, useState} from 'react';
import {Archive, Cloud, Lock, MoonStar, Palette, Sparkles, Sun, Sunset, Waves, X} from 'lucide-react';
import {PetScene} from '../components/PetScene';
import {PetBoardSheet} from '../components/PetBoardSheet';
import {SpriteActor} from '../components/SpriteActor';
import {cn} from '../utils/cn';
import {useStore, type CompletedPet} from '../store/useStore';
import {PETS, type ThemeType} from '../data/pets';
import {getPetSpriteOptionByKey, hasPetSpriteAction, isPetSpriteKey, type PetSpriteAction} from '../data/petSprites';
import {formatZhDate, getSimulatedDate} from '../utils/date';

const SCENE_TABS: Array<{theme: ThemeType; label: string; locked?: boolean}> = [
  {theme: 'A', label: '农场'},
  {theme: 'B', label: '深海', locked: true},
  {theme: 'custom', label: '手绘'},
];

type FarmSkyPhase = 'day' | 'dusk' | 'night';

const FARM_BACKGROUND_PATHS: Record<FarmSkyPhase, string> = {
  day: '/images/scenes/farm/farm_day.png',
  dusk: '/images/scenes/farm/farm_dusk.png',
  night: '/images/scenes/farm/farm_night.png',
};

const getFarmSkyPhase = (hour: number): FarmSkyPhase => {
  if (hour >= 17 && hour < 19) return 'dusk';
  if (hour >= 6 && hour < 17) return 'day';
  return 'night';
};

const FARM_SKY_TEST_ORDER: Array<FarmSkyPhase | null> = [null, 'day', 'dusk', 'night'];
const FARM_SKY_PHASE_LABELS: Record<FarmSkyPhase, string> = {
  day: '白天',
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
const ACTION_LABELS: Record<PetSpriteAction, string> = {
  idle: '待机',
  move: '移动',
  feed: '喂食',
  happy: '开心',
};
const CARD_TRANSITION_MS = 180;
const SCENE_DEBUG_HIT_AREAS = false;

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
  } = useStore();
  const [showPetBoard, setShowPetBoard] = useState(false);
  const [farmSkyPhaseOverride, setFarmSkyPhaseOverride] = useState<FarmSkyPhase | null>(null);
  const [selectedPetInstanceId, setSelectedPetInstanceId] = useState<string | null>(null);
  const [cardPetSnapshot, setCardPetSnapshot] = useState<CompletedPet | null>(null);
  const [cardVisible, setCardVisible] = useState(false);

  const today = useMemo(
    () => formatZhDate(getSimulatedDate(simulatedDateOffset)),
    [simulatedDateOffset],
  );
  const farmSkyPhase = useMemo(
    () => farmSkyPhaseOverride ?? getFarmSkyPhase(new Date().getHours()),
    [farmSkyPhaseOverride],
  );
  const farmBackgroundPath = FARM_BACKGROUND_PATHS[farmSkyPhase];

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
      : farmSkyPhase === 'dusk'
        ? (isDarkBackdrop ? 'border-orange-200/30 bg-orange-200/18 text-orange-100' : 'border-orange-200 bg-orange-100 text-orange-700')
        : (isDarkBackdrop ? 'border-indigo-200/35 bg-indigo-200/20 text-indigo-100' : 'border-indigo-200 bg-indigo-100 text-indigo-700')
    : effectiveTheme === 'B'
      ? (isDarkBackdrop ? 'border-cyan-200/30 bg-cyan-200/16 text-cyan-100' : 'border-cyan-200 bg-cyan-100 text-cyan-700')
      : 'border-fuchsia-200 bg-fuchsia-100 text-fuchsia-700';
  const sceneTimeIcon = effectiveTheme === 'A'
    ? farmSkyPhase === 'day'
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

  return (
    <div
      className={cn(
        'relative isolate h-full min-h-0 flex-1 flex flex-col overflow-hidden transition-colors duration-150',
        getThemeBackground(),
      )}>
      {effectiveTheme === 'A' && (
        <>
          <div
            className="pointer-events-none absolute inset-0 z-0 bg-no-repeat"
            style={{
              backgroundImage: `url(${farmBackgroundPath})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center bottom',
              imageRendering: 'pixelated',
            }}
          />
          <div
            className={cn(
              'pointer-events-none absolute inset-0 z-0',
              farmSkyPhase === 'night'
                ? 'bg-[linear-gradient(180deg,rgba(2,6,23,0.18),rgba(2,6,23,0.34)_58%,rgba(2,6,23,0.18))]'
                : farmSkyPhase === 'dusk'
                  ? 'bg-[linear-gradient(180deg,rgba(15,23,42,0.06),rgba(15,23,42,0.2)_60%,rgba(15,23,42,0.08))]'
                  : 'bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.1)_62%,rgba(255,255,255,0.02))]',
            )}
          />
        </>
      )}

      <div className="absolute inset-x-0 top-0 z-20 pointer-events-none px-3 pt-2">
        <div className="pointer-events-auto">
          <div className="flex max-w-full items-center gap-1.5">
            <div
              className={cn(
                'inline-flex h-7 shrink-0 items-center gap-2 rounded-full px-3 text-[10px] font-semibold leading-none',
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
              onPetSelect={(pet) => setSelectedPetInstanceId(pet.instanceId)}
              onSceneBlankClick={() => setSelectedPetInstanceId(null)}
              debugHitArea={SCENE_DEBUG_HIT_AREAS}
            />
          </div>
        )}
      </div>

      {cardPet && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-[5000] flex justify-end px-3">
          <section
            className={cn(
              'pointer-events-auto relative w-[214px] rounded-2xl border p-2.5 backdrop-blur-md',
              'transform-gpu transition-all duration-150 ease-out',
              cardVisible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-2 scale-[0.985] opacity-0',
              isDarkBackdrop
                ? 'border-white/14 bg-black/30 text-white shadow-[0_8px_20px_rgba(2,6,23,0.28)]'
                : 'border-slate-200/75 bg-white/78 text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.14)]',
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
                'mt-2 flex h-[72px] items-center justify-center rounded-xl border',
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
                  className="h-16 w-16 object-contain drop-shadow-[0_8px_16px_rgba(15,23,42,0.2)]"
                />
              ) : selectedLegacyPet ? (
                <span className="text-4xl drop-shadow-[0_8px_16px_rgba(15,23,42,0.16)]">
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

            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <div
                className={cn(
                  'rounded-lg border px-1.5 py-1 text-center',
                  isDarkBackdrop ? 'border-white/15 bg-white/[0.05]' : 'border-slate-200 bg-white/85',
                )}>
                <p className={cn('text-[9px] font-semibold', isDarkBackdrop ? 'text-white/55' : 'text-slate-400')}>品质</p>
                <p className={cn('text-[10px] font-black', isDarkBackdrop ? 'text-white' : 'text-slate-700')}>
                  {QUALITY_LABELS[cardPet.quality]}
                </p>
              </div>
              <div className={cn('rounded-lg border px-1.5 py-1 text-center', STATE_TONE[cardPet.state])}>
                <p className="text-[9px] font-semibold opacity-70">状态</p>
                <p className="text-[10px] font-black">{STATE_LABELS[cardPet.state]}</p>
              </div>
              <div
                className={cn(
                  'rounded-lg border px-1.5 py-1 text-center',
                  isDarkBackdrop ? 'border-white/15 bg-white/[0.05]' : 'border-slate-200 bg-white/85',
                )}>
                <p className={cn('text-[9px] font-semibold', isDarkBackdrop ? 'text-white/55' : 'text-slate-400')}>场景</p>
                <p className={cn('text-[10px] font-black', isDarkBackdrop ? 'text-white' : 'text-slate-700')}>
                  {currentThemeLabel}
                </p>
              </div>
            </div>

            <div
              className={cn(
                'mt-2 space-y-1 rounded-lg border px-2 py-1.5 text-[10px]',
                isDarkBackdrop
                  ? 'border-white/15 bg-white/[0.05] text-white/85'
                  : 'border-slate-200 bg-white/85 text-slate-600',
              )}>
              <div className="flex items-center justify-between gap-2">
                <span className={cn('font-semibold', isDarkBackdrop ? 'text-white/60' : 'text-slate-400')}>品种</span>
                <span className="truncate font-bold">{selectedSpeciesName}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className={cn('font-semibold', isDarkBackdrop ? 'text-white/60' : 'text-slate-400')}>动作</span>
                <span className="font-bold">{ACTION_LABELS[selectedSpriteAction]}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className={cn('font-semibold', isDarkBackdrop ? 'text-white/60' : 'text-slate-400')}>坐标</span>
                <span className="font-bold tabular-nums">
                  {Math.round(cardPet.x)}%, {Math.round(cardPet.y)}%
                </span>
              </div>
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
