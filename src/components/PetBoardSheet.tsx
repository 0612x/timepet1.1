import React, {useEffect, useMemo, useState} from 'react';
import {createPortal} from 'react-dom';
import {AnimatePresence, motion} from 'motion/react';
import {Check, LayoutGrid, Pencil, Sparkles, Trash2, X} from 'lucide-react';
import {cn} from '../utils/cn';
import {type CompletedPet, type CustomPet, type PetQuality} from '../store/useStore';
import {PETS} from '../data/pets';
import {
  getPetSpriteConfigByKey,
  getPetSpriteOptionByKey,
  hasPetSpriteAction,
  isPetSpriteKey,
  type PetSpriteAction,
} from '../data/petSprites';
import {SpriteActor} from './SpriteActor';
import {GraveSprite} from './GraveSprite';
import {
  getHealthLabel,
  getMoodLabel,
  getPetMetric,
  getSatietyLabel,
} from '../utils/petStatus';

interface PetBoardSheetProps {
  open: boolean;
  currentTheme: CompletedPet['theme'];
  completedPets: CompletedPet[];
  customPets: CustomPet[];
  onRename: (instanceId: string, nickname: string) => boolean;
  onDiscard: (instanceId: string) => void;
  onClose: () => void;
}

interface BoardItem {
  pet: CompletedPet;
  title: string;
  speciesName: string;
  stateLabel: string;
  sceneLabel: string;
  isDead: boolean;
  health: number;
  satiety: number;
  mood: number;
  healthLabel: string;
  satietyLabel: string;
  moodLabel: string;
}

const STATE_LABEL: Record<CompletedPet['state'], string> = {
  base: '幼体',
  focus: '专注',
  heal: '治愈',
  active: '活力',
};

const QUALITY_LABEL: Record<PetQuality, string> = {
  common: '普通',
  rare: '优秀',
  epic: '完美',
};

const QUALITY_CLASS: Record<PetQuality, string> = {
  common: 'bg-slate-100 text-slate-500',
  rare: 'bg-amber-50 text-amber-600',
  epic: 'bg-emerald-50 text-emerald-600',
};

const QUALITY_CARD_CLASS: Record<PetQuality, string> = {
  common: 'border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,250,252,0.95))] shadow-[0_12px_30px_rgba(15,23,42,0.08)]',
  rare: 'border-amber-200/90 bg-[linear-gradient(180deg,rgba(255,252,244,0.98),rgba(255,247,230,0.95))] shadow-[0_14px_34px_rgba(217,119,6,0.12)]',
  epic: 'border-emerald-200/90 bg-[linear-gradient(180deg,rgba(245,255,251,0.98),rgba(235,251,244,0.95))] shadow-[0_14px_34px_rgba(5,150,105,0.12)]',
};

const QUALITY_BADGE_CLASS: Record<PetQuality, string> = {
  common: 'border border-slate-200 bg-slate-100 text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]',
  rare: 'border border-amber-200 bg-[linear-gradient(180deg,#fff6db,#ffe7b0)] text-amber-700 shadow-[0_2px_0_#f0cf7e]',
  epic: 'border border-emerald-200 bg-[linear-gradient(180deg,#e8fff5,#c8f5df)] text-emerald-700 shadow-[0_2px_0_#9fe3bf]',
};

