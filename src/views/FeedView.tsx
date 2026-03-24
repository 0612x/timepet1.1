import React, { useEffect, useMemo, useState } from 'react';
import {CompleteEggResult, CompletedPet, CustomPet, useStore} from '../store/useStore';
import {PETS} from '../data/pets';
import { cn } from '../utils/cn';
import { DrawingModal } from '../components/DrawingModal';
import { CheckCircle2, ChevronDown, ChevronUp, Coins, Dice5, PenTool, Utensils, Wand2, X } from 'lucide-react';
import {ACTIVITY_CONFIG, getActivityConfig} from '../constants/activities';
import {formatZhDate, getDateKey, getSimulatedDate} from '../utils/date';
import {getPetSpriteOptionByKey, hasPetSpriteAction, type PetSpriteAction} from '../data/petSprites';
import {SpriteActor} from '../components/SpriteActor';
import {EGG_TIERS, getEggTierById, getEggTierQualityEntries} from '../data/eggs';
import {EggActor} from '../components/EggActor';
import {getAllEggSpritePaths, getEggSpriteOffsetY, getEggSpriteScale, type EggSpriteAction} from '../data/eggSprites';
import {
  getPetQualityBadgeClass,
  getPetQualityDescription,
  getPetQualityLabel,
} from '../utils/petQuality';
import {preloadSpritePaths} from '../utils/spriteAssetLoader';

function getAllocationCoinPreview(hours: number) {
  return Math.max(0, Math.round(hours * 2));
}

function formatQualityRateSummary(
  entries: Array<{label: string; chance: number}>,
) {
  return entries.map((entry) => `${entry.label}${entry.chance}%`).join(' / ');
}

function getEggTrendSummary(progress: {focus: number; heal: number; active: number}) {
  const entries = [
    {key: 'focus', label: '专注', value: progress.focus},
    {key: 'heal', label: '治愈', value: progress.heal},
    {key: 'active', label: '活力', value: progress.active},
  ] as const;
  const maxValue = Math.max(...entries.map((item) => item.value));
  const top = entries.filter((item) => item.value === maxValue && maxValue > 0);

  if (top.length !== 1) {
    return {
      label: maxValue > 0 ? '均衡' : '未成形',
      description: maxValue > 0 ? '当前没有明显偏向，最后一次补入的记录更关键。' : '还没有明显倾向，先投喂记录块吧。',
    };
  }

  const selected = top[0];
  return {
    label: selected.label,
    description: `${selected.label}时长领先，破壳后更容易呈现这条成长倾向。`,
  };
}

type PendingHatchAction =
  | {mode: 'random'; nickname: string}
  | {mode: 'custom'; customPet: CustomPet};

