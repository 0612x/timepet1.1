import React, {useMemo} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {Clock3, Sparkles, TrendingUp, X} from 'lucide-react';
import {
  ACTIVITY_CONFIG,
  createEmptyActivityTotals,
  getActivityConfig,
} from '../constants/activities';
import type {ActivityType, Allocation} from '../store/useStore';
import {cn} from '../utils/cn';

const RING_CIRCUMFERENCE = 314;

interface DayDetailSheetProps {
  open: boolean;
  dateKey: string | null;
  allocations: Record<string, Allocation[]>;
  onClose: () => void;
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function formatHours(hours: number) {
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded.toFixed(0)}` : rounded.toFixed(1);
}

function buildRingSegments(
  totals: Record<ActivityType, number>,
  visibleHours: number,
) {
  let cumulativeHours = 0;
  let remainingVisibleHours = Math.max(0, visibleHours);

  return ACTIVITY_CONFIG.flatMap((activity) => {
    const hours = totals[activity.type];
    const segmentStartHours = cumulativeHours;
    const visibleSegmentHours = Math.min(hours, remainingVisibleHours);
    cumulativeHours += hours;
    remainingVisibleHours = Math.max(0, remainingVisibleHours - visibleSegmentHours);

    if (visibleSegmentHours <= 0.001) return [];

    return [
      {
        key: activity.type,
        colorClassName: activity.baseColor.replace('bg-', 'text-'),
        dashArray: `${(visibleSegmentHours / 24) * RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`,
        dashOffset: `${-(segmentStartHours / 24) * RING_CIRCUMFERENCE}`,
      },
    ];
  });
}

function getDayInsight(
  total: number,
  totals: Record<ActivityType, number>,
) {
  const focusHours = totals.work + totals.study;
  const restHours = totals.rest;
  const entertainmentHours = totals.entertainment;
  const activeTypes = ACTIVITY_CONFIG.filter((activity) => totals[activity.type] > 0.4).length;
  const dominant = [...ACTIVITY_CONFIG]
    .map((activity) => ({...activity, hours: totals[activity.type]}))
    .sort((left, right) => right.hours - left.hours)[0];
  const dominantShare = total <= 0.001 ? 0 : dominant.hours / total;
  const focusRatio = total <= 0.001 ? 0 : focusHours / total;
  const restRatio = total <= 0.001 ? 0 : restHours / total;
  const entertainmentRatio = total <= 0.001 ? 0 : entertainmentHours / total;

  if (total <= 0.5) {
    return {
      badge: '空白日',
      badgeClassName: 'bg-slate-100 text-slate-500',
      title: '这一天还没有形成时间画像',
      description: '当天没有记录内容，所以暂时看不出结构和节奏。',
    };
  }

  if (total >= 23.5 && focusHours >= 8 && restHours >= 7 && activeTypes >= 3) {
    return {
      badge: '完整平衡日',
      badgeClassName: 'bg-emerald-50 text-emerald-600',
      title: '这一天记录完整，而且整体结构比较平衡',
      description: `专注 ${formatHours(focusHours)}h，休息 ${formatHours(restHours)}h，投入和恢复都兼顾到了。`,
    };
  }

  if (total >= 23.5) {
    return {
      badge: '完整记录日',
      badgeClassName: 'bg-indigo-50 text-indigo-600',
      title: '这一天已经形成完整样本',
      description: `全天累计记录 ${formatHours(total)}h，可以比较清楚地看出时间主要流向。`,
    };
  }

  if (focusRatio >= 0.65 && focusHours >= 6) {
    return {
      badge: '高专注日',
      badgeClassName: 'bg-rose-50 text-rose-500',
      title: '这一天明显偏向专注投入',
      description: `工作和学习合计 ${formatHours(focusHours)}h，占当天 ${Math.round(focusRatio * 100)}%。`,
    };
  }

  if (restRatio >= 0.42 && restHours >= 8) {
    return {
      badge: '休整日',
      badgeClassName: 'bg-indigo-50 text-indigo-600',
      title: '这一天更偏恢复和休整',
      description: `休息用了 ${formatHours(restHours)}h，整体节奏比较松一些。`,
    };
  }

  if (entertainmentRatio >= 0.28 && entertainmentHours >= 4) {
    return {
      badge: '放松日',
      badgeClassName: 'bg-sky-50 text-sky-600',
      title: '这一天更偏轻松和放松',
      description: `娱乐用了 ${formatHours(entertainmentHours)}h，是当天比较突出的部分。`,
    };
  }

  if (activeTypes >= 4 && dominantShare < 0.38) {
    return {
      badge: '多线切换日',
      badgeClassName: 'bg-slate-100 text-slate-600',
      title: '这一天活动类型比较多，结构偏均衡',
      description: '没有单一类型明显压过其他类别，整体更像多线切换的一天。',
    };
  }

  return {
    badge: `${dominant.label}主导`,
    badgeClassName: 'bg-amber-50 text-amber-600',
    title: `${dominant.label}是这一天最主要的部分`,
    description: `${dominant.label}累计 ${formatHours(dominant.hours)}h，是当天占比最高的一类活动。`,
  };
}

export function DayDetailSheet({
  open,
  dateKey,
  allocations,
  onClose,
}: DayDetailSheetProps) {
  const date = useMemo(() => (dateKey ? parseDateKey(dateKey) : null), [dateKey]);
  const dailyAllocations = useMemo(
    () =>
      dateKey
        ? [...(allocations[dateKey] || [])].sort((left, right) => left.timestamp - right.timestamp)
        : [],
    [allocations, dateKey],
  );
  const totals = useMemo(() => {
    const nextTotals = createEmptyActivityTotals();
    dailyAllocations.forEach((allocation) => {
      nextTotals[allocation.type] += allocation.hours;
    });
    return nextTotals;
  }, [dailyAllocations]);
  const totalHours = dailyAllocations.reduce((sum, allocation) => sum + allocation.hours, 0);
  const focusHours = totals.work + totals.study;
  const remainingHours = Math.max(0, 24 - totalHours);
  const usedCount = dailyAllocations.filter((allocation) => allocation.used).length;
  const unusedCount = dailyAllocations.length - usedCount;
  const insight = useMemo(() => getDayInsight(totalHours, totals), [totalHours, totals]);
  const ranking = useMemo(
    () =>
      ACTIVITY_CONFIG.map((activity) => ({
        ...activity,
        hours: totals[activity.type],
      }))
        .filter((activity) => activity.hours > 0.01)
        .sort((left, right) => right.hours - left.hours),
    [totals],
  );
  const ringSegments = useMemo(() => buildRingSegments(totals, totalHours), [totals, totalHours]);

  return (
    <AnimatePresence>
      {open && dateKey && date ? (
        <div
          className="fixed inset-0 z-[120] bg-[linear-gradient(180deg,rgba(15,23,42,0.08),rgba(15,23,42,0.3))] backdrop-blur-[10px]"
          onClick={onClose}>
          <motion.div
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            className="absolute inset-0"
          />
          <motion.div
            initial={{y: '100%'}}
            animate={{y: 0}}
            exit={{y: '100%'}}
            transition={{type: 'spring', stiffness: 280, damping: 28, mass: 0.9}}
            className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-hidden rounded-t-[36px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(248,250,252,0.99)_100%)] p-5 shadow-[0_-20px_60px_rgba(15,23,42,0.16)]"
            onClick={(event) => event.stopPropagation()}>
            <div className="relative mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200" />

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                  当天详情
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-900">
                  {date.toLocaleDateString('zh-CN', {
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long',
                  })}
                </h3>
                <p className="mt-1 text-[11px] font-medium text-slate-400">{dateKey}</p>
              </div>
              <button
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-white/90 text-slate-400 shadow-sm transition-colors hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 max-h-[calc(88vh-110px)] space-y-4 overflow-y-auto scroll-hide pr-1">
              <div className="rounded-[28px] bg-[linear-gradient(135deg,rgba(99,102,241,0.1)_0%,rgba(255,255,255,0.96)_100%)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-black', insight.badgeClassName)}>
                        {insight.badge}
                      </span>
                      <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-black text-slate-500">
                        {totalHours >= 23.5 ? '已完整' : `还差 ${formatHours(remainingHours)}h`}
                      </span>
                    </div>
                    <p className="mt-3 text-base font-black leading-7 text-slate-900">{insight.title}</p>
                    <p className="mt-2 text-[12px] font-medium leading-6 text-slate-500">
                      {insight.description}
                    </p>
                  </div>
                  <Sparkles size={18} className="mt-1 shrink-0 text-indigo-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[24px] bg-slate-50/90 px-4 py-3">
                  <p className="text-[11px] font-semibold text-slate-400">总记录</p>
                  <p className="mt-2 text-2xl font-black text-slate-800">{formatHours(totalHours)}h</p>
                </div>
                <div className="rounded-[24px] bg-slate-50/90 px-4 py-3">
                  <p className="text-[11px] font-semibold text-slate-400">专注时长</p>
                  <p className="mt-2 text-2xl font-black text-slate-800">{formatHours(focusHours)}h</p>
                </div>
                <div className="col-span-2 rounded-[24px] bg-slate-50/90 px-4 py-3">
                  <p className="text-[11px] font-semibold text-slate-400">流水条数</p>
                  <p className="mt-2 text-2xl font-black text-slate-800">{dailyAllocations.length}</p>
                </div>
              </div>

              <section className="rounded-[28px] border border-slate-100 bg-white/90 p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <TrendingUp size={18} className="text-indigo-500" />
                  <h4 className="text-base font-black text-slate-800">时间分布</h4>
                </div>

                {totalHours > 0.01 ? (
                  <div className="mt-4 flex flex-col gap-4 min-[430px]:flex-row min-[430px]:items-center min-[430px]:gap-5">
                    <div className="relative mx-auto flex h-32 w-32 shrink-0 items-center justify-center min-[430px]:mx-0">
                      <svg className="absolute inset-0 h-full w-full -rotate-90">
                        <circle
                          cx="64"
                          cy="64"
                          r="50"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="12"
                          className="text-slate-100"
                        />
                        {ringSegments.map((segment) => (
                          <circle
                            key={segment.key}
                            cx="64"
                            cy="64"
                            r="50"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="12"
                            strokeDasharray={segment.dashArray}
                            strokeDashoffset={segment.dashOffset}
                            strokeLinecap="butt"
                            className={segment.colorClassName}
                          />
                        ))}
                      </svg>
                      <div className="text-center">
                        <div className="text-2xl font-black tracking-tight text-slate-900">
                          {formatHours(totalHours)}
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                          已记录
                        </div>
                      </div>
                    </div>

                    <div className="min-w-0 flex-1 space-y-2.5">
                      {ranking.slice(0, 4).map((activity, index) => (
                        <div
                          key={activity.type}
                          className="flex items-center justify-between gap-3 rounded-[18px] bg-slate-50/90 px-3 py-2.5">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="rounded-full bg-slate-900 px-2 py-1 text-[9px] font-black text-white whitespace-nowrap">
                              TOP{index + 1}
                            </span>
                            <span className={cn('h-2.5 w-2.5 rounded-full', activity.baseColor)} />
                            <span className="truncate text-sm font-black text-slate-800">{activity.label}</span>
                          </div>
                          <span className="shrink-0 text-sm font-black text-slate-700">
                            {formatHours(activity.hours)}h
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-[22px] bg-slate-50/90 px-4 py-6 text-center">
                    <p className="text-sm font-black text-slate-700">这一天还没有可展示的分布</p>
                    <p className="mt-1 text-[11px] font-medium text-slate-400">先有记录，这里才会形成结构和排行。</p>
                  </div>
                )}
              </section>

              <section className="rounded-[28px] border border-slate-100 bg-white/90 p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <Clock3 size={18} className="text-indigo-500" />
                  <h4 className="text-base font-black text-slate-800">当天流水</h4>
                </div>

                {dailyAllocations.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {dailyAllocations.map((allocation) => {
                      const activity = getActivityConfig(allocation.type);
                      return (
                        <div
                          key={allocation.id}
                          className="flex items-center gap-3 rounded-[22px] bg-slate-50/90 px-4 py-3">
                          <div
                            className={cn(
                              'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm',
                              activity?.baseColor,
                            )}>
                            {activity?.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-black text-slate-800">{activity?.label}</p>
                              <span
                                className={cn(
                                  'rounded-full px-2 py-0.5 text-[10px] font-black',
                                  allocation.used
                                    ? 'bg-indigo-50 text-indigo-600'
                                    : 'bg-slate-100 text-slate-500',
                                )}>
                                {allocation.used ? '已投喂' : '未投喂'}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] font-medium text-slate-400">
                              {new Date(allocation.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                          <span className="shrink-0 whitespace-nowrap text-sm font-black text-slate-700">
                            +{formatHours(allocation.hours)}h
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-4 rounded-[22px] bg-slate-50/90 px-4 py-6 text-center">
                    <p className="text-sm font-black text-slate-700">这一天没有流水记录</p>
                  </div>
                )}
              </section>

              <div className="grid grid-cols-2 gap-3 pb-2">
                <div className="rounded-[24px] bg-slate-50/90 px-4 py-3">
                  <p className="text-[11px] font-semibold text-slate-400">已投喂</p>
                  <p className="mt-2 text-xl font-black text-slate-800">{usedCount} 条</p>
                </div>
                <div className="rounded-[24px] bg-slate-50/90 px-4 py-3">
                  <p className="text-[11px] font-semibold text-slate-400">未投喂</p>
                  <p className="mt-2 text-xl font-black text-slate-800">{unusedCount} 条</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
