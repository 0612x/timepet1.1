import React, {useMemo, useState} from 'react';
import {Award, CalendarCheck2, Cloud, Lock, Palette, ShieldCheck, Smile, Sparkles, Target, Utensils, Waves, Zap} from 'lucide-react';
import {ThemeType} from '../data/pets';
import {useStore} from '../store/useStore';
import {cn} from '../utils/cn';
import {formatZhDate, getDateKey, getSimulatedDate} from '../utils/date';
import {
  getPetSpriteOptionByKey,
  hasPetSpriteAction,
  PET_SPRITE_OPTIONS,
  PET_SPRITE_SCENE_LABELS,
  type PetSpriteAction,
} from '../data/petSprites';
import {SpriteActor} from '../components/SpriteActor';

const POKEDEX_TABS: Array<{theme: ThemeType; label: string; locked?: boolean}> = [
  {theme: 'A', label: '农场'},
  {theme: 'B', label: '深海', locked: true},
  {theme: 'custom', label: '手绘'},
];

const FARM_SPRITE_OPTIONS = PET_SPRITE_OPTIONS.filter((option) => option.scene === 'farm');

const STATE_CHIPS = [
  {state: 'focus', label: '专注'},
  {state: 'heal', label: '治愈'},
  {state: 'active', label: '活力'},
] as const;

function getDayAllocatedHours(dayAllocations?: Array<{hours: number}>) {
  if (!dayAllocations || dayAllocations.length === 0) return 0;
  return dayAllocations.reduce((sum, item) => sum + item.hours, 0);
}

function hasActivityHours(
  dayAllocations: Array<{hours: number; type: string}> | undefined,
  activityType: string,
  minimumHours = 0.5,
) {
  if (!dayAllocations || dayAllocations.length === 0) return false;
  return dayAllocations.some((item) => item.type === activityType && item.hours >= minimumHours);
}

