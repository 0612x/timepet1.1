import React, {useEffect, useMemo, useState} from 'react';
import {Calendar, ChevronLeft, ChevronRight} from 'lucide-react';
import {ACTIVITY_CONFIG, createEmptyActivityTotals} from '../constants/activities';
import type {ActivityType, Allocation} from '../store/useStore';
import {cn} from '../utils/cn';
import {getDateKey, getSimulatedDate} from '../utils/date';

type HeatmapFilter = 'all' | ActivityType;
type HeatmapView = 'week' | 'month' | 'year';
const WEEK_LABEL = '周';
const WEEK_TITLE = '本周';

interface DaySummary {
  date: string;
  dayOfMonth: number;
  total: number;
  typeHours: Record<ActivityType, number>;
  isCurrentMonth?: boolean;
  isCurrentYear?: boolean;
}

interface TimeHeatmapProps {
  allocations: Record<string, Allocation[]>;
  simulatedDateOffset: number;
  className?: string;
  title?: string;
  variant?: 'card' | 'plain';
  onDaySelect?: (dateKey: string) => void;
  selectedDateKey?: string | null;
}

function buildDaySummary(
  date: Date,
  allocations: Record<string, Allocation[]>,
  extraFields: Partial<DaySummary> = {},
): DaySummary {
  const dateKey = getDateKey(date);
  const typeHours = createEmptyActivityTotals();
  let total = 0;

  (allocations[dateKey] || []).forEach((allocation) => {
    typeHours[allocation.type] += allocation.hours;
    total += allocation.hours;
  });

  return {
    date: dateKey,
    dayOfMonth: date.getDate(),
    total,
    typeHours,
    ...extraFields,
  };
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function TimeHeatmap({
  allocations,
  simulatedDateOffset,
  className,
  title = '时间热力图',
  variant = 'card',
  onDaySelect,
  selectedDateKey,
}: TimeHeatmapProps) {
  const isPlain = variant === 'plain';
  const [heatmapView, setHeatmapView] = useState<HeatmapView>(isPlain ? 'week' : 'month');
  const [heatmapFilter, setHeatmapFilter] = useState<HeatmapFilter>('all');
  const [viewDate, setViewDate] = useState(() => getSimulatedDate(simulatedDateOffset));

  useEffect(() => {
    setViewDate(getSimulatedDate(simulatedDateOffset));
  }, [simulatedDateOffset]);

  const todayDate = useMemo(() => getSimulatedDate(simulatedDateOffset), [simulatedDateOffset]);
  const todayKey = useMemo(() => getDateKey(todayDate), [todayDate]);
  const canResetToToday = useMemo(() => {
    if (heatmapView === 'week') {
      const currentWeekStart = new Date(viewDate);
      currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());

      const todayWeekStart = new Date(todayDate);
      todayWeekStart.setDate(todayWeekStart.getDate() - todayWeekStart.getDay());

      return getDateKey(currentWeekStart) !== getDateKey(todayWeekStart);
    }

    if (heatmapView === 'month') {
      return (
        viewDate.getFullYear() !== todayDate.getFullYear() ||
        viewDate.getMonth() !== todayDate.getMonth()
      );
    }

    return viewDate.getFullYear() !== todayDate.getFullYear();
  }, [heatmapView, todayDate, viewDate]);

  const getTitleText = () => {
    if (heatmapView === 'week') return WEEK_TITLE;
    if (heatmapView === 'month') return `${viewDate.getFullYear()}年${viewDate.getMonth() + 1}月`;
    return `${viewDate.getFullYear()} 年度概览`;
  };

  const weekData = useMemo(() => {
    const rangeStart = new Date(viewDate);
    rangeStart.setDate(rangeStart.getDate() - rangeStart.getDay());
    const result: DaySummary[] = [];
    const currentDate = new Date(rangeStart);

    for (let index = 0; index < 7; index += 1) {
      result.push(buildDaySummary(currentDate, allocations));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  }, [allocations, viewDate]);

  const monthData = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const rangeStart = new Date(firstDay);
    rangeStart.setDate(rangeStart.getDate() - rangeStart.getDay());
    const rangeEnd = new Date(lastDay);

    if (rangeEnd.getDay() !== 6) {
      rangeEnd.setDate(rangeEnd.getDate() + (6 - rangeEnd.getDay()));
    }

    const result: DaySummary[] = [];
    const currentDate = new Date(rangeStart);

    while (currentDate <= rangeEnd) {
      result.push(
        buildDaySummary(currentDate, allocations, {
          isCurrentMonth: currentDate.getMonth() === month,
        }),
      );
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  }, [allocations, viewDate]);

  const yearData = useMemo(() => {
    const year = viewDate.getFullYear();
    const firstDay = new Date(year, 0, 1);
    const lastDay = new Date(year, 11, 31);
    const rangeStart = new Date(firstDay);
    rangeStart.setDate(rangeStart.getDate() - rangeStart.getDay());
    const rangeEnd = new Date(lastDay);

    if (rangeEnd.getDay() !== 6) {
      rangeEnd.setDate(rangeEnd.getDate() + (6 - rangeEnd.getDay()));
    }

    const result: DaySummary[] = [];
    const currentDate = new Date(rangeStart);

    while (currentDate <= rangeEnd) {
      result.push(
        buildDaySummary(currentDate, allocations, {
          isCurrentYear: currentDate.getFullYear() === year,
        }),
      );
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  }, [allocations, viewDate]);
  const yearColumnCount = Math.ceil(yearData.length / 7);

  const getHeatmapStyle = (day: DaySummary) => {
    const hours =
      heatmapFilter === 'all' ? day.total : day.typeHours[heatmapFilter as ActivityType];

    if (hours === 0) {
      return {
        className: 'bg-slate-100',
        style: {},
        isMulti: false,
        activeActivities: [] as typeof ACTIVITY_CONFIG,
      };
    }

    const stage = Math.min(10, Math.ceil(hours / 1.2));
    const opacity = stage / 10;

    if (heatmapFilter === 'all') {
      return {
        className: 'bg-transparent',
        style: {opacity},
        isMulti: true,
        activeActivities: ACTIVITY_CONFIG.filter((activity) => day.typeHours[activity.type] > 0),
      };
    }

    const currentActivity = ACTIVITY_CONFIG.find((activity) => activity.type === heatmapFilter);

    return {
      className: currentActivity?.baseColor ?? 'bg-slate-500',
      style: {opacity},
      isMulti: false,
      activeActivities: [] as typeof ACTIVITY_CONFIG,
    };
  };

  const navigateView = (direction: 'prev' | 'next') => {
    const nextDate = new Date(viewDate);

    if (heatmapView === 'week') {
      nextDate.setDate(nextDate.getDate() + (direction === 'next' ? 7 : -7));
    }
    if (heatmapView === 'month') {
      nextDate.setMonth(nextDate.getMonth() + (direction === 'next' ? 1 : -1));
    }
    if (heatmapView === 'year') {
      nextDate.setFullYear(nextDate.getFullYear() + (direction === 'next' ? 1 : -1));
    }

    setViewDate(nextDate);
  };

  const resetToToday = () => {
    setViewDate(getSimulatedDate(simulatedDateOffset));
  };

  const renderDayCell = (
    day: DaySummary,
    sizeClassName: string,
    textClassName: string,
    showInactiveMonth = true,
  ) => {
    const heatmapStyle = getHeatmapStyle(day);
    const hours =
      heatmapFilter === 'all' ? day.total : day.typeHours[heatmapFilter as ActivityType];
    const isToday = day.date === todayKey;
    const isSelected = day.date === selectedDateKey;

    return (
      <button
        key={day.date}
        type="button"
        onClick={() => onDaySelect?.(day.date)}
        className={cn(
          'relative aspect-square rounded-xl border-2',
          isSelected
            ? 'border-slate-900 shadow-[0_10px_22px_rgba(15,23,42,0.14)]'
            : isToday
              ? 'border-indigo-500'
              : 'border-transparent',
          showInactiveMonth && day.isCurrentMonth === false && 'opacity-30',
          onDaySelect ? 'cursor-pointer transition-transform active:scale-[0.96]' : 'cursor-default',
        )}
        disabled={!onDaySelect}>
        <div
          className={cn(
            'absolute inset-0 overflow-hidden rounded-xl border border-black/5 shadow-sm flex flex-col',
            sizeClassName,
            heatmapStyle.className,
          )}
          style={heatmapStyle.style}>
          {heatmapStyle.isMulti &&
            heatmapStyle.activeActivities.map((activity) => (
              <div
                key={activity.type}
                style={{
                  height: `${(day.typeHours[activity.type] / day.total) * 100}%`,
                  backgroundColor: activity.hexColor,
                }}
              />
            ))}
        </div>
        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center',
            textClassName,
            hours > 0 ? 'font-black text-white drop-shadow-md' : 'font-bold text-slate-400',
          )}>
          {day.dayOfMonth}
        </span>
      </button>
    );
  };

  const renderHeatmapContent = () => {
    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];

    if (heatmapView === 'week') {
      return (
        <div className="-mx-1 w-[calc(100%+0.5rem)]">
          <div className="mb-1 grid grid-cols-7 gap-px text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
            {dayNames.map((dayName) => (
              <div key={dayName}>{dayName}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px">
            {weekData.map((day) => renderDayCell(day, 'rounded-[10px]', 'text-[13px]', false))}
          </div>
        </div>
      );
    }

    if (heatmapView === 'month') {
      return (
        <div className="-mx-1 w-[calc(100%+0.5rem)]">
          <div className="mb-1 grid grid-cols-7 gap-px text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
            {dayNames.map((dayName) => (
              <div key={dayName}>{dayName}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px">
            {monthData.map((day) => renderDayCell(day, 'rounded-[10px]', 'text-[13px]'))}
          </div>
        </div>
      );
    }

    return (
      <div className="w-full">
        <div
          className="grid grid-rows-7 gap-[2px]"
          style={{gridTemplateColumns: `repeat(${yearColumnCount}, minmax(0, 1fr))`}}>
          {yearData.map((day) => {
            const heatmapStyle = getHeatmapStyle(day);

            return (
              <button
                key={day.date}
                type="button"
                title={`${day.date}: ${day.total.toFixed(1)}h`}
                onClick={() => {
                  if (day.isCurrentYear === false) return;
                  setViewDate(parseDateKey(day.date));
                  setHeatmapView('month');
                }}
                className={cn(
                  'aspect-square w-full overflow-hidden rounded-[2px] flex flex-col transition-transform',
                  day.isCurrentYear === false
                    ? 'cursor-default opacity-20'
                    : 'cursor-pointer hover:scale-[1.08]',
                  heatmapStyle.className,
                )}
                style={heatmapStyle.style}>
                {heatmapStyle.isMulti &&
                  heatmapStyle.activeActivities.map((activity) => (
                    <div
                      key={activity.type}
                      style={{
                        height: `${(day.typeHours[activity.type] / day.total) * 100}%`,
                        backgroundColor: activity.hexColor,
                      }}
                      />
                  ))}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const content = (
    <>
      {!isPlain && (
        <div className="mb-6 flex items-center gap-2">
          <Calendar size={18} className="text-indigo-500" />
          <h3 className="text-lg font-black text-slate-800">{title}</h3>
        </div>
      )}

      <div className={cn('flex flex-col gap-3', isPlain ? 'mb-3' : 'mb-6')}>
        <div className="flex items-center justify-between">
          <h4 className="text-base font-black text-slate-800">{getTitleText()}</h4>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigateView('prev')}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 shadow-sm transition-all active:scale-90 hover:border-indigo-100 hover:bg-indigo-50 hover:text-indigo-600">
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => navigateView('next')}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 shadow-sm transition-all active:scale-90 hover:border-indigo-100 hover:bg-indigo-50 hover:text-indigo-600">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex rounded-xl bg-slate-100 p-1">
            {(['week', 'month', 'year'] as HeatmapView[]).map((view) => (
              <button
                key={view}
                onClick={() => setHeatmapView(view)}
                className={cn(
                  'rounded-lg px-4 py-1.5 text-xs font-bold transition-all',
                  heatmapView === view
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700',
                )}>
                {view === 'week' ? WEEK_LABEL : view === 'month' ? '月' : '年'}
              </button>
            ))}
          </div>
          <button
            onClick={resetToToday}
            disabled={!canResetToToday}
            className={cn(
              'rounded-xl border px-3 py-1.5 text-xs font-bold transition-all',
              canResetToToday
                ? 'border-indigo-100 bg-indigo-50 text-indigo-600 active:scale-95'
                : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300',
            )}>
            回到今天
          </button>
        </div>
      </div>

      <div className={cn('flex flex-wrap gap-2', isPlain ? 'mb-3' : 'mb-6')}>
        <button
          onClick={() => setHeatmapFilter('all')}
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
            heatmapFilter === 'all'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'bg-slate-50 text-slate-500 hover:bg-slate-100',
          )}>
          全部
        </button>
        {ACTIVITY_CONFIG.map((activity) => (
          <button
            key={activity.type}
            onClick={() => setHeatmapFilter(activity.type)}
            className={cn(
              'flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
              heatmapFilter === activity.type
                ? `${activity.color} shadow-sm`
                : 'bg-slate-50 text-slate-500 hover:bg-slate-100',
            )}>
            <span className={cn('h-2 w-2 rounded-full', activity.baseColor)} />
            <span>{activity.label}</span>
          </button>
        ))}
      </div>

      {renderHeatmapContent()}

      <div className={cn('flex flex-col items-center', isPlain ? 'mt-4' : 'mt-6')}>
        <div className="mb-2 flex items-center space-x-1">
          <span className="text-[10px] font-medium text-slate-400">少</span>
          <div className="flex space-x-[2px]">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((stage) => {
              const currentActivity =
                heatmapFilter === 'all'
                  ? undefined
                  : ACTIVITY_CONFIG.find((activity) => activity.type === heatmapFilter);

              return (
                <div
                  key={stage}
                  className={cn(
                    'h-3 w-3 rounded-[2px]',
                    heatmapFilter === 'all' ? 'bg-slate-800' : currentActivity?.baseColor,
                  )}
                  style={{opacity: stage / 10}}
                />
              );
            })}
          </div>
          <span className="text-[10px] font-medium text-slate-400">多</span>
        </div>
        <div className="text-[10px] font-medium text-slate-400">颜色深度对应时间量 (0h - 12h+)</div>
      </div>
    </>
  );

  if (variant === 'plain') {
    return <div className={cn(className)}>{content}</div>;
  }

  return (
    <section className={cn('glass-card rounded-[32px] border-white/40 p-5 shadow-xl', className)}>
      {content}
    </section>
  );
}
