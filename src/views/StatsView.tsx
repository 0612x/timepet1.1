import React, {useMemo} from 'react';
import {Award, Clock3, Flame, Target, TrendingUp} from 'lucide-react';
import {TimeHeatmap} from '../components/TimeHeatmap';
import {ACTIVITY_CONFIG, createEmptyActivityTotals} from '../constants/activities';
import {useStore} from '../store/useStore';
import {cn} from '../utils/cn';
import {formatMonthDay, formatZhDate, getDateKey, getSimulatedDate} from '../utils/date';

export function StatsView() {
  const {allocations, simulatedDateOffset} = useStore();

  const todayDate = useMemo(() => getSimulatedDate(simulatedDateOffset), [simulatedDateOffset]);
  const today = useMemo(() => formatZhDate(todayDate), [todayDate]);

  const allAllocations = useMemo(() => Object.values(allocations).flat(), [allocations]);
  const totalHours = useMemo(
    () => allAllocations.reduce((sum, allocation) => sum + allocation.hours, 0),
    [allAllocations],
  );

  const typeTotals = useMemo(() => {
    const totals = createEmptyActivityTotals();
    allAllocations.forEach((allocation) => {
      totals[allocation.type] += allocation.hours;
    });
    return totals;
  }, [allAllocations]);

  const focusHours = typeTotals.work + typeTotals.study;

  const recentWeekData = useMemo(() => {
    const result: Array<{label: string; dateLabel: string; focusHours: number; totalHours: number}> = [];

    for (let offset = 6; offset >= 0; offset -= 1) {
      const currentDate = new Date(todayDate);
      currentDate.setDate(currentDate.getDate() - offset);
      const dateKey = getDateKey(currentDate);
      const dayAllocations = allocations[dateKey] || [];
      const dayFocusHours = dayAllocations.reduce((sum, allocation) => {
        if (allocation.type === 'work' || allocation.type === 'study') {
          return sum + allocation.hours;
        }
        return sum;
      }, 0);
      const dayTotalHours = dayAllocations.reduce((sum, allocation) => sum + allocation.hours, 0);

      result.push({
        label: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][currentDate.getDay()],
        dateLabel: formatMonthDay(currentDate),
        focusHours: dayFocusHours,
        totalHours: dayTotalHours,
      });
    }

    return result;
  }, [allocations, todayDate]);

  const weeklyFocusHours = recentWeekData.reduce((sum, day) => sum + day.focusHours, 0);
  const weeklyTotalHours = recentWeekData.reduce((sum, day) => sum + day.totalHours, 0);
  const longestFocusSession = Math.max(...recentWeekData.map((day) => day.focusHours), 0);
  const activeDays = recentWeekData.filter((day) => day.totalHours > 0).length;
  const focusRatio = weeklyTotalHours === 0 ? 0 : Math.round((weeklyFocusHours / weeklyTotalHours) * 100);
  const bestCategory = ACTIVITY_CONFIG.reduce((best, activity) => {
    if (typeTotals[activity.type] > (best?.hours ?? -1)) {
      return {label: activity.label, hours: typeTotals[activity.type]};
    }
    return best;
  }, undefined as {label: string; hours: number} | undefined);

  const rangeStart = useMemo(() => {
    const startDate = new Date(todayDate);
    startDate.setDate(startDate.getDate() - 6);
    return startDate;
  }, [todayDate]);

  const badges = [
    {
      label: '专注达人',
      icon: <Flame size={20} />,
      active: weeklyFocusHours >= 12,
      color: 'text-amber-500 border-amber-200 bg-amber-50',
    },
    {
      label: '稳定记录',
      icon: <Clock3 size={20} />,
      active: activeDays >= 5,
      color: 'text-indigo-500 border-indigo-200 bg-indigo-50',
    },
    {
      label: '目标推进',
      icon: <Target size={20} />,
      active: focusRatio >= 60,
      color: 'text-emerald-500 border-emerald-200 bg-emerald-50',
    },
    {
      label: '持续成长',
      icon: <Award size={20} />,
      active: totalHours >= 24,
      color: 'text-sky-500 border-sky-200 bg-sky-50',
    },
  ];

  const maxWeekHours = Math.max(...recentWeekData.map((day) => day.focusHours), 1);
  const hasWeeklyFocusData = recentWeekData.some((day) => day.focusHours > 0);
  const weekCategorySummary = [
    {label: '工作', hours: recentWeekData.reduce((sum, _day, index) => {
      const date = new Date(todayDate);
      date.setDate(date.getDate() - (6 - index));
      return sum + (allocations[getDateKey(date)] || []).reduce((innerSum, allocation) => allocation.type === 'work' ? innerSum + allocation.hours : innerSum, 0);
    }, 0), color: 'bg-indigo-500'},
    {label: '学习', hours: recentWeekData.reduce((sum, _day, index) => {
      const date = new Date(todayDate);
      date.setDate(date.getDate() - (6 - index));
      return sum + (allocations[getDateKey(date)] || []).reduce((innerSum, allocation) => allocation.type === 'study' ? innerSum + allocation.hours : innerSum, 0);
    }, 0), color: 'bg-emerald-500'},
    {label: '运动', hours: recentWeekData.reduce((sum, _day, index) => {
      const date = new Date(todayDate);
      date.setDate(date.getDate() - (6 - index));
      return sum + (allocations[getDateKey(date)] || []).reduce((innerSum, allocation) => allocation.type === 'exercise' ? innerSum + allocation.hours : innerSum, 0);
    }, 0), color: 'bg-amber-500'},
    {label: '休息', hours: recentWeekData.reduce((sum, _day, index) => {
      const date = new Date(todayDate);
      date.setDate(date.getDate() - (6 - index));
      return sum + (allocations[getDateKey(date)] || []).reduce((innerSum, allocation) => (allocation.type === 'rest' || allocation.type === 'entertainment') ? innerSum + allocation.hours : innerSum, 0);
    }, 0), color: 'bg-slate-500'},
  ];

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-y-auto scroll-hide pb-24">
      <header className="p-5 pb-2">
        <h1 className="text-2xl font-black tracking-tight">数据洞察</h1>
        <p className="text-slate-400 text-sm">
          {formatMonthDay(rangeStart)} - {formatMonthDay(todayDate)} 回顾 · {today}
        </p>
      </header>

      <main className="px-5 space-y-6">
        <div className="flex gap-4 overflow-x-auto pb-1 scroll-hide">
          <div className="min-w-[160px] glass-card rounded-[28px] p-5 border-b-4 border-indigo-500 shadow-sm">
            <p className="text-[10px] text-slate-400 mb-1 uppercase tracking-wider">总专注时长</p>
            <p className="text-xl font-black">{weeklyFocusHours.toFixed(1)}<span className="ml-1 text-xs font-normal opacity-60">h</span></p>
          </div>
          <div className="min-w-[160px] glass-card rounded-[28px] p-5 border-b-4 border-emerald-500 shadow-sm">
            <p className="text-[10px] text-slate-400 mb-1 uppercase tracking-wider">目标达成率</p>
            <p className="text-xl font-black">{focusRatio}<span className="ml-1 text-xs font-normal opacity-60">%</span></p>
          </div>
          <div className="min-w-[160px] glass-card rounded-[28px] p-5 border-b-4 border-amber-500 shadow-sm">
            <p className="text-[10px] text-slate-400 mb-1 uppercase tracking-wider">最长专注</p>
            <p className="text-xl font-black">{longestFocusSession.toFixed(1)}<span className="ml-1 text-xs font-normal opacity-60">h</span></p>
          </div>
        </div>

        <section className="glass-card rounded-[32px] p-5 shadow-xl border-white/40">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-sm text-slate-800">近 7 日专注趋势</h3>
            <span className="text-[10px] text-indigo-500 font-black uppercase tracking-widest">
              活跃 {activeDays}/7 天
            </span>
          </div>

          {hasWeeklyFocusData ? (
            <div>
              <div className="grid h-56 grid-cols-7 items-end gap-2">
              {recentWeekData.map((day, index) => {
                const height =
                  day.focusHours === 0 ? 0 : Math.min(100, Math.max(18, (day.focusHours / maxWeekHours) * 100));
                return (
                  <div key={`${index}-${day.label}`} className="flex min-w-0 flex-col items-center">
                    <p className="mb-2 whitespace-nowrap text-sm font-black tracking-tight text-slate-700">
                      {day.focusHours === 0 ? '--' : `${day.focusHours.toFixed(1)}h`}
                    </p>
                    <div className="relative h-40 w-full max-w-[46px] overflow-hidden rounded-[14px] border border-slate-200 bg-[linear-gradient(to_top,_rgba(148,163,184,0.08)_1px,_transparent_1px)] bg-[length:100%_25%] bg-slate-50 shadow-[inset_0_1px_2px_rgba(148,163,184,0.08)]">
                      <div className="absolute inset-1.5 overflow-hidden rounded-[10px]">
                        {day.focusHours > 0 && (
                          <div
                            className="absolute inset-x-0 bottom-0 rounded-[8px] bg-gradient-to-t from-indigo-600 via-indigo-500 to-indigo-300 shadow-[0_10px_22px_rgba(99,102,241,0.22)] transition-all duration-500"
                            style={{height: `${height}%`}}
                          />
                        )}
                      </div>
                    </div>
                    <p className="mt-2 whitespace-nowrap text-[11px] font-black text-slate-500">{day.label}</p>
                    <p className="whitespace-nowrap text-[11px] font-medium tracking-tight text-slate-400">
                      {day.dateLabel}
                    </p>
                  </div>
                );
              })}
              </div>

              <div className="mt-5 grid grid-cols-4 gap-4">
                {weekCategorySummary.map((item) => (
                  <div key={item.label} className="text-center">
                    <div className={cn('mb-2 h-1.5 w-full rounded-full', item.color)} />
                    <p className="text-sm font-black text-slate-700">{item.label} {item.hours.toFixed(1)}h</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50 text-sm font-medium text-slate-400">
              最近 7 天还没有工作 / 学习类专注记录
            </div>
          )}
        </section>

        <TimeHeatmap allocations={allocations} simulatedDateOffset={simulatedDateOffset} />

        <section className="glass-card rounded-[32px] p-5 shadow-xl border-white/40">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-black">时间去哪了</h3>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              累计 {totalHours.toFixed(1)}h
            </span>
          </div>

          <div className="space-y-4">
            {ACTIVITY_CONFIG.map((activity) => {
              const hours = typeTotals[activity.type];
              const percent = totalHours === 0 ? 0 : (hours / totalHours) * 100;

              return (
                <div key={activity.type} className="space-y-1">
                  <div className="flex justify-between items-end px-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {activity.label}
                    </span>
                    <span className="text-xs font-mono font-black text-slate-600">
                      {hours.toFixed(1)}h ({percent.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className={cn('h-full transition-all duration-1000', activity.baseColor)} style={{width: `${percent}%`}} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
            核心投入：{bestCategory?.label ?? '暂无'} · {bestCategory?.hours.toFixed(1) ?? '0.0'}h
          </div>
        </section>

        <section className="pb-8">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold">成就勋章</h3>
            <span className="text-[10px] text-indigo-400">{badges.filter((badge) => badge.active).length} / {badges.length}</span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {badges.map((badge) => (
              <div key={badge.label} className={cn('flex flex-col items-center', !badge.active && 'grayscale opacity-40')}>
                <div className={cn('w-12 h-12 rounded-full border flex items-center justify-center', badge.color)}>
                  {badge.icon}
                </div>
                <span className="mt-1 text-[9px] text-slate-400">{badge.label}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
