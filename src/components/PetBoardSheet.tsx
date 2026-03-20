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
}

const STATE_LABEL: Record<CompletedPet['state'], string> = {
  base: '幼体',
  focus: '专注',
  heal: '治愈',
  active: '活力',
};

const QUALITY_LABEL: Record<PetQuality, string> = {
  common: '普通',
  rare: '稀有',
  epic: '史诗',
};

const QUALITY_CLASS: Record<PetQuality, string> = {
  common: 'bg-slate-100 text-slate-500',
  rare: 'bg-amber-50 text-amber-600',
  epic: 'bg-violet-50 text-violet-600',
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

const PREVIEW_STAGE_SIZE = 74;

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
              stateLabel: STATE_LABEL[pet.state],
              sceneLabel: THEME_LABEL[pet.theme],
            };
          }

          if (pet.theme === 'custom') {
            const customPet = customPets.find((item) => item.id === pet.petId);
            const speciesName = customPet?.name ?? '手绘宠物';
            return {
              pet,
              title: pet.nickname || speciesName,
              speciesName,
              stateLabel: STATE_LABEL[pet.state],
              sceneLabel: THEME_LABEL[pet.theme],
            };
          }

          const legacyPet = PETS.find((item) => item.id === pet.petId);
          const speciesName = legacyPet?.name ?? `宠物 ${pet.petId}`;
          return {
            pet,
            title: pet.nickname || speciesName,
            speciesName,
            stateLabel: STATE_LABEL[pet.state],
            sceneLabel: THEME_LABEL[pet.theme],
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
                          className="min-w-[86%] snap-center rounded-[24px] border border-slate-200/90 bg-white/95 p-3 shadow-sm sm:min-w-[58%]">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[10px] font-black text-slate-400">No.{String(index + 1).padStart(3, '0')}</p>
                            <div className="flex items-center gap-2">
                              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black', QUALITY_CLASS[item.pet.quality])}>
                                {QUALITY_LABEL[item.pet.quality]}
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
                              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-500">
                                形态 · {item.stateLabel}
                              </span>
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

                          <div className="relative mt-3 h-[104px] rounded-[18px] border border-slate-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(241,245,249,0.9))] shadow-inner">
                            <div className="absolute inset-x-0 bottom-2 flex justify-center">
                              <div className="flex h-[74px] w-[74px] items-end justify-center">
                                {isPetSpriteKey(item.pet.petId) ? (
                                  (() => {
                                    const spriteOption = getPetSpriteOptionByKey(item.pet.petId);
                                    const action = resolveSpriteAction(item.pet.petId, item.pet.state);
                                    const actionConfig = getPetSpriteConfigByKey(item.pet.petId, action);
                                    const frameWidth = actionConfig?.frameWidth ?? 32;
                                    const frameHeight = actionConfig?.frameHeight ?? 32;
                                    const scale = PREVIEW_STAGE_SIZE / Math.max(frameWidth, frameHeight);
                                    return spriteOption ? (
                                      <SpriteActor
                                        spriteKey={spriteOption.key}
                                        action={action}
                                        scale={scale}
                                        flipX={spriteOption.flipX}
                                        seed={index}
                                        ariaLabel={item.title}
                                        className="drop-shadow-[0_7px_12px_rgba(15,23,42,0.2)]"
                                      />
                                    ) : null;
                                  })()
                                ) : customPet ? (
                                  <img
                                    src={customPet.image}
                                    alt={customPet.name}
                                    className="h-[74px] w-[74px] object-contain drop-shadow-[0_7px_12px_rgba(15,23,42,0.16)]"
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