export function PokedexView() {
  const {currentTheme, setCurrentTheme, unlockedPets, customPets, completedPets, allocations, simulatedDateOffset} = useStore();
  const [catalogMode, setCatalogMode] = useState<'pets' | 'badges'>('pets');
  const [selectedSpriteKey, setSelectedSpriteKey] = useState(FARM_SPRITE_OPTIONS[0]?.key ?? '');
  const [previewAction, setPreviewAction] = useState<PetSpriteAction>('idle');
  const [previewActionSeed, setPreviewActionSeed] = useState(0);

  const effectiveTheme: ThemeType = currentTheme === 'C' ? 'A' : currentTheme;
  const today = useMemo(() => formatZhDate(getSimulatedDate(simulatedDateOffset)), [simulatedDateOffset]);
  const farmEntries = useMemo(
    () =>
      FARM_SPRITE_OPTIONS.map((option, index) => {
        const unlockedStates = unlockedPets[option.key] || [];
        const hasBase = unlockedStates.includes('base');
        return {
          option,
          index,
          unlockedStates,
          hasBase,
        };
      }),
    [unlockedPets],
  );
  const farmUnlockedCount = useMemo(
    () => farmEntries.filter((entry) => entry.hasBase).length,
    [farmEntries],
  );
  const farmTotalCount = FARM_SPRITE_OPTIONS.length;
  const farmCompletionRate = farmTotalCount > 0 ? Math.round((farmUnlockedCount / farmTotalCount) * 100) : 0;

  const recordedDayCount = useMemo(
    () => Object.values(allocations).filter((day) => getDayAllocatedHours(day) > 0.01).length,
    [allocations],
  );
  const fullDayCount = useMemo(
    () => Object.values(allocations).filter((day) => getDayAllocatedHours(day) >= 23.99).length,
    [allocations],
  );
  const recentDateKeys = useMemo(
    () =>
      Array.from({length: 7}, (_, index) =>
        getDateKey(getSimulatedDate(simulatedDateOffset - (6 - index))),
      ),
    [simulatedDateOffset],
  );
  const recentRecordedDays = useMemo(
    () => recentDateKeys.filter((key) => getDayAllocatedHours(allocations[key]) > 0.01).length,
    [recentDateKeys, allocations],
  );
  const recentExerciseDays = useMemo(
    () => recentDateKeys.filter((key) => hasActivityHours(allocations[key], 'exercise', 0.5)).length,
    [recentDateKeys, allocations],
  );
  const recordStreak = useMemo(() => {
    let streak = 0;
    for (let index = 0; index < 120; index += 1) {
      const key = getDateKey(getSimulatedDate(simulatedDateOffset - index));
      const hasRecord = getDayAllocatedHours(allocations[key]) > 0.01;
      if (!hasRecord) break;
      streak += 1;
    }
    return streak;
  }, [allocations, simulatedDateOffset]);
  const farmOwnedCount = useMemo(
    () => completedPets.filter((pet) => pet.theme === 'A').length,
    [completedPets],
  );
  const farmRareOrEpicCount = useMemo(
    () => completedPets.filter((pet) => pet.theme === 'A' && (pet.quality === 'rare' || pet.quality === 'epic')).length,
    [completedPets],
  );
  const selectedSprite = getPetSpriteOptionByKey(selectedSpriteKey);

  const achievements = useMemo(
    () => [
      {
        id: 'farm-first',
        title: '初次邂逅',
        description: '解锁 1 只农场幻兽',
        unlocked: farmUnlockedCount >= 1,
        progress: `${Math.min(farmUnlockedCount, 1)}/1`,
        icon: <Sparkles size={14} />,
      },
      {
        id: 'farm-half',
        title: '收集半程',
        description: '农场解锁达到 50%',
        unlocked: farmUnlockedCount >= Math.max(1, Math.ceil(farmTotalCount * 0.5)),
        progress: `${farmUnlockedCount}/${Math.max(1, Math.ceil(farmTotalCount * 0.5))}`,
        icon: <Target size={14} />,
      },
      {
        id: 'farm-master',
        title: '农场图鉴师',
        description: '解锁全部农场幻兽',
        unlocked: farmTotalCount > 0 && farmUnlockedCount === farmTotalCount,
        progress: `${farmUnlockedCount}/${farmTotalCount}`,
        icon: <Award size={14} />,
      },
      {
        id: 'record-streak',
        title: '连续记录',
        description: '连续记录 3 天',
        unlocked: recordStreak >= 3,
        progress: `${Math.min(recordStreak, 3)}/3`,
        icon: <CalendarCheck2 size={14} />,
      },
      {
        id: 'record-week',
        title: '稳定习惯',
        description: '近 7 天记录 ≥ 5 天',
        unlocked: recentRecordedDays >= 5,
        progress: `${recentRecordedDays}/5`,
        icon: <ShieldCheck size={14} />,
      },
      {
        id: 'exercise-week',
        title: '活力节奏',
        description: '近 7 天运动 ≥ 3 天',
        unlocked: recentExerciseDays >= 3,
        progress: `${recentExerciseDays}/3`,
        icon: <Sparkles size={14} />,
      },
    ],
    [farmTotalCount, farmUnlockedCount, recordStreak, recentRecordedDays, recentExerciseDays],
  );
  const unlockedBadgeCount = useMemo(
    () => achievements.filter((item) => item.unlocked).length,
    [achievements],
  );

  const getThemeIcon = (theme: ThemeType, locked?: boolean) => {
    if (locked) return <Lock size={14} />;
    if (theme === 'A') return <Cloud size={14} />;
    if (theme === 'B') return <Waves size={14} />;
    return <Palette size={14} />;
  };

  const handleSelectTheme = (theme: ThemeType, locked?: boolean) => {
    if (locked) return;
    setCurrentTheme(theme);
  };
  const actionButtons: Array<{action: PetSpriteAction; label: string; icon: React.ReactNode}> = [
    {action: 'idle', label: '待机', icon: <Sparkles size={12} />},
    {action: 'move', label: '移动', icon: <Zap size={12} />},
    {action: 'feed', label: '投喂', icon: <Utensils size={12} />},
    {action: 'happy', label: '开心', icon: <Smile size={12} />},
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
      <header className="p-5 pb-2 z-10">
        <div>
          <p className="text-xs font-medium text-slate-400">{today}</p>
          <h1 className="text-2xl font-black tracking-tight text-slate-800">图鉴</h1>
        </div>
      </header>

      <div className="px-5 z-10">
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
          <button
            type="button"
            onClick={() => setCatalogMode('pets')}
            className={cn(
              'h-9 rounded-xl text-xs font-black tracking-[0.08em] transition-all',
              catalogMode === 'pets'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600',
            )}>
            幻兽图鉴
          </button>
          <button
            type="button"
            onClick={() => setCatalogMode('badges')}
            className={cn(
              'h-9 rounded-xl text-xs font-black tracking-[0.08em] transition-all',
              catalogMode === 'badges'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600',
            )}>
            成就徽章
          </button>
        </div>
      </div>

      {catalogMode === 'pets' ? (
        <div className="px-5 mt-3 mb-4 z-10">
          <div className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm scroll-hide">
            {POKEDEX_TABS.map((tab) => (
              <button
                key={tab.theme}
                onClick={() => handleSelectTheme(tab.theme, tab.locked)}
                disabled={tab.locked}
                className={cn(
                  'flex h-10 min-w-[84px] items-center justify-center gap-2 rounded-xl border px-4 text-xs font-black uppercase tracking-[0.12em] transition-all whitespace-nowrap',
                  effectiveTheme === tab.theme
                    ? 'border-transparent bg-indigo-600 text-white shadow-sm'
                    : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-white hover:text-slate-800',
                  tab.locked && 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300 hover:bg-slate-100 hover:text-slate-300',
                )}>
                {getThemeIcon(tab.theme, tab.locked)}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto scroll-hide p-5 pt-2 pb-24">
        <div className="space-y-6">
          {catalogMode === 'badges' ? (
            <>
              <section className="glass-card rounded-[30px] border-white/40 p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">成就总览</p>
                    <p className="mt-1 text-xs text-slate-500">图鉴成就与时间习惯分开展示。</p>
                  </div>
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-black text-indigo-600">
                    已达成 {unlockedBadgeCount}/{achievements.length}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 px-3 py-2.5">
                    <p className="text-[10px] font-black text-indigo-500">图鉴完成率</p>
                    <p className="mt-1 text-base font-black text-indigo-700">{farmCompletionRate}%</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-3 py-2.5">
                    <p className="text-[10px] font-black text-emerald-500">连续记录</p>
                    <p className="mt-1 text-base font-black text-emerald-700">{recordStreak} 天</p>
                  </div>
                  <div className="rounded-2xl border border-amber-100 bg-amber-50/70 px-3 py-2.5">
                    <p className="text-[10px] font-black text-amber-500">完整记录</p>
                    <p className="mt-1 text-base font-black text-amber-700">{fullDayCount} 天</p>
                  </div>
                </div>
              </section>

              <section className="glass-card rounded-[30px] border-white/40 p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">徽章墙</p>
                    <p className="mt-1 text-xs text-slate-500">收集与习惯双轨成长。</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">
                    累计记录 {recordedDayCount} 天
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {achievements.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        'rounded-2xl border px-3 py-2.5',
                        item.unlocked
                          ? 'border-emerald-100 bg-emerald-50/75 shadow-[0_8px_20px_rgba(16,185,129,0.12)]'
                          : 'border-slate-200 bg-slate-100 text-slate-400',
                      )}>
                      <div className="flex items-center justify-between gap-2">
                        <div className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-xl',
                          item.unlocked ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-300 text-slate-500',
                        )}>
                          {item.icon}
                        </div>
                        <span className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-black',
                          item.unlocked ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-300 text-slate-500',
                        )}>
                          {item.unlocked ? '已达成' : item.progress}
                        </span>
                      </div>
                      <p className={cn('mt-2 text-xs font-black', item.unlocked ? 'text-emerald-700' : 'text-slate-600')}>
                        {item.title}
                      </p>
                      <p className="mt-1 text-[10px] font-medium leading-4">{item.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : null}

          {catalogMode === 'pets' && effectiveTheme === 'B' ? (
            <div className="glass-card rounded-[30px] border-white/40 p-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500">
                <Lock size={18} />
              </div>
              <p className="text-sm font-black text-slate-700">深海图鉴暂未开放</p>
              <p className="mt-1 text-xs text-slate-400">农场素材先行接入，后续会同步开放深海。</p>
            </div>
          ) : null}

          {catalogMode === 'pets' && effectiveTheme !== 'custom' && effectiveTheme !== 'B' ? (
            <>
              <section className="glass-card rounded-[30px] border-white/40 p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">农场总览</p>
                    <p className="mt-1 text-xs text-slate-500">专注收集你的幻兽，也记录你的习惯成长。</p>
                  </div>
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-black text-indigo-600">
                    完成率 {farmCompletionRate}%
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 px-3 py-2.5">
                    <p className="text-[10px] font-black text-indigo-500">已解锁</p>
                    <p className="mt-1 text-base font-black text-indigo-700">{farmUnlockedCount}/{farmTotalCount}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-3 py-2.5">
                    <p className="text-[10px] font-black text-emerald-500">收集个体</p>
                    <p className="mt-1 text-base font-black text-emerald-700">{farmOwnedCount}</p>
                  </div>
                  <div className="rounded-2xl border border-amber-100 bg-amber-50/70 px-3 py-2.5">
                    <p className="text-[10px] font-black text-amber-500">高品质</p>
                    <p className="mt-1 text-base font-black text-amber-700">{farmRareOrEpicCount}</p>
                  </div>
                </div>
              </section>

              <section className="glass-card rounded-[30px] border-white/40 p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">测试宠物卡片</p>
                    <p className="mt-1 text-xs text-slate-500">点击小卡切换预览，再触发动作测试。</p>
                  </div>
                  {selectedSprite ? (
                    <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-black text-indigo-600">
                      {PET_SPRITE_SCENE_LABELS[selectedSprite.scene]} · {selectedSprite.label}
                    </span>
                  ) : null}
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 scroll-hide">
                  {FARM_SPRITE_OPTIONS.map((option) => {
                    const active = selectedSpriteKey === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => {
                          setSelectedSpriteKey(option.key);
                          setPreviewAction('idle');
                          setPreviewActionSeed((previous) => previous + 1);
                        }}
                        className={cn(
                          'shrink-0 rounded-2xl border px-2 py-2 transition-all',
                          active
                            ? 'border-indigo-200 bg-indigo-50 shadow-[0_8px_18px_rgba(99,102,241,0.16)]'
                            : 'border-slate-200 bg-white',
                        )}>
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/90">
                          <SpriteActor
                            spriteKey={option.key}
                            action="idle"
                            scale={Math.min((option.sceneScale ?? 2.3) * 0.45, 1.15)}
                            flipX={option.flipX}
                            ariaLabel={option.label}
                          />
                        </div>
                        <p className="mt-1.5 w-10 truncate text-center text-[10px] font-black text-slate-700">
                          {option.label}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 grid grid-cols-4 gap-2">
                  {actionButtons.map((item) => {
                    const available = selectedSpriteKey ? hasPetSpriteAction(selectedSpriteKey, item.action) : false;
                    const active = available && previewAction === item.action;

                    return (
                      <button
                        key={item.action}
                        type="button"
                        onClick={() => {
                          if (!available) return;
                          setPreviewAction(item.action);
                          setPreviewActionSeed((previous) => previous + 1);
                        }}
                        disabled={!available}
                        className={cn(
                          'flex h-9 items-center justify-center gap-1 rounded-xl border text-[10px] font-black transition-all',
                          !available && 'border-transparent bg-slate-100 text-slate-300',
                          available && (active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'),
                        )}>
                        {item.icon}
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 flex items-center justify-center rounded-2xl border border-slate-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(238,242,255,0.72))] py-3">
                  {selectedSprite ? (
                    <SpriteActor
                      spriteKey={selectedSprite.key}
                      action={previewAction}
                      seed={previewActionSeed}
                      scale={Math.min(selectedSprite.sceneScale ?? 2.3, 2.1)}
                      flipX={selectedSprite.flipX}
                      ariaLabel={selectedSprite.label}
                      className="drop-shadow-[0_8px_16px_rgba(15,23,42,0.2)]"
                    />
                  ) : (
                    <p className="text-xs text-slate-400">暂无可预览素材</p>
                  )}
                </div>
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">农场图鉴</p>
                  <p className="text-[10px] font-black text-slate-400">未解锁信息已隐藏</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {farmEntries.map(({option, index, unlockedStates, hasBase}) => (
                    <div
                      key={option.key}
                      className={cn(
                        'glass-card rounded-[24px] border-white/40 p-3 shadow-sm transition-all',
                        !hasBase && 'bg-slate-100/70',
                      )}>
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            No.{String(index + 1).padStart(3, '0')}
                          </p>
                          <p className={cn(
                            'truncate text-sm font-black',
                            hasBase ? 'text-slate-800' : 'tracking-[0.22em] text-slate-400',
                          )}>
                            {hasBase ? option.label : '???'}
                          </p>
                        </div>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-black',
                            hasBase ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-700 text-slate-300',
                          )}>
                          {hasBase ? '已解锁' : '未解锁'}
                        </span>
                      </div>

                      <div className="rounded-2xl border border-slate-100 bg-white/80 p-2.5 shadow-inner shadow-white/80">
                        {hasBase ? (
                          <div className="flex h-[74px] items-center justify-center">
                            <SpriteActor
                              spriteKey={option.key}
                              action="idle"
                              scale={Math.min(option.sceneScale ?? 2.3, 2.2)}
                              flipX={option.flipX}
                              ariaLabel={option.label}
                              className="drop-shadow-[0_8px_16px_rgba(15,23,42,0.2)]"
                            />
                          </div>
                        ) : (
                          <div className="flex h-[74px] flex-col items-center justify-center text-slate-400">
                            <Lock size={16} />
                            <p className="mt-1 text-[10px] font-black">待发现</p>
                          </div>
                        )}
                      </div>

                      {hasBase ? (
                        <div className="mt-2 grid grid-cols-3 gap-1.5">
                          {STATE_CHIPS.map((item) => (
                            (() => {
                              const unlocked = unlockedStates.includes(item.state);
                              const unlockedStyle = item.state === 'focus'
                                ? 'border-indigo-300 bg-indigo-100 text-indigo-700 shadow-[0_4px_12px_rgba(99,102,241,0.15)]'
                                : item.state === 'heal'
                                  ? 'border-emerald-300 bg-emerald-100 text-emerald-700 shadow-[0_4px_12px_rgba(16,185,129,0.15)]'
                                  : 'border-amber-300 bg-amber-100 text-amber-700 shadow-[0_4px_12px_rgba(245,158,11,0.15)]';

                              return (
                                <div
                                  key={item.state}
                                  className={cn(
                                    'flex h-6 items-center justify-center rounded-xl border px-1 text-[10px] font-black whitespace-nowrap leading-none',
                                    unlocked
                                      ? unlockedStyle
                                      : 'border-slate-300 bg-slate-200/85 text-slate-500 opacity-85',
                                  )}>
                                  {item.label}
                                </div>
                              );
                            })()
                          ))}
                        </div>
                      ) : (
                        <div className="mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-100 px-2 py-1.5 text-center text-[10px] font-medium text-slate-500">
                          解锁后显示动作与形态
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : null}

          {catalogMode === 'pets' && effectiveTheme === 'custom' ? (
            customPets.length === 0 ? (
              <div className="p-12 text-center glass-card rounded-[32px] border-dashed border-slate-200">
                <Palette size={48} className="mx-auto text-slate-200 mb-4" />
                <p className="text-xs font-black text-slate-300 uppercase tracking-widest">还没有手绘宠物哦</p>
                <p className="text-[10px] text-slate-400 mt-1">快去孵化一个吧！</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {customPets.map((pet) => {
                  const unlocked = unlockedPets[pet.id] || [];
                  const state = unlocked.find((value) => value !== 'base') || 'base';

                  return (
                    <div key={pet.id} className="glass-card rounded-[32px] p-4 flex flex-col items-center border-white/40 group transition-all hover:scale-[1.02]">
                      <div className="w-full flex justify-between items-center mb-3">
                        <span className="font-black text-slate-800 text-[10px] truncate max-w-[60%]">{pet.name}</span>
                        <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-500 uppercase tracking-tighter">
                          {state === 'focus' ? '专注' : state === 'heal' ? '治愈' : state === 'active' ? '活力' : '基础'}
                        </span>
                      </div>
                      <div className="w-full aspect-square bg-white/50 rounded-2xl flex items-center justify-center p-3 border border-white/50 shadow-inner overflow-hidden">
                        <img src={pet.image} alt={pet.name} className="max-w-full max-h-full object-contain drop-shadow-md" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
