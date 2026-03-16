import React, { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { PETS } from '../data/pets';
import { cn } from '../utils/cn';
import { DrawingModal } from '../components/DrawingModal';
import { Wand2, PenTool, Sparkles, Utensils } from 'lucide-react';
import {ACTIVITY_CONFIG, getActivityConfig} from '../constants/activities';
import {formatZhDate, getDateKey, getSimulatedDate} from '../utils/date';

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

  const handleRandomHatch = () => {
    const hatchTheme = currentEgg.theme;
    completeEgg();
    setCurrentTheme(hatchTheme);
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

  const getEggDisplay = () => {
    if (currentEgg.stage === 'egg') return '🥚';
    if (!currentEgg.petId) return '🥚';
    
    const pet = PETS.find(p => p.id === currentEgg.petId);
    if (!pet) return '🥚';
    
    if (currentEgg.stage === 'base') return pet.base;
    
    if (currentEgg.finalState === 'focus') return pet.focus;
    if (currentEgg.finalState === 'heal') return pet.heal;
    if (currentEgg.finalState === 'active') return pet.active;
    
    return pet.base;
  };

  const getActivityIcon = (type: string) => {
    return getActivityConfig(type as typeof ACTIVITY_CONFIG[number]['type'])?.icon ?? <Utensils size={16} />;
  };

  const getActivityColor = (type: string) => {
    return getActivityConfig(type as typeof ACTIVITY_CONFIG[number]['type'])?.baseColor ?? 'bg-slate-500';
  };

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
          <div className={cn(
            "text-7xl mb-10 transition-all duration-300 drop-shadow-2xl filter",
            isShaking && "animate-shake",
            currentEgg.stage === 'evolved' && "animate-glow text-current scale-125"
          )}>
            {getEggDisplay()}
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
                  onClick={handleRandomHatch}
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
    </div>
  );
}
