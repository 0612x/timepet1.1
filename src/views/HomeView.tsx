import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Calendar as CalendarIcon,
  FastForward,
  Info,
  Plus,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {motion} from 'motion/react';
import {TimeHeatmap} from '../components/TimeHeatmap';
import {
  ACTIVITY_CONFIG,
  createEmptyActivityTotals,
  getActivityConfig,
} from '../constants/activities';
import {useStore, ActivityType} from '../store/useStore';
import {cn} from '../utils/cn';
import {formatZhDate, getDateKey, getSimulatedDate} from '../utils/date';

export function HomeView() {
  const {allocations, allocateTime, simulatedDateOffset, advanceDay, currentEgg} = useStore();
  const [selectedType, setSelectedType] = useState<ActivityType>('work');
  const [allocateHours, setAllocateHours] = useState(0.5);
  const [showHeatmap, setShowHeatmap] = useState(false);

  const todayDate = useMemo(() => getSimulatedDate(simulatedDateOffset), [simulatedDateOffset]);
  const today = useMemo(() => formatZhDate(todayDate), [todayDate]);

  const todayStr = getDateKey(todayDate);
  const todayAllocations = allocations[todayStr] || [];
  const totalAllocated = todayAllocations.reduce((sum, a) => sum + a.hours, 0);
  const remaining = 24 - totalAllocated;

  const handleAllocate = () => {
    if (allocateHours <= 0 || allocateHours > remaining) return;
    allocateTime(todayStr, selectedType, allocateHours);
    setAllocateHours(0);
  };

  const totalEggProgress = currentEgg.progress.focus + currentEgg.progress.heal + currentEgg.progress.active;
  const eggTarget = currentEgg.stage === 'egg' ? 8 : 24;
  const progressPercent = Math.min(100, (totalEggProgress / eggTarget) * 100);

  const distribution = useMemo(() => {
    const data = createEmptyActivityTotals();
    todayAllocations.forEach((allocation) => {
      data[allocation.type] += allocation.hours;
    });
    return data;
  }, [todayAllocations]);
  const [animatedDistribution, setAnimatedDistribution] =
    useState<Record<ActivityType, number>>(() => distribution);
  const animatedDistributionRef = useRef(animatedDistribution);

  const distributionRanking = useMemo(() => {
    const isClearing =
      (Object.values(distribution) as number[]).every((hours) => hours <= 0.01) &&
      (Object.values(animatedDistribution) as number[]).some((hours) => hours > 0.01);
    const rankingSource = isClearing ? animatedDistribution : distribution;
    const orderMap = new Map(ACTIVITY_CONFIG.map((activity, index) => [activity.type, index]));

    return ACTIVITY_CONFIG.map((activity) => ({
      ...activity,
      hours: rankingSource[activity.type],
    })).sort((left, right) => {
      if (right.hours !== left.hours) return right.hours - left.hours;
      return (orderMap.get(left.type) ?? 0) - (orderMap.get(right.type) ?? 0);
    });
  }, [distribution, animatedDistribution]);

  useEffect(() => {
    animatedDistributionRef.current = animatedDistribution;
  }, [animatedDistribution]);

  useEffect(() => {
    const startDistribution = {...animatedDistributionRef.current};
    const zeroDistribution = createEmptyActivityTotals();
    const isClearing =
      (Object.values(distribution) as number[]).every((hours) => hours <= 0.001) &&
      (Object.values(startDistribution) as number[]).some((hours) => hours > 0.001);
    const duration = isClearing ? 460 : 560;
    let frameId = 0;
    const startTime = performance.now();

    const tick = (currentTime: number) => {
      const progress = Math.min(1, (currentTime - startTime) / duration);
      const eased = isClearing
        ? 1 - (1 - progress) ** 3.8
        : 1 - (1 - progress) ** 2.6;
      const nextDistribution = createEmptyActivityTotals();

      (Object.keys(distribution) as ActivityType[]).forEach((type) => {
        const nextValue =
          startDistribution[type] + (distribution[type] - startDistribution[type]) * eased;
        nextDistribution[type] = Math.abs(nextValue) < 0.001 ? 0 : nextValue;
      });

      const nextTotal = (Object.values(nextDistribution) as number[]).reduce(
        (sum, hours) => sum + hours,
        0,
      );

      if (isClearing && nextTotal < 0.12) {
        setAnimatedDistribution(zeroDistribution);
        animatedDistributionRef.current = zeroDistribution;
        return;
      }

      if (progress < 1) {
        setAnimatedDistribution(nextDistribution);
        frameId = requestAnimationFrame(tick);
      } else {
        setAnimatedDistribution(distribution);
        animatedDistributionRef.current = distribution;
      }
    };

    frameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameId);
  }, [distribution, todayStr]);

  const yesterdayFocusHours = useMemo(() => {
    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayAllocations = allocations[getDateKey(yesterdayDate)] || [];
    return yesterdayAllocations.reduce((sum, allocation) => {
      if (allocation.type === 'work' || allocation.type === 'study') {
        return sum + allocation.hours;
      }
      return sum;
    }, 0);
  }, [allocations, todayDate]);

  const focusHours = distribution.work + distribution.study;
  const activityScore = Math.min(100, Math.round((totalAllocated / 12) * 100));
  const focusRatio = totalAllocated === 0 ? 0 : Math.round((focusHours / totalAllocated) * 100);
  const focusDelta = focusHours - yesterdayFocusHours;

  const efficiencyLabel = (() => {
    if (focusRatio >= 80) return 'A+';
    if (focusRatio >= 65) return 'A';
    if (focusRatio >= 50) return 'B';
    if (focusRatio >= 35) return 'C';
    return 'D';
  })();

  const sliderMax = remaining > 0 ? remaining : 0;
  const sliderPercent =
    sliderMax === 0 ? 0 : Math.min(100, Math.max(0, (allocateHours / sliderMax) * 100));
  const animatedTotalAllocated = (Object.values(animatedDistribution) as number[]).reduce(
    (sum, hours) => sum + hours,
    0,
  );
  const maxDistributionHours = Math.max(...(Object.values(animatedDistribution) as number[]), 0);

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-y-auto scroll-hide pb-24 relative">
      <header className="p-5 pb-2 z-10">
        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-slate-400 text-xs font-medium flex items-center gap-1">
              <CalendarIcon size={12} /> {today}
            </p>
            <h1 className="text-2xl font-black tracking-tight">你好, 训练师</h1>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={advanceDay} 
              className="w-10 h-10 rounded-full glass-card flex items-center justify-center text-slate-600 shadow-sm active:scale-90 transition-transform"
            >
              <FastForward size={20} />
            </button>
            <div className="w-10 h-10 rounded-full border-2 border-indigo-500 overflow-hidden shadow-lg bg-white">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=trainer`} alt="Avatar" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </header>

      <main className="px-5 space-y-6 z-10">
        <section className="glass-card rounded-[32px] p-5 shadow-xl border-white/40">
          <div className="flex justify-between items-center mb-6">
            <div className="flex flex-col">
              <h2 className="font-black flex items-center gap-2">
                <Plus size={20} className="text-indigo-500" />
                分配时间
              </h2>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">剩余 {remaining.toFixed(1)}h</span>
            </div>
            <button
              onClick={() => setShowHeatmap(!showHeatmap)}
              title="查看热力图"
              className={cn(
                "p-1.5 rounded-full transition-colors border",
                showHeatmap
                  ? "bg-indigo-50 text-indigo-600 border-indigo-100"
                  : "text-slate-400 hover:bg-slate-50 border-slate-200"
              )}>
              <CalendarIcon size={18} />
            </button>
          </div>

          {showHeatmap ? (
            <TimeHeatmap
              allocations={allocations}
              simulatedDateOffset={simulatedDateOffset}
              variant="plain"
            />
          ) : (
            <div>
              <div className="grid grid-cols-5 gap-2 mb-6">
                {ACTIVITY_CONFIG.map((activity) => (
                  <button
                    key={activity.type}
                    onClick={() => setSelectedType(activity.type)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-2 rounded-xl border-2 transition-all",
                      selectedType === activity.type ? activity.color : "border-transparent bg-slate-50 text-slate-400"
                    )}
                  >
                    {activity.icon}
                    <span className="text-[8px] font-black">{activity.label}</span>
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <span className="text-xs font-black text-slate-600">分配时长</span>
                  <span className="text-sm font-mono font-black text-indigo-600">{allocateHours.toFixed(1)}h</span>
                </div>
                <input 
                  type="range"
                  min="0"
                  max={sliderMax}
                  step="0.5"
                  value={Math.min(allocateHours, sliderMax)}
                  onChange={(e) => setAllocateHours(parseFloat(e.target.value))}
                  className="time-slider w-full cursor-pointer appearance-none"
                  style={{
                    background: `linear-gradient(90deg, #6366f1 0%, #6366f1 ${sliderPercent}%, #e2e8f0 ${sliderPercent}%, #e2e8f0 100%)`,
                  }}
                  disabled={remaining === 0}
                />
                <button
                  onClick={handleAllocate}
                  disabled={remaining === 0 || allocateHours <= 0 || allocateHours > remaining}
                  className={cn(
                    "w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 shadow-lg",
                    remaining === 0 || allocateHours <= 0 || allocateHours > remaining
                      ? "bg-slate-200 text-slate-400 shadow-none" 
                      : "bg-indigo-600 text-white shadow-indigo-200"
                  )}
                >
                  确认分配
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="glass-card rounded-[32px] p-5 shadow-xl border-white/40">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold flex items-center gap-2 text-slate-800">
              <TrendingUp size={18} className="text-indigo-500" />
              今日时间分布
            </h2>
            <span className="text-xs text-slate-400">活跃度 {activityScore}%</span>
          </div>

          <div className="flex items-center gap-5">
            <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="12"
                  className="text-slate-100"
                />
                {distributionRanking.reduce(
                  (accumulator, activity) => {
                    const hours = animatedDistribution[activity.type];
                    const percent = (hours / 24) * 100;
                    const offset = accumulator.total;
                    accumulator.total += percent;

                    if (hours <= 0.001) return accumulator;

                    accumulator.elements.push(
                      <circle
                        key={activity.type}
                        cx="64"
                        cy="64"
                        r="56"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="12"
                        strokeDasharray={`${(percent / 100) * 352} 352`}
                        strokeDashoffset={`${-(offset / 100) * 352}`}
                        className={activity.baseColor.replace('bg-', 'text-')}
                        strokeLinecap="round"
                      />,
                    );

                    return accumulator;
                  },
                  {total: 0, elements: [] as React.ReactNode[]},
                ).elements}
              </svg>
              <div className="text-center">
                <div className="text-2xl font-black tracking-tighter">
                  {animatedTotalAllocated.toFixed(1)}
                </div>
                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">已分配 (h)</div>
              </div>
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              {distributionRanking.map((activity, index) => {
                const topBadgeStyle =
                  index === 0
                    ? 'bg-amber-400 text-white shadow-[0_8px_20px_rgba(251,191,36,0.25)]'
                    : index === 1
                      ? 'bg-slate-400 text-white shadow-[0_8px_20px_rgba(148,163,184,0.2)]'
                      : index === 2
                        ? 'bg-orange-400 text-white shadow-[0_8px_20px_rgba(251,146,60,0.22)]'
                        : 'bg-slate-100 text-slate-400';
                const fillPercent =
                  maxDistributionHours === 0
                    ? 0
                    : (animatedDistribution[activity.type] / maxDistributionHours) * 100;

                return (
                  <motion.div
                    key={activity.type}
                    layout="position"
                    transition={{type: 'spring', stiffness: 320, damping: 28, mass: 0.7}}
                    className="relative overflow-hidden rounded-xl border border-slate-100 bg-white/90 px-3 py-1.5 shadow-sm">
                    <div
                      aria-hidden="true"
                      className={cn('absolute inset-[1px] origin-left rounded-[11px]', activity.baseColor)}
                      style={{
                        transform: `scaleX(${fillPercent <= 0.1 ? 0 : Math.max(fillPercent, 12) / 100})`,
                        opacity: fillPercent === 0 ? 0 : 0.12,
                      }}
                    />
                    <div className="relative flex min-w-0 items-center gap-1.5">
                      <span
                        className={cn(
                          'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[9px] font-black leading-none shadow-sm',
                          topBadgeStyle,
                        )}>
                        {index + 1}
                      </span>
                      <div className={cn('h-2.5 w-2.5 shrink-0 rounded-full', activity.baseColor)} />
                      <span className="text-[13px] font-black leading-none text-slate-700">
                        {activity.label}
                      </span>
                      <span className="text-[13px] font-mono font-black leading-none tracking-tight text-slate-800">
                        {animatedDistribution[activity.type].toFixed(1)}h
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-4">
          <div className="glass-card rounded-[28px] p-5 border-white/40 shadow-sm">
            <p className="text-slate-400 text-xs mb-1">深度专注</p>
            <div className="flex items-end gap-1">
              <span className="text-2xl font-black">{focusHours.toFixed(1)}</span>
              <span className="text-xs text-slate-500 mb-1">小时</span>
            </div>
            <p className="text-[10px] mt-2 flex items-center text-emerald-500">
              <TrendingUp size={12} className="mr-1" />
              {focusDelta >= 0 ? '+' : ''}
              {focusDelta.toFixed(1)}h 较昨日
            </p>
          </div>

          <div className="glass-card rounded-[28px] p-5 border-white/40 shadow-sm">
            <p className="text-slate-400 text-xs mb-1">效率评分</p>
            <div className="flex items-end gap-1">
              <span className="text-2xl font-black">{efficiencyLabel}</span>
              <span className="text-xs text-slate-500 mb-1">{focusRatio}% 专注占比</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
              <div className="bg-indigo-500 h-full transition-all" style={{width: `${focusRatio}%`}} />
            </div>
          </div>
        </div>

        <section className="glass-card rounded-[32px] p-5 relative overflow-hidden shadow-xl border-white/40">
          <div className="z-10 relative">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="text-lg font-black flex items-center gap-2">
                  <Sparkles size={18} className="text-indigo-500" />
                  {currentEgg.stage === 'egg' ? '当前养成状态' : '当前成长状态'}
                </h4>
                <p className="text-xs opacity-60 font-medium">
                  {currentEgg.theme === 'A'
                    ? '云朵农场'
                    : currentEgg.theme === 'B'
                      ? '深海水族箱'
                      : currentEgg.theme === 'C'
                        ? '霓虹机房'
                        : '手绘乐园'}{' '}
                  · {currentEgg.stage === 'egg' ? '幼体期' : '成长期'}
                </p>
              </div>
              <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-600">
                <Info size={20} />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <div className="text-3xl font-mono font-black tracking-tighter">
                  {totalEggProgress.toFixed(1)} <span className="text-sm opacity-40">/ {eggTarget}h</span>
                </div>
                <div className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                  {progressPercent.toFixed(0)}%
                </div>
              </div>

              <div className="w-full bg-slate-200/50 h-3 rounded-full overflow-hidden p-0.5 border border-white/50">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(79,70,229,0.3)]"
                  style={{width: `${progressPercent}%`}}
                />
              </div>
            </div>
          </div>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl" />
        </section>

        <section className="pb-8">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 px-1">今日流水</h3>
          {todayAllocations.length === 0 ? (
            <div className="p-10 text-center glass-card rounded-3xl border-dashed border-slate-200">
              <p className="text-xs font-bold text-slate-300">还没有记录哦...</p>
            </div>
          ) : (
            <div className="space-y-4 relative before:absolute before:left-[21px] before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-100">
              {todayAllocations.map((allocation) => {
                const activity = getActivityConfig(allocation.type);
                return (
                  <div key={allocation.id} className="flex items-center gap-4 relative z-10">
                    <div className={cn("w-11 h-11 rounded-full flex items-center justify-center shadow-sm border-2 border-white text-white", activity?.baseColor)}>
                      {activity?.icon}
                    </div>
                    <div className="flex-1 glass-card p-4 rounded-2xl flex justify-between items-center shadow-sm">
                      <div>
                        <h5 className="text-sm font-black">{activity?.label}</h5>
                        <p className="text-[10px] text-slate-400 font-medium">
                          分配于 {new Date(allocation.timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                        </p>
                      </div>
                      <div className="text-lg font-mono font-black text-slate-800">+{allocation.hours}h</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
