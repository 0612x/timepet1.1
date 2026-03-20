import React, { useState, useMemo } from 'react';
import {CompletedPet, PetQuality, useStore} from '../store/useStore';
import {PETS} from '../data/pets';
import { cn } from '../utils/cn';
import { DrawingModal } from '../components/DrawingModal';
import { CheckCircle2, Dice5, PenTool, Sparkles, Utensils, Wand2, X } from 'lucide-react';
import {ACTIVITY_CONFIG, getActivityConfig} from '../constants/activities';
import {formatZhDate, getDateKey, getSimulatedDate} from '../utils/date';
import {getPetSpriteOptionByKey, hasPetSpriteAction, type PetSpriteAction} from '../data/petSprites';
import {SpriteActor} from '../components/SpriteActor';

export function FeedView() {
  const {
    currentEgg,
    allocations,
    feedEgg,
    completeEgg,
    simulatedDateOffset,
    setCurrentTab,
    setCurrentTheme,
  } = useStore();
  const [isShaking, setIsShaking] = useState(false);
  const [showDrawingModal, setShowDrawingModal] = useState(false);
  const [showRandomHatchModal, setShowRandomHatchModal] = useState(false);
  const [pendingRandomName, setPendingRandomName] = useState('');
  const [hatchedPreview, setHatchedPreview] = useState<CompletedPet | null>(null);

  const today = useMemo(() => {
    return formatZhDate(getSimulatedDate(simulatedDateOffset));
  }, [simulatedDateOffset]);

  const todayStr = getDateKey(getSimulatedDate(simulatedDateOffset));
  const todayAllocs = allocations[todayStr] || [];
  const unusedAllocs = todayAllocs.filter(a => !a.used);

  const totalProgress = currentEgg.progress.focus + currentEgg.progress.heal + currentEgg.progress.active;
  const maxProgress = 24;

  const handleFeed = (id: string) => {
    if (totalProgress >= maxProgress) return;
    
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
    setPendingRandomName('');
    setShowRandomHatchModal(true);
  };

  const handleConfirmRandomHatch = () => {
    const finalName = pendingRandomName.trim() || createRandomName();
    const hatchedPet = completeEgg(undefined, finalName);
    if (!hatchedPet) return;
    setShowRandomHatchModal(false);
    setPendingRandomName('');
    setHatchedPreview(hatchedPet);
  };

  const handleGoToSceneAfterHatch = () => {
    if (!hatchedPreview) return;
    const hatchTheme = hatchedPreview.theme;
    setHatchedPreview(null);
    setCurrentTheme(hatchTheme === 'B' ? 'A' : hatchTheme);
    setCurrentTab('scene');
  };

  const handleCustomHatch = (name: string, image: string) => {
    const customPet = {
      id: 'custom_' + Date.now(),
      name,
      image
    };
    completeEgg(customPet);
    setShowDrawingModal(false);
    setCurrentTheme('custom');
    setCurrentTab('scene');
  };

  const getQualityLabel = (quality: PetQuality | null) => {
    if (quality === 'epic') return '史诗';
    if (quality === 'rare') return '稀有';
    return '普通';
  };

  const getQualityClass = (quality: PetQuality | null) => {
    if (quality === 'epic') {
      return 'border-violet-200/90 bg-[radial-gradient(circle_at_top,rgba(167,139,250,0.38),rgba(255,255,255,0.82)_56%)] text-violet-600';
    }
    if (quality === 'rare') {
      return 'border-amber-200/90 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.33),rgba(255,255,255,0.84)_56%)] text-amber-600';
    }
    return 'border-slate-200/90 bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.26),rgba(255,255,255,0.84)_58%)] text-slate-600';
  };

  const getSpriteAction = (spriteKey: string): PetSpriteAction => {
    const preferredAction: PetSpriteAction =
      currentEgg.stage === 'base'
        ? 'idle'
        : currentEgg.finalState === 'focus'
          ? 'move'
          : currentEgg.finalState === 'heal'
            ? 'feed'
            : currentEgg.finalState === 'active'
              ? 'happy'
              : 'idle';
    if (hasPetSpriteAction(spriteKey, preferredAction)) return preferredAction;
    if (hasPetSpriteAction(spriteKey, 'move')) return 'move';
    if (hasPetSpriteAction(spriteKey, 'happy')) return 'happy';
    if (hasPetSpriteAction(spriteKey, 'feed')) return 'feed';
    return 'idle';
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

  const spriteOption = currentEgg.petId ? getPetSpriteOptionByKey(currentEgg.petId) : null;
  const legacyPet = currentEgg.petId ? PETS.find((pet) => pet.id === currentEgg.petId) : null;
  const spriteScale = spriteOption ? Math.min(spriteOption.sceneScale ?? 2.3, 2.4) : 2.2;
  const displayQuality = currentEgg.stage === 'evolved' ? currentEgg.quality : null;

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-y-auto scroll-hide pb-24">
      {/* Header */}
      <header className="p-5 pb-2">
        <p className="text-slate-400 text-xs font-medium">{today}</p>
        <h1 className="text-2xl font-black tracking-tight">培育舱</h1>
      </header>

      <main className="px-5 space-y-6">
        {/* Incubator Card */}
        <section className="glass-card rounded-[32px] p-8 flex flex-col items-center shadow-xl border-white/40 relative overflow-hidden">
          <div className="absolute top-4 right-4 text-indigo-500/20">
            <Sparkles size={48} />
          </div>

          {/* Egg Display */}
          <div
            className={cn(
              'mb-10 transition-all duration-300',
              isShaking && 'animate-shake',
              currentEgg.stage === 'evolved' && 'animate-glow',
            )}>
            {currentEgg.stage === 'evolved' ? (
              <div className="flex flex-col items-center gap-2">
                <div className="text-7xl drop-shadow-2xl">🥚</div>
                <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[11px] font-black text-indigo-600">
                  待确认孵化
                </span>
              </div>
            ) : currentEgg.stage === 'egg' ? (
              <div className="text-7xl drop-shadow-2xl">🥚</div>
            ) : !spriteOption && legacyPet ? (
              <div className="text-7xl drop-shadow-2xl">
                {currentEgg.stage === 'base'
                  ? legacyPet.base
                  : currentEgg.finalState === 'focus'
                    ? legacyPet.focus
                    : currentEgg.finalState === 'heal'
                      ? legacyPet.heal
                      : currentEgg.finalState === 'active'
                        ? legacyPet.active
                        : legacyPet.base}
              </div>
            ) : !spriteOption ? (
              <div className="text-7xl drop-shadow-2xl">🥚</div>
            ) : (
              <div
                className={cn(
                  'relative rounded-[28px] border p-3 shadow-[0_14px_36px_rgba(15,23,42,0.14)] backdrop-blur-sm',
                  getQualityClass(displayQuality),
                )}>
                <div className="flex min-h-[104px] min-w-[128px] items-center justify-center rounded-[20px] bg-white/75 px-4 py-3 shadow-inner shadow-white/80">
                  <SpriteActor
                    spriteKey={spriteOption.key}
                    action={getSpriteAction(spriteOption.key)}
                    scale={spriteScale}
                    flipX={spriteOption.flipX}
                    ariaLabel={spriteOption.label}
                    className="drop-shadow-[0_10px_16px_rgba(15,23,42,0.24)]"
                  />
                </div>
                <div className="mt-2 flex items-center justify-between px-1">
                  <span className="text-[11px] font-black tracking-wide">{spriteOption.label}</span>
                  <span className="rounded-full border border-current/20 bg-white/70 px-2 py-0.5 text-[10px] font-black">
                    {currentEgg.stage === 'evolved' ? getQualityLabel(displayQuality) : '幼体'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Stats Grid */}
          <div className="w-full grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">专注</p>
              <div className="h-1.5 bg-rose-100 rounded-full overflow-hidden">
                <div className="h-full bg-rose-500 transition-all duration-500" style={{ width: `${(currentEgg.progress.focus / maxProgress) * 100 * 3}%` }} />
              </div>
              <p className="text-xs font-mono font-bold mt-1">{currentEgg.progress.focus}h</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest mb-1">治愈</p>
              <div className="h-1.5 bg-sky-100 rounded-full overflow-hidden">
                <div className="h-full bg-sky-500 transition-all duration-500" style={{ width: `${(currentEgg.progress.heal / maxProgress) * 100 * 3}%` }} />
              </div>
              <p className="text-xs font-mono font-bold mt-1">{currentEgg.progress.heal}h</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">活力</p>
              <div className="h-1.5 bg-emerald-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${(currentEgg.progress.active / maxProgress) * 100 * 3}%` }} />
              </div>
              <p className="text-xs font-mono font-bold mt-1">{currentEgg.progress.active}h</p>
            </div>
          </div>

          {/* Total Progress Bar */}
          <div className="w-full space-y-2 mb-8">
            <div className="flex justify-between items-end px-1">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">总体进度</span>
              <span className="text-sm font-mono font-black text-indigo-600">{totalProgress.toFixed(1)} / {maxProgress}h</span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-white/50">
              <div 
                className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-1000 shadow-sm" 
                style={{ width: `${(totalProgress / maxProgress) * 100}%` }} 
              />
            </div>
          </div>

          {currentEgg.stage === 'evolved' ? (
            <div className="flex flex-col gap-3 w-full">
              <div className="text-xs font-black text-indigo-600 text-center mb-2 animate-pulse uppercase tracking-widest">
                孵化完成！请选择诞生方式
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleOpenRandomHatchModal}
                  className="flex flex-col items-center justify-center gap-2 p-4 font-black rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 active:scale-95 transition-all"
                >
                  <Wand2 size={24} />
                  <span className="text-[10px] uppercase tracking-widest">随机孵化</span>
                </button>
                <button
                  onClick={() => setShowDrawingModal(true)}
                  className="flex flex-col items-center justify-center gap-2 p-4 font-black rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 active:scale-95 transition-all"
                >
                  <PenTool size={24} />
                  <span className="text-[10px] uppercase tracking-widest">亲手绘制</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-4 py-2 rounded-full">
              <Sparkles size={12} />
              {currentEgg.stage === 'egg' ? '还需要喂食才能孵化' : '正在茁壮成长中'}
            </div>
          )}
        </section>

        {/* Food Inventory - Inspired by "Medal Wall" */}
        <section className="pb-8">
          <div className="flex justify-between items-center mb-4 px-1">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">今日食物库</h3>
            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">点击投喂</span>
          </div>
          
          {unusedAllocs.length === 0 ? (
            <div className="p-12 text-center glass-card rounded-[32px] border-dashed border-slate-200">
              <p className="text-xs font-bold text-slate-300">没有食物了，去记录时间吧！</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {unusedAllocs.map(alloc => (
                <button
                  key={alloc.id}
                  onClick={() => handleFeed(alloc.id)}
                  className="flex flex-col items-center group"
                >
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-sm transition-all group-hover:scale-110 group-active:scale-90 border-2 border-white",
                    getActivityColor(alloc.type)
                  )}>
                    {getActivityIcon(alloc.type)}
                  </div>
                  <span className="text-[10px] font-black mt-2 text-slate-500">+{alloc.hours}h</span>
                </button>
              ))}
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

      {hatchedPreview && (
        <div className="fixed inset-0 z-[111] flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-md">
          <div className="glass-card w-full max-w-md rounded-3xl border border-white/50 bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 size={18} />
              <p className="text-sm font-black">孵化成功</p>
            </div>
            <h3 className="mt-1 text-xl font-black text-slate-900">
              {hatchedPreview.nickname || '新宠物'} 已加入
            </h3>
            <p className="mt-1 text-xs font-medium text-slate-500">
              品质 · {getQualityLabel(hatchedPreview.quality)}
            </p>

            <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
              {(() => {
                const option = getPetSpriteOptionByKey(hatchedPreview.petId);
                const legacy = PETS.find((pet) => pet.id === hatchedPreview.petId);
                return option ? (
                  <div className="flex min-h-[96px] items-center justify-center">
                    <SpriteActor
                      spriteKey={option.key}
                      action={getSpriteActionByState(option.key, hatchedPreview.state)}
                      scale={Math.min(option.sceneScale ?? 2.3, 2.35)}
                      flipX={option.flipX}
                      ariaLabel={option.label}
                    />
                  </div>
                ) : (
                  <div className="flex min-h-[96px] items-center justify-center text-6xl">
                    {hatchedPreview.state === 'focus'
                      ? legacy?.focus
                      : hatchedPreview.state === 'heal'
                        ? legacy?.heal
                        : hatchedPreview.state === 'active'
                          ? legacy?.active
                          : legacy?.base || '🐾'}
                  </div>
                );
              })()}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setHatchedPreview(null)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-black text-slate-500 transition-colors hover:bg-slate-50">
                先留在这里
              </button>
              <button
                onClick={handleGoToSceneAfterHatch}
                className="flex-1 rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-black text-white shadow-lg shadow-indigo-200 transition-colors hover:bg-indigo-700">
                前往场景
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