const STATE_CLASS: Record<CompletedPet['state'], string> = {
  base: 'border-slate-200 bg-slate-100 text-slate-600',
  focus: 'border-rose-200 bg-rose-50 text-rose-700',
  heal: 'border-sky-200 bg-sky-50 text-sky-700',
  active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const STATE_PREVIEW_CLASS: Record<CompletedPet['state'], string> = {
  base: 'bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(241,245,249,0.9))]',
  focus: 'bg-[radial-gradient(circle_at_top,rgba(251,113,133,0.14),rgba(255,255,255,0.96)_48%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,241,242,0.9))]',
  heal: 'bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.14),rgba(255,255,255,0.96)_48%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(240,249,255,0.92))]',
  active: 'bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.14),rgba(255,255,255,0.96)_48%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(236,253,245,0.9))]',
};

const THEME_LABEL: Record<CompletedPet['theme'], string> = {
  A: '农场',
  B: '深海',
  C: '霓虹',
  custom: '手绘',
};

function resolveSpriteAction(petId: string, state: CompletedPet['state']): PetSpriteAction {
  const preferredAction: Record<CompletedPet['state'], PetSpriteAction> = {
    base: 'idle',
    focus: 'move',
    heal: 'feed',
    active: 'happy',
  };
  const action = preferredAction[state];
  if (hasPetSpriteAction(petId, action)) return action;
  if (hasPetSpriteAction(petId, 'idle')) return 'idle';
  if (hasPetSpriteAction(petId, 'move')) return 'move';
  if (hasPetSpriteAction(petId, 'happy')) return 'happy';
  if (hasPetSpriteAction(petId, 'feed')) return 'feed';
  return 'idle';
}

const PREVIEW_TARGET_MIN = 76;
const PREVIEW_TARGET_BASE = 82;
const PREVIEW_TARGET_MAX = 98;
const PREVIEW_BOX_SIZE = 104;
const BOARD_PREVIEW_SPECIES_FACTOR: Record<string, number> = {
  farm_Akita: 1,
  farm_chicken: 0.54,
  farm_vita: 0.68,
  farm_miniyellowcat: 1.18,
  farm_miniblackwcat: 1.18,
  farm_minisiamese: 1.18,
  farm_miniTabbycat: 1.18,
  farm_miniragdollcat: 1.18,
  farm_minicivetcat: 1.18,
  farm_littlewhite: 0.82,
  farm_littleblue: 0.82,
  farm_littlegray: 0.82,
  farm_robotbird: 0.82,
  farm_robotsheep: 0.82,
  farm_robotfrog: 0.82,
  farm_robotpig: 0.82,
};
const BOARD_PREVIEW_ZOOM_FACTOR: Record<string, number> = {
  farm_Akita: 1.92,
};
const BOARD_PREVIEW_Y_OFFSET: Record<string, number> = {
  farm_Akita: 18,
};

function getBoardPreviewScale(petId: string, action: PetSpriteAction) {
  const spriteOption = getPetSpriteOptionByKey(petId);
  const actionConfig = getPetSpriteConfigByKey(petId, action);
  const frameWidth = actionConfig?.frameWidth ?? 32;
  const frameHeight = actionConfig?.frameHeight ?? 32;
  const frameSize = Math.max(frameWidth, frameHeight);
  const sceneScale = spriteOption?.sceneScale ?? 2.2;
  const sceneFootprint = frameSize * sceneScale;

  // Compress the size gap between different source sheets while keeping
  // larger scene animals slightly larger in the collection preview.
  const targetSize = Math.max(
    PREVIEW_TARGET_MIN,
    Math.min(
      PREVIEW_TARGET_MAX,
      PREVIEW_TARGET_BASE + (sceneFootprint - 72) * 0.08,
    ),
  );
  const speciesFactor = BOARD_PREVIEW_SPECIES_FACTOR[petId] ?? 1;
  const desiredScale = (targetSize * speciesFactor) / frameSize;
  const maxFitScale = Math.min(PREVIEW_BOX_SIZE / frameWidth, PREVIEW_BOX_SIZE / frameHeight);

  return Math.min(desiredScale, maxFitScale);
}

function getBoardPreviewZoom(petId: string) {
  return BOARD_PREVIEW_ZOOM_FACTOR[petId] ?? 1;
}

function getBoardPreviewYOffset(petId: string) {
  return BOARD_PREVIEW_Y_OFFSET[petId] ?? 0;
}

export function PetBoardSheet({
  open,
  currentTheme,
  completedPets,
  customPets,
  onRename,
  onDiscard,
  onClose,
}: PetBoardSheetProps) {
  const [scope, setScope] = useState<'current' | 'all'>('current');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const boardItems = useMemo<BoardItem[]>(
    () =>
      [...completedPets]
        .reverse()
        .map((pet) => {
          if (isPetSpriteKey(pet.petId)) {
            const spriteOption = getPetSpriteOptionByKey(pet.petId);
            const speciesName = spriteOption?.label ?? pet.petId;
            return {
              pet,
              title: pet.nickname || speciesName,
              speciesName,
              stateLabel: pet.isDead ? '已离世' : STATE_LABEL[pet.state],
              sceneLabel: THEME_LABEL[pet.theme],
              isDead: Boolean(pet.isDead),
              health: Math.round(getPetMetric(pet, 'health')),
              satiety: Math.round(getPetMetric(pet, 'satiety')),
              mood: Math.round(getPetMetric(pet, 'mood')),
              healthLabel: pet.isDead ? '已离世' : getHealthLabel(getPetMetric(pet, 'health')),
              satietyLabel: getSatietyLabel(getPetMetric(pet, 'satiety')),
              moodLabel: getMoodLabel(getPetMetric(pet, 'mood')),
            };
          }

          if (pet.theme === 'custom') {
            const customPet = customPets.find((item) => item.id === pet.petId);
            const speciesName = customPet?.name ?? '手绘宠物';
            return {
              pet,
              title: pet.nickname || speciesName,
              speciesName,
              stateLabel: pet.isDead ? '已离世' : STATE_LABEL[pet.state],
              sceneLabel: THEME_LABEL[pet.theme],
              isDead: Boolean(pet.isDead),
              health: Math.round(getPetMetric(pet, 'health')),
              satiety: Math.round(getPetMetric(pet, 'satiety')),
              mood: Math.round(getPetMetric(pet, 'mood')),
              healthLabel: pet.isDead ? '已离世' : getHealthLabel(getPetMetric(pet, 'health')),
              satietyLabel: getSatietyLabel(getPetMetric(pet, 'satiety')),
              moodLabel: getMoodLabel(getPetMetric(pet, 'mood')),
            };
          }

          const legacyPet = PETS.find((item) => item.id === pet.petId);
          const speciesName = legacyPet?.name ?? `宠物 ${pet.petId}`;
          return {
            pet,
            title: pet.nickname || speciesName,
            speciesName,
            stateLabel: pet.isDead ? '已离世' : STATE_LABEL[pet.state],
            sceneLabel: THEME_LABEL[pet.theme],
            isDead: Boolean(pet.isDead),
            health: Math.round(getPetMetric(pet, 'health')),
            satiety: Math.round(getPetMetric(pet, 'satiety')),
            mood: Math.round(getPetMetric(pet, 'mood')),
            healthLabel: pet.isDead ? '已离世' : getHealthLabel(getPetMetric(pet, 'health')),
            satietyLabel: getSatietyLabel(getPetMetric(pet, 'satiety')),
            moodLabel: getMoodLabel(getPetMetric(pet, 'mood')),
          };
        }),
    [completedPets, customPets],
  );
  const filteredBoardItems = useMemo(
    () => (scope === 'all' ? boardItems : boardItems.filter((item) => item.pet.theme === currentTheme)),
    [boardItems, currentTheme, scope],
  );
  const currentSceneLabel = THEME_LABEL[currentTheme];

  useEffect(() => {
    if (!open) return;
    setScope('current');
    setEditingId(null);
    setEditingName('');
  }, [open, currentTheme]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div
          className="fixed inset-0 z-[12000]"
          onClick={onClose}>
          <motion.div
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.14),rgba(15,23,42,0.36))] backdrop-blur-[5px]"
          />
          <div
            className="absolute inset-0 flex items-end justify-center p-3 sm:p-4"
            style={{paddingBottom: 'calc(env(safe-area-inset-bottom) + 14px)'}}>
            <motion.div
              initial={{y: 44, opacity: 0, scale: 0.98}}
              animate={{y: 0, opacity: 1, scale: 1}}
              exit={{y: 60, opacity: 0, scale: 0.98}}
              transition={{type: 'spring', stiffness: 300, damping: 30, mass: 0.88}}
              className="pointer-events-auto w-full max-w-[44rem] overflow-hidden rounded-[28px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.98)_100%)] shadow-[0_22px_70px_rgba(15,23,42,0.25)]"
              onClick={(event) => event.stopPropagation()}>
              <div className="mx-auto mt-2 h-1.5 w-11 rounded-full bg-slate-200" />

              <div className="px-4 pb-3 pt-3 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">宠物库</p>
                    <h3 className="mt-1 text-lg font-black text-slate-900">
                      {scope === 'current' ? `${currentSceneLabel}场景` : '全部场景'} · {filteredBoardItems.length} 只
                    </h3>
                    <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                      <LayoutGrid size={12} />
                      左右滑动查看宠物卡片
                    </p>
                    <div className="mt-2 inline-flex rounded-xl bg-slate-100 p-1">
                      <button
                        onClick={() => setScope('current')}
                        className={cn(
                          'h-7 rounded-lg px-3 text-[11px] font-bold transition-all',
                          scope === 'current'
                            ? 'bg-white text-slate-800 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700',
                        )}>
                        当前场景
                      </button>
                      <button
                        onClick={() => setScope('all')}
                        className={cn(
                          'h-7 rounded-lg px-3 text-[11px] font-bold transition-all',
                          scope === 'all'
                            ? 'bg-white text-slate-800 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700',
                        )}>
                        全部场景
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition-colors hover:text-slate-700">
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div className="px-4 pb-4 sm:px-5">
                {filteredBoardItems.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/85 p-8 text-center">
                    <Sparkles size={20} className="mx-auto text-slate-300" />
                    <p className="mt-2 text-sm font-bold text-slate-500">
                      {boardItems.length === 0 ? '还没有已孵化宠物' : '当前场景还没有宠物'}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {boardItems.length === 0
                        ? '去投喂页完成孵化，就能在这里查看。'
                        : '可切换到「全部场景」查看已孵化的宠物。'}
                    </p>
                  </div>
                ) : (
                  <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden pb-1 scroll-hide touch-pan-x">
                    {filteredBoardItems.map((item, index) => {
                      const customPet = item.pet.theme === 'custom'
                        ? customPets.find((pet) => pet.id === item.pet.petId)
                        : null;
                      const legacyPet = item.pet.theme !== 'custom' && !isPetSpriteKey(item.pet.petId)
                        ? PETS.find((pet) => pet.id === item.pet.petId)
                        : null;

                      return (
                        <div
                          key={item.pet.instanceId}
                          className={cn(
                            'min-w-[86%] snap-center rounded-[24px] border p-3 sm:min-w-[58%]',
                            QUALITY_CARD_CLASS[item.pet.quality],
                          )}>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[10px] font-black text-slate-400">No.{String(index + 1).padStart(3, '0')}</p>
                            <div className="flex items-center gap-2">
                              <span className={cn('rounded-full px-2.5 py-0.5 text-[10px] font-black', QUALITY_BADGE_CLASS[item.pet.quality])}>
                                品质 · {QUALITY_LABEL[item.pet.quality]}
                              </span>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500">
                                {item.sceneLabel}
                              </span>
                            </div>
                          </div>

                          <div className="mt-2 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="truncate text-[15px] font-black text-slate-900">{item.title}</h4>
                              {editingId !== item.pet.instanceId && (
                                <button
                                  onClick={() => {
                                    setEditingId(item.pet.instanceId);
                                    setEditingName(item.pet.nickname ?? '');
                                  }}
                                  className="inline-flex h-6 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-black text-slate-500 transition-colors hover:bg-slate-50"
                                >
                                  <Pencil size={11} />
                                  改名
                                </button>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                                品种 · {item.speciesName}
                              </span>
                              <span className={cn(
                                'rounded-full border px-2 py-0.5 text-[10px] font-bold',
                                item.isDead ? 'border-slate-300 bg-slate-100 text-slate-500' : STATE_CLASS[item.pet.state],
                              )}>
                                {item.isDead ? '状态' : '形态'} · {item.stateLabel}
                              </span>
                            </div>
                            <div className="mt-1.5 space-y-1.5">
                              {[
                                {label: '健康', value: item.health, tip: item.healthLabel, tone: 'bg-emerald-500'},
                                {label: '饱腹', value: item.satiety, tip: item.satietyLabel, tone: 'bg-amber-500'},
                                {label: '心情', value: item.mood, tip: item.moodLabel, tone: 'bg-violet-500'},
                              ].map((metric) => {
                                const value = Math.max(0, Math.min(100, metric.value));
                                return (
                                  <div key={metric.label} className="space-y-1 rounded-lg px-0.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className={cn(
                                        'text-[10px] font-semibold',
                                        item.isDead ? 'text-slate-500' : 'text-slate-500',
                                      )}>
                                        {metric.label} · {metric.tip}
                                      </span>
                                      <span className={cn(
                                        'text-[10px] font-black tabular-nums',
                                        item.isDead ? 'text-slate-700' : 'text-slate-700',
                                      )}>
                                        {value}
                                      </span>
                                    </div>
                                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/80">
                                      <div
                                        className={cn('h-full rounded-full transition-[width] duration-300', metric.tone)}
                                        style={{width: `${value}%`}}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            {editingId === item.pet.instanceId && (
                              <div className="mt-2 flex items-center gap-1.5">
                                <input
                                  value={editingName}
                                  onChange={(event) => setEditingName(event.target.value)}
                                  maxLength={16}
                                  placeholder={item.speciesName}
                                  className="h-8 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300"
                                />
                                <button
                                  onClick={() => {
                                    onRename(item.pet.instanceId, editingName);
                                    setEditingId(null);
                                    setEditingName('');
                                  }}
                                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 text-[10px] font-black text-indigo-600 transition-colors hover:bg-indigo-100"
                                >
                                  <Check size={12} />
                                  保存
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingId(null);
                                    setEditingName('');
                                  }}
                                  className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-black text-slate-500 transition-colors hover:bg-slate-50"
                                >
                                  取消
                                </button>
                              </div>
                            )}
                          </div>

                          <div className={cn(
                            'relative mt-3 h-[122px] rounded-[18px] border border-white/80 shadow-inner',
                            item.isDead
                              ? 'bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(226,232,240,0.9))]'
                              : STATE_PREVIEW_CLASS[item.pet.state],
                          )}>
                            <div className="absolute inset-x-0 bottom-2 flex justify-center">
                              <div className="flex h-[104px] w-[104px] items-end justify-center overflow-visible">
                                {item.isDead ? (
                                  <GraveSprite size={48} className="drop-shadow-sm" />
                                ) : isPetSpriteKey(item.pet.petId) ? (
                                  (() => {
                                    const spriteOption = getPetSpriteOptionByKey(item.pet.petId);
                                    const action = resolveSpriteAction(item.pet.petId, item.pet.state);
                                    const previewZoom = getBoardPreviewZoom(item.pet.petId);
                                    const previewYOffset = getBoardPreviewYOffset(item.pet.petId);
                                    return spriteOption ? (
                                      <div
                                        className="flex h-full w-full items-end justify-center overflow-hidden"
                                        style={{transform: `translateZ(0)`}}
                                      >
                                        <div
                                          style={{
                                            transform: `translateY(${previewYOffset}px)`,
                                            transformOrigin: 'center bottom',
                                          }}
                                        >
                                          <div
                                            style={{
                                              transform: `scale(${previewZoom})`,
                                              transformOrigin: 'center bottom',
                                            }}
                                          >
                                            <SpriteActor
                                              spriteKey={spriteOption.key}
                                              action={action}
                                              scale={getBoardPreviewScale(item.pet.petId, action)}
                                              flipX={spriteOption.flipX}
                                              seed={index}
                                              ariaLabel={item.title}
                                              className="drop-shadow-[0_7px_12px_rgba(15,23,42,0.2)]"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    ) : null;
                                  })()
                                ) : customPet ? (
                                  <img
                                    src={customPet.image}
                                    alt={customPet.name}
                                    className="h-[104px] w-[104px] object-contain drop-shadow-[0_7px_12px_rgba(15,23,42,0.16)]"
                                  />
                                ) : (
                                  <span className="text-[56px] leading-none drop-shadow-sm">
                                    {item.pet.state === 'focus'
                                      ? legacyPet?.focus
                                      : item.pet.state === 'heal'
                                        ? legacyPet?.heal
                                        : item.pet.state === 'active'
                                          ? legacyPet?.active
                                          : legacyPet?.base}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              if (!window.confirm(`确认丢弃 ${item.title} 吗？`)) return;
                              onDiscard(item.pet.instanceId);
                            }}
                            className="mt-3 inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-rose-100 bg-rose-50 px-2.5 text-[11px] font-black text-rose-600 transition-colors hover:bg-rose-100"
                          >
                            <Trash2 size={13} />
                            丢弃
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      ) : null}
    </AnimatePresence>
    ,
    document.body,
  );
}