export function FeedView() {
  const {
    currentEgg,
    eggInventory,
    allocations,
    coins,
    feedEgg,
    completeEgg,
    activateEgg,
    dailyCoinLedger,
    simulatedDateOffset,
    setCurrentTab,
    setCurrentTheme,
  } = useStore();
  const [isShaking, setIsShaking] = useState(false);
  const [showDrawingModal, setShowDrawingModal] = useState(false);
  const [showRandomHatchModal, setShowRandomHatchModal] = useState(false);
  const [pendingRandomName, setPendingRandomName] = useState('');
  const [pendingHatchAction, setPendingHatchAction] = useState<PendingHatchAction | null>(null);
  const [hatchedPreview, setHatchedPreview] = useState<CompleteEggResult | null>(null);
  const [eggLibraryExpanded, setEggLibraryExpanded] = useState(false);

  const today = useMemo(() => {
    return formatZhDate(getSimulatedDate(simulatedDateOffset));
  }, [simulatedDateOffset]);

  const todayStr = getDateKey(getSimulatedDate(simulatedDateOffset));
  const todayAllocs = allocations[todayStr] || [];
  const unusedAllocs = todayAllocs.filter(a => !a.used);
  const todayCoins = dailyCoinLedger[todayStr] ?? 0;
  const totalEggStock = EGG_TIERS.reduce((sum, tier) => sum + (eggInventory[tier.id] ?? 0), 0);

  const currentEggTier = currentEgg ? getEggTierById(currentEgg.tierId) : null;
  const hasCurrentEgg = Boolean(currentEgg);
  const currentEggQualityEntries = currentEggTier ? getEggTierQualityEntries(currentEggTier.id) : [];
  const totalProgress = currentEgg
    ? currentEgg.progress.focus + currentEgg.progress.heal + currentEgg.progress.active
    : 0;
  const maxProgress = currentEggTier?.totalHours ?? 0;
  const remainingHours = Math.max(0, maxProgress - totalProgress);
  const eggTrend = currentEgg ? getEggTrendSummary(currentEgg.progress) : null;
  const isEggReady = currentEgg?.stage === 'ready';
  const isCracking = pendingHatchAction !== null;
  const eggAnimation: EggSpriteAction = isEggReady ? 'ready' : 'idle';
  const displayQuality = isEggReady ? currentEgg?.quality : null;
  const canStartHatch = Boolean(currentEgg && isEggReady && !isCracking);

  const handleFeed = (id: string) => {
    if (!currentEgg || totalProgress >= maxProgress || isCracking) return;
    
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
    
    feedEgg(todayStr, id);
  };

  const RANDOM_NAME_PREFIX = ['小', '团', '星', '云', '糯', '暖', '泡', '栗', '豆', '阿'];
  const RANDOM_NAME_SUFFIX = ['果', '团', '球', '糖', '芽', '咪', '宝', '仔', '丸', '可'];
  const createRandomName = () => {
    const left = RANDOM_NAME_PREFIX[Math.floor(Math.random() * RANDOM_NAME_PREFIX.length)];
    const right = RANDOM_NAME_SUFFIX[Math.floor(Math.random() * RANDOM_NAME_SUFFIX.length)];
    return `${left}${right}${Math.floor(Math.random() * 90 + 10)}`;
  };

  const handleOpenRandomHatchModal = () => {
    if (!canStartHatch) return;
    setPendingRandomName('');
    setShowRandomHatchModal(true);
  };

  const handleConfirmRandomHatch = () => {
    if (!canStartHatch) return;
    const finalName = pendingRandomName.trim() || createRandomName();
    setShowRandomHatchModal(false);
    setPendingRandomName('');
    setPendingHatchAction({mode: 'random', nickname: finalName});
  };

  const handleGoToSceneAfterHatch = () => {
    if (!hatchedPreview) return;
    const hatchTheme = hatchedPreview.pet.theme;
    setHatchedPreview(null);
    setCurrentTheme(hatchTheme === 'B' ? 'A' : hatchTheme);
    setCurrentTab('scene');
  };

  const handleCustomHatch = (name: string, image: string) => {
    if (!canStartHatch) return;
    const customPet: CustomPet = {
      id: 'custom_' + Date.now(),
      name,
      image
    };
    setShowDrawingModal(false);
    setPendingHatchAction({mode: 'custom', customPet});
  };

  const getSpriteActionByState = (spriteKey: string, state: CompletedPet['state']): PetSpriteAction => {
    const preferredAction: PetSpriteAction =
      state === 'focus'
        ? 'move'
        : state === 'heal'
          ? 'feed'
          : state === 'active'
            ? 'happy'
            : 'idle';
    if (hasPetSpriteAction(spriteKey, preferredAction)) return preferredAction;
    if (hasPetSpriteAction(spriteKey, 'move')) return 'move';
    if (hasPetSpriteAction(spriteKey, 'happy')) return 'happy';
    if (hasPetSpriteAction(spriteKey, 'feed')) return 'feed';
    return 'idle';
  };

  const getActivityIcon = (type: string) => {
    return getActivityConfig(type as typeof ACTIVITY_CONFIG[number]['type'])?.icon ?? <Utensils size={16} />;
  };

  const getActivityColor = (type: string) => {
    return getActivityConfig(type as typeof ACTIVITY_CONFIG[number]['type'])?.baseColor ?? 'bg-slate-500';
  };

  useEffect(() => {
    setEggLibraryExpanded(!hasCurrentEgg);
  }, [hasCurrentEgg]);

  useEffect(() => {
    preloadSpritePaths(getAllEggSpritePaths()).catch(() => undefined);
  }, []);

  const handleEggCrackComplete = () => {
    if (!pendingHatchAction) return;

    const action = pendingHatchAction;
    setPendingHatchAction(null);

    if (action.mode === 'random') {
      const result = completeEgg(undefined, action.nickname);
      if (!result) return;
      setHatchedPreview(result);
      return;
    }

    const result = completeEgg(action.customPet);
    if (!result) return;
    setCurrentTheme('custom');
    setCurrentTab('scene');
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto scroll-hide bg-[#f7f0e2] pb-24">
      <header className="p-5 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[#9e7a4e] text-xs font-medium">{today}</p>
            <h1 className="text-2xl font-black tracking-tight text-[#5c4023]">孵化室</h1>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border-[2px] border-[#d8bf8d] bg-[linear-gradient(180deg,#fff1c7,#f7d98b)] px-3 py-1 text-[11px] font-black text-[#73480d] shadow-[0_2px_0_#dbb466]">
            <Coins size={13} />
            {coins} · 今日 +{todayCoins}
          </div>
        </div>
      </header>

      <main className="px-5 space-y-5">
        <section className="rounded-[30px] border-[2px] border-[#b78e5f] bg-[linear-gradient(180deg,#fff7df,#f1ddb6)] p-3 shadow-[0_4px_0_#d6b17a,0_14px_26px_rgba(84,57,28,0.12)]">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#a07a4b]">当前孵化</p>
              <h2 className="mt-1 text-xl font-black text-[#5c4023]">
                {currentEggTier ? currentEggTier.label : '孵化槽空闲'}
              </h2>
              {currentEggTier ? (
                <p className="mt-1 text-[12px] font-medium text-[#8d6b43]">
                  {isEggReady ? '蛋壳已经成熟，选择孵化方式后破壳' : `累计 ${currentEggTier.totalHours}h 后进入待破壳`}
                </p>
              ) : (
                <p className="mt-1 text-[12px] font-medium text-[#8d6b43]">先放入一枚蛋开始孵化</p>
              )}
            </div>
            {currentEggTier ? (
              <div className="rounded-[18px] border-[2px] border-[#d7bc8c] bg-[#fff7e3] px-3.5 py-2 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#a07a4b]">
                  {isEggReady ? '当前状态' : '剩余时间'}
                </p>
                <p className="mt-1 text-sm font-black text-[#5c4023]">
                  {isEggReady ? '待破壳' : `${remainingHours.toFixed(1)}h`}
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-2.5 grid gap-3 lg:grid-cols-[124px_minmax(0,1fr)]">
            <div
              className={cn(
                'flex min-h-[122px] items-center justify-center rounded-[22px] border-[2px] border-[#d7bc8c] bg-[#fff8ea] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-300',
                isShaking && 'animate-shake',
              )}>
              {!currentEgg ? (
                <div className="text-center">
                  <div className="rounded-[16px] border-[2px] border-dashed border-[#ddc8a2] bg-white/55 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                    <p className="text-[13px] font-black text-slate-700">空培育槽</p>
                    <p className="mt-1 text-[10px] font-medium text-[#9a7b55]">从蛋仓放入一枚蛋开始孵化</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center">
                  <div
                    style={{
                      transform: `translateY(${getEggSpriteOffsetY(currentEgg.tierId, 'slot')}px)`,
                    }}>
                    <EggActor
                      tierId={currentEgg.tierId}
                      animation={eggAnimation}
                      scale={getEggSpriteScale(currentEgg.tierId, 'slot')}
                      playOnce={isCracking}
                      onComplete={handleEggCrackComplete}
                      ariaLabel={currentEggTier?.label ?? '蛋'}
                      className="drop-shadow-[0_14px_18px_rgba(92,64,35,0.18)]"
                    />
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="rounded-full border border-[#ead7b1] bg-white px-2.5 py-1 text-[9px] font-black text-[#7a5f39]">
                      {isCracking ? '破壳中' : isEggReady ? '待破壳' : '孵化中'}
                    </span>
                    {displayQuality ? (
                      <span className={cn('rounded-full border px-2.5 py-1 text-[9px] font-black', getPetQualityBadgeClass(displayQuality))}>
                        {getPetQualityLabel(displayQuality)}
                      </span>
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {currentEgg ? (
                <div className="rounded-[22px] border-[2px] border-[#d7bc8c] bg-[#fff8e8] px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[#ead7b1] bg-white px-2.5 py-1 text-[9px] font-black text-[#7a5f39]">
                      倾向 {eggTrend?.label ?? '未成形'}
                    </span>
                    <span className="rounded-full border border-[#ead7b1] bg-white px-2.5 py-1 text-[9px] font-black text-[#7a5f39]">
                      {isEggReady ? '阶段 待破壳' : '阶段 孵化中'}
                    </span>
                    <span className="rounded-full border border-[#ead7b1] bg-white px-2.5 py-1 text-[9px] font-black text-[#7a5f39]">
                      概率 {formatQualityRateSummary(currentEggQualityEntries)}
                    </span>
                    {displayQuality && (
                      <span className={cn('rounded-full border px-2.5 py-1 text-[9px] font-black', getPetQualityBadgeClass(displayQuality))}>
                        {getPetQualityLabel(displayQuality)}
                      </span>
                    )}
                  </div>

                  <div className="mt-2">
                    <div className="flex items-end justify-between gap-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#a07a4b]">总体进度</p>
                      <p className="text-sm font-black text-[#5c4023]">{totalProgress.toFixed(1)} / {maxProgress}h</p>
                    </div>
                    <div className="mt-1.5 h-2.5 overflow-hidden rounded-full border border-[#ead7b1] bg-[#f7edd6] p-0.5">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#d7892b,#e9b44a,#f4d37a)] shadow-sm transition-all duration-1000"
                        style={{ width: `${maxProgress > 0 ? (totalProgress / maxProgress) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {[
                      {label: '专注', value: currentEgg.progress.focus, tone: 'bg-rose-300'},
                      {label: '治愈', value: currentEgg.progress.heal, tone: 'bg-sky-300'},
                      {label: '活力', value: currentEgg.progress.active, tone: 'bg-emerald-300'},
                    ].map((item) => (
                      <div key={item.label} className="rounded-[14px] border border-[#ead7b1] bg-white/68 px-2.5 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[10px] font-black text-[#6a5333]">{item.label}</p>
                            <p className="mt-0.5 text-[9px] font-black text-[#9a7b55]">{item.value}h</p>
                          </div>
                          <div className="flex h-11 w-3 shrink-0 items-end overflow-hidden rounded-[5px] bg-[#f3ead7]">
                            <div
                              className={cn('w-full rounded-[5px] transition-all duration-500', item.tone)}
                              style={{height: `${Math.max(12, Math.min(100, (item.value / Math.max(maxProgress, 1)) * 100))}%`}}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-[22px] border-[2px] border-dashed border-[#d7bc8c] bg-[#fff8e8] px-4 py-3 text-[12px] font-medium leading-5 text-[#8d6b43]">
                  没有蛋时，先去首页做今日首次分配，能直接拿到 50 金币。
                </div>
              )}

              {isEggReady ? (
                <div className="space-y-3 rounded-[22px] border-[2px] border-[#c9d9a1] bg-[#eef8d5] p-4 shadow-[0_3px_0_#dcebb8]">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#4e6a1f]">待破壳</p>
                    <p className="mt-1 text-[11px] font-medium leading-5 text-[#617830]">
                      品质和成长倾向已经锁定，现在再决定是随机孵化，还是亲手绘制。
                    </p>
                  </div>
                  {displayQuality ? (
                    <div className="rounded-2xl border border-[#d8e7b4] bg-white/80 px-4 py-3">
                      <p className="text-xs font-black text-[#4e6a1f]">
                        {getPetQualityLabel(displayQuality)}品质
                      </p>
                      <p className="mt-1 text-[11px] font-medium leading-5 text-[#617830]">
                        {getPetQualityDescription(displayQuality)}
                      </p>
                    </div>
                  ) : null}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleOpenRandomHatchModal}
                      disabled={!canStartHatch}
                      className={cn(
                        'flex min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border-[2px] px-3 py-3 text-[12px] font-black transition-all active:scale-95',
                        canStartHatch
                          ? 'border-[#d7bc8c] bg-white text-[#7a5f39]'
                          : 'border-[#d7c39a] bg-[#ebe0c2] text-[#b49b75]',
                      )}
                    >
                      <Wand2 size={18} />
                      {isCracking ? '破壳中' : '随机孵化'}
                    </button>
                    <button
                      onClick={() => canStartHatch && setShowDrawingModal(true)}
                      disabled={!canStartHatch}
                      className={cn(
                        'flex min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border-[2px] px-3 py-3 text-[12px] font-black transition-all active:scale-95',
                        canStartHatch
                          ? 'border-[#a36b1e] bg-[linear-gradient(180deg,#ffd968,#f2ae2b)] text-[#654008] shadow-[0_2px_0_#cb8918]'
                          : 'border-[#d7c39a] bg-[#ebe0c2] text-[#b49b75] shadow-none',
                      )}
                    >
                      <PenTool size={18} />
                      {isCracking ? '破壳中' : '亲手绘制'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between gap-3 px-1">
            <h3 className="text-xs font-black uppercase tracking-widest text-[#a07a4b]">今日记录块</h3>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#8d6b43]">
              {currentEgg ? (isEggReady ? '先确认破壳' : '点击投喂') : '先放入一枚蛋'}
            </span>
          </div>

          {!currentEgg ? (
            <div className="rounded-[28px] border-[2px] border-dashed border-[#d7bc8c] bg-[#fff8e8] p-9 text-center">
              <p className="text-xs font-bold text-[#8d6b43]">孵化室空闲中，先从蛋仓放入一枚蛋吧。</p>
            </div>
          ) : isEggReady ? (
            <div className="rounded-[28px] border-[2px] border-dashed border-[#d7bc8c] bg-[#fff8e8] p-9 text-center">
              <p className="text-xs font-bold text-[#8d6b43]">这枚蛋已经成熟，先完成破壳再开始下一轮投喂。</p>
            </div>
          ) : unusedAllocs.length === 0 ? (
            <div className="rounded-[28px] border-[2px] border-dashed border-[#d7bc8c] bg-[#fff8e8] p-9 text-center">
              <p className="text-xs font-bold text-[#b4946f]">没有可投喂的记录块了，去记录时间吧。</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {unusedAllocs.map((alloc) => (
                <button
                  key={alloc.id}
                  onClick={() => handleFeed(alloc.id)}
                  className="group rounded-[22px] border-[2px] border-[#d7bc8c] bg-[#fff8e8] p-3 text-left shadow-[0_3px_0_#e3c79a] transition-all hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-white text-white shadow-sm transition-all group-hover:scale-105 group-active:scale-95",
                      getActivityColor(alloc.type)
                    )}>
                      {getActivityIcon(alloc.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-black text-[#5c4023]">
                        {getActivityConfig(alloc.type as typeof ACTIVITY_CONFIG[number]['type'])?.label ?? '记录'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="rounded-full border border-[#d8e7b4] bg-[#eef8d5] px-2.5 py-1 text-[10px] font-black text-[#4e6a1f]">
                      +{getAllocationCoinPreview(alloc.hours)} 金币
                    </span>
                    <span className="text-[10px] font-black text-[#8d6b43]">点击投喂</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[30px] border-[2px] border-[#b78e5f] bg-[linear-gradient(180deg,#fff7df,#f1ddb6)] p-5 shadow-[0_4px_0_#d6b17a,0_14px_26px_rgba(84,57,28,0.12)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-[#a07a4b]">蛋仓</h3>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-[#d9bf8f] bg-white px-3 py-1 text-[10px] font-black text-[#7a5f39]">
                已存 {totalEggStock} 枚
              </span>
              <button
                type="button"
                onClick={() => setEggLibraryExpanded((previous) => !previous)}
                className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-[10px] border-[2px] border-[#d7bc8c] bg-[#fff8e8] px-3 text-[11px] font-black text-[#7a5f39] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                {eggLibraryExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {eggLibraryExpanded ? '收起' : '展开'}
              </button>
            </div>
          </div>

          {eggLibraryExpanded ? (
            <div className="grid gap-3">
              {EGG_TIERS.map((tier) => {
                const stock = eggInventory[tier.id] ?? 0;
                const canActivate = !currentEgg && stock > 0;
                const qualityEntries = getEggTierQualityEntries(tier.id);
                return (
                  <div
                    key={tier.id}
                    className="rounded-[24px] border-[2px] border-[#d7bc8c] bg-[#fff8e8] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                    <div className="flex gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[16px] border-[2px] border-[#d7bc8c] bg-white">
                        <div
                          style={{
                            transform: `translateY(${getEggSpriteOffsetY(tier.id, 'library')}px)`,
                          }}>
                          <EggActor
                            tierId={tier.id}
                            animation="static"
                            scale={getEggSpriteScale(tier.id, 'library', 'static')}
                            ariaLabel={tier.label}
                          />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-black text-[#5c4023]">{tier.label}</p>
                          <span className="rounded-full border border-[#ead7b1] bg-white px-2 py-0.5 text-[10px] font-black text-[#7a5f39]">
                            {tier.totalHours}h
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] font-medium text-[#8d6b43]">{tier.description}</p>
                        <p className="mt-1.5 text-[10px] font-black text-[#7a5f39]">
                          {formatQualityRateSummary(qualityEntries)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="rounded-full border border-[#ead7b1] bg-white px-2.5 py-1 text-[10px] font-black text-[#7a5f39]">
                        蛋库 {stock}
                      </span>
                      <button
                        type="button"
                        disabled={!canActivate}
                        onClick={() => activateEgg(tier.id)}
                        className={cn(
                          'min-w-[96px] whitespace-nowrap rounded-[10px] border-[2px] px-3 py-2 text-[11px] font-black transition-all active:scale-[0.98]',
                          canActivate
                            ? 'border-[#a36b1e] bg-[linear-gradient(180deg,#ffd968,#f2ae2b)] text-[#654008] shadow-[0_2px_0_#cb8918]'
                            : 'border-[#d7c39a] bg-[#ebe0c2] text-[#b49b75] shadow-none',
                        )}>
                        {currentEgg ? '培育中' : stock > 0 ? '放入孵化室' : '去商店购买'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[22px] border-[2px] border-[#d7bc8c] bg-[#fff8e8] px-4 py-3 text-[12px] font-medium text-[#8d6b43]">
              蛋仓已收起，需要更换下一枚蛋时再展开即可。
            </div>
          )}
        </section>
      </main>
      
      {showDrawingModal && (
        <DrawingModal 
          onClose={() => setShowDrawingModal(false)} 
          onSave={handleCustomHatch} 
        />
      )}

      {showRandomHatchModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="glass-card w-full max-w-md rounded-3xl border border-white/50 bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">随机孵化命名</h3>
              <button
                onClick={() => setShowRandomHatchModal(false)}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
            <p className="mt-1 text-xs font-medium text-slate-500">
              可以自定义名字；留空也会自动随机生成。
            </p>

            <div className="mt-4 space-y-2">
              <input
                type="text"
                value={pendingRandomName}
                onChange={(event) => setPendingRandomName(event.target.value)}
                placeholder="给新宠物起个名字（可选）"
                maxLength={16}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-300"
              />
              <button
                onClick={() => setPendingRandomName(createRandomName())}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50 px-3 text-[11px] font-black text-indigo-600 transition-all hover:bg-indigo-100 active:scale-[0.98]">
                <Dice5 size={14} />
                随机名字
              </button>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setShowRandomHatchModal(false)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-black text-slate-500 transition-colors hover:bg-slate-50">
                取消
              </button>
              <button
                onClick={handleConfirmRandomHatch}
                className="flex-1 rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-black text-white shadow-lg shadow-indigo-200 transition-colors hover:bg-indigo-700">
                确认随机孵化
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingHatchAction && currentEgg && (
        <div className="fixed inset-0 z-[111] flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-[32px] border-[2px] border-[#b78e5f] bg-[linear-gradient(180deg,#fff7df,#f1ddb6)] p-5 shadow-[0_4px_0_#d6b17a,0_20px_32px_rgba(84,57,28,0.22)]">
            <div className="text-center">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#a07a4b]">正在破壳</p>
              <h3 className="mt-1 text-xl font-black text-[#5c4023]">{currentEggTier?.label ?? '蛋'}</h3>
              <p className="mt-1 text-[12px] font-medium text-[#8d6b43]">
                蛋壳正在裂开，新的小家伙马上出现。
              </p>
            </div>

            <div className="mt-4 flex min-h-[188px] items-center justify-center rounded-[24px] border-[2px] border-[#d7bc8c] bg-[#fff8ea] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
              <EggActor
                tierId={currentEgg.tierId}
                animation="crack"
                scale={getEggSpriteScale(currentEgg.tierId, 'slot', 'crack')}
                playOnce
                onComplete={handleEggCrackComplete}
                ariaLabel={`${currentEggTier?.label ?? '蛋'} 破壳动画`}
                className="drop-shadow-[0_14px_18px_rgba(92,64,35,0.16)]"
              />
            </div>
          </div>
        </div>
      )}

      {hatchedPreview && (
        <div className="fixed inset-0 z-[112] flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-[32px] border-[2px] border-[#b78e5f] bg-[linear-gradient(180deg,#fff7df,#f1ddb6)] p-5 shadow-[0_4px_0_#d6b17a,0_20px_32px_rgba(84,57,28,0.22)]">
            <div className="text-center">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#d8e7b4] bg-[#eef8d5] px-3 py-1 text-[11px] font-black text-[#4e6a1f]">
                <CheckCircle2 size={14} />
                孵化成功
              </div>
              <h3 className="mt-2 text-xl font-black text-[#5c4023]">
                {hatchedPreview.pet.nickname || '新宠物'} 已加入
              </h3>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                <span className={cn('rounded-full border px-2.5 py-1 text-[10px] font-black', getPetQualityBadgeClass(hatchedPreview.pet.quality))}>
                  {getPetQualityLabel(hatchedPreview.pet.quality)}
                </span>
                <span className="rounded-full border border-[#ead7b1] bg-white px-2.5 py-1 text-[10px] font-black text-[#7a5f39]">
                  {hatchedPreview.pet.state === 'focus'
                    ? '专注倾向'
                    : hatchedPreview.pet.state === 'heal'
                      ? '治愈倾向'
                      : hatchedPreview.pet.state === 'active'
                        ? '活力倾向'
                        : '基础倾向'}
                </span>
              </div>
              <p className="mt-2 text-[12px] font-medium leading-5 text-[#8d6b43]">
                {getPetQualityDescription(hatchedPreview.pet.quality)}
              </p>
            </div>

            {hatchedPreview.rewardLines.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2 rounded-[18px] border-[2px] border-[#d7bc8c] bg-[#fff8ea] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                {hatchedPreview.rewardLines.map((item) => (
                  <span
                    key={`${item.label}-${item.amount}`}
                    className="inline-flex items-center gap-1 rounded-full border border-[#d8e7b4] bg-[#eef8d5] px-2.5 py-1 text-[10px] font-black text-[#4e6a1f]">
                    <Coins size={11} />
                    {item.label} +{item.amount}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-4 rounded-[24px] border-[2px] border-[#d7bc8c] bg-[#fff8ea] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
              {(() => {
                const option = getPetSpriteOptionByKey(hatchedPreview.pet.petId);
                const legacy = PETS.find((pet) => pet.id === hatchedPreview.pet.petId);
                return option ? (
                  <div className="flex min-h-[112px] items-center justify-center">
                    <SpriteActor
                      spriteKey={option.key}
                      action={getSpriteActionByState(option.key, hatchedPreview.pet.state)}
                      scale={Math.min(option.sceneScale ?? 2.3, 2.35)}
                      flipX={option.flipX}
                      ariaLabel={option.label}
                    />
                  </div>
                ) : (
                  <div className="flex min-h-[112px] items-center justify-center text-6xl">
                    {hatchedPreview.pet.state === 'focus'
                      ? legacy?.focus
                      : hatchedPreview.pet.state === 'heal'
                        ? legacy?.heal
                        : hatchedPreview.pet.state === 'active'
                          ? legacy?.active
                          : legacy?.base || '🐾'}
                  </div>
                );
              })()}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setHatchedPreview(null)}
                className="flex-1 rounded-2xl border-[2px] border-[#d7bc8c] bg-white px-3 py-3 text-[12px] font-black text-[#7a5f39] transition-all active:scale-95">
                先留在这里
              </button>
              <button
                onClick={handleGoToSceneAfterHatch}
                className="flex-1 rounded-2xl border-[2px] border-[#a36b1e] bg-[linear-gradient(180deg,#ffd968,#f2ae2b)] px-3 py-3 text-[12px] font-black text-[#654008] shadow-[0_2px_0_#cb8918] transition-all active:scale-95">
                前往场景
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
