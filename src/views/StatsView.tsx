import React, {useMemo, useState} from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Flame,
  History,
  Layers3,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import {DayDetailSheet} from '../components/DayDetailSheet';
import {TimeHeatmap} from '../components/TimeHeatmap';
import {ACTIVITY_CONFIG, createEmptyActivityTotals} from '../constants/activities';
import {type ActivityType, useStore} from '../store/useStore';
import {cn} from '../utils/cn';
import {formatMonthDay, getDateKey, getSimulatedDate} from '../utils/date';

type PeriodKey = 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth';
type TrendMetricKey = 'total' | 'focus' | ActivityType;

interface RangeConfig {
  periodLabel: string;
  compareLabel: string;
  rangeLabel: string;
  startDate: Date;
  endDate: Date;
  compareStartDate: Date;
  compareEndDate: Date;
}

interface DayMetrics {
  date: Date;
  dateKey: string;
  shortLabel: string;
  shortDate: string;
  total: number;
  focus: number;
  typeTotals: Record<ActivityType, number>;
  complete: boolean;
}

interface TrendMetricOption {
  key: TrendMetricKey;
  label: string;
  baseMax: number;
  color: string;
  glowColor: string;
  badgeClassName: string;
}

const PERIOD_OPTIONS: Array<{key: PeriodKey; label: string}> = [
  {key: 'thisWeek', label: '本周'},
  {key: 'lastWeek', label: '上周'},
  {key: 'thisMonth', label: '本月'},
  {key: 'lastMonth', label: '上月'},
];

const TREND_OPTIONS: TrendMetricOption[] = [
  {
    key: 'total',
    label: '总记录',
    baseMax: 24,
    color: '#7c7bff',
    glowColor: 'rgba(124, 123, 255, 0.28)',
    badgeClassName: 'bg-indigo-500',
  },
  {
    key: 'focus',
    label: '专注',
    baseMax: 16,
    color: '#fb7185',
    glowColor: 'rgba(251, 113, 133, 0.28)',
    badgeClassName: 'bg-rose-500',
  },
  ...ACTIVITY_CONFIG.map((activity) => ({
    key: activity.type,
    label: activity.label,
    baseMax: activity.type === 'rest' ? 16 : 12,
    color: activity.hexColor,
    glowColor: `${activity.hexColor}44`,
    badgeClassName: activity.baseColor,
  })),
];

function cloneDate(date: Date) {
  return new Date(date);
}

function addDays(date: Date, days: number) {
  const nextDate = cloneDate(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function addMonths(date: Date, months: number) {
  const nextDate = cloneDate(date);
  nextDate.setMonth(nextDate.getMonth() + months);
  return nextDate;
}

function startOfWeek(date: Date) {
  const nextDate = cloneDate(date);
  nextDate.setHours(0, 0, 0, 0);
  nextDate.setDate(nextDate.getDate() - nextDate.getDay());
  return nextDate;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function diffDaysInclusive(startDate: Date, endDate: Date) {
  const startTime = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
  const endTime = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime();
  return Math.floor((endTime - startTime) / 86_400_000) + 1;
}

function buildDateSeries(startDate: Date, endDate: Date) {
  const dates: Date[] = [];
  const cursor = cloneDate(startDate);

  while (cursor <= endDate) {
    dates.push(cloneDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function stdDev(values: number[]) {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function formatRangeLabel(startDate: Date, endDate: Date) {
  return `${formatMonthDay(startDate)} - ${formatMonthDay(endDate)}`;
}

function formatSigned(value: number, suffix: string, digits = 1) {
  const rounded = value.toFixed(digits);
  return `${value >= 0 ? '+' : ''}${rounded}${suffix}`;
}

function roundToHalf(value: number) {
  return Math.round(value * 2) / 2;
}

function buildDayMetrics(
  date: Date,
  allocations: ReturnType<typeof useStore.getState>['allocations'],
): DayMetrics {
  const dateKey = getDateKey(date);
  const typeTotals = createEmptyActivityTotals();
  let total = 0;

  (allocations[dateKey] || []).forEach((allocation) => {
    typeTotals[allocation.type] += allocation.hours;
    total += allocation.hours;
  });

  const focus = typeTotals.work + typeTotals.study;

  return {
    date,
    dateKey,
    shortLabel: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()],
    shortDate: `${date.getMonth() + 1}/${date.getDate()}`,
    total,
    focus,
    typeTotals,
    complete: total >= 23.5,
  };
}

function aggregateTypeTotals(days: DayMetrics[]) {
  const totals = createEmptyActivityTotals();

  days.forEach((day) => {
    ACTIVITY_CONFIG.forEach((activity) => {
      totals[activity.type] += day.typeTotals[activity.type];
    });
  });

  return totals;
}

function buildRangeConfig(period: PeriodKey, todayDate: Date): RangeConfig {
  if (period === 'thisWeek') {
    const startDate = startOfWeek(todayDate);
    const endDate = cloneDate(todayDate);
    const compareEndDate = addDays(startDate, -1);
    const compareStartDate = addDays(compareEndDate, -(diffDaysInclusive(startDate, endDate) - 1));

    return {
      periodLabel: '本周',
      compareLabel: '对比上周同期',
      rangeLabel: formatRangeLabel(startDate, endDate),
      startDate,
      endDate,
      compareStartDate,
      compareEndDate,
    };
  }

  if (period === 'lastWeek') {
    const endDate = addDays(startOfWeek(todayDate), -1);
    const startDate = addDays(endDate, -6);
    const compareEndDate = addDays(endDate, -7);
    const compareStartDate = addDays(startDate, -7);

    return {
      periodLabel: '上周',
      compareLabel: '对比前一周',
      rangeLabel: formatRangeLabel(startDate, endDate),
      startDate,
      endDate,
      compareStartDate,
      compareEndDate,
    };
  }

  if (period === 'thisMonth') {
    const startDate = startOfMonth(todayDate);
    const endDate = cloneDate(todayDate);
    const compareStartDate = startOfMonth(addMonths(todayDate, -1));
    const compareMonthEnd = endOfMonth(compareStartDate);
    const compareEndDate = new Date(
      compareStartDate.getFullYear(),
      compareStartDate.getMonth(),
      Math.min(compareMonthEnd.getDate(), diffDaysInclusive(startDate, endDate)),
    );

    return {
      periodLabel: '本月',
      compareLabel: '对比上月同期',
      rangeLabel: formatRangeLabel(startDate, endDate),
      startDate,
      endDate,
      compareStartDate,
      compareEndDate,
    };
  }

  const targetMonth = addMonths(todayDate, -1);
  const startDate = startOfMonth(targetMonth);
  const endDate = endOfMonth(targetMonth);
  const compareMonth = addMonths(todayDate, -2);
  const compareStartDate = startOfMonth(compareMonth);
  const compareEndDate = endOfMonth(compareMonth);

  return {
    periodLabel: '上月',
    compareLabel: '对比前一月',
    rangeLabel: formatRangeLabel(startDate, endDate),
    startDate,
    endDate,
    compareStartDate,
    compareEndDate,
  };
}

function getTrendMetricValue(day: DayMetrics, metric: TrendMetricKey) {
  if (metric === 'total') return day.total;
  if (metric === 'focus') return day.focus;
  return day.typeTotals[metric as ActivityType];
}

function getScaleMax(option: TrendMetricOption, maxValue: number) {
  if (option.key === 'total') return 24;

  const step = option.baseMax >= 16 ? 4 : 2;
  return Math.max(option.baseMax, Math.ceil(Math.max(maxValue, 0.1) / step) * step);
}

function getCompletionSummary(
  currentTotalHours: number,
  currentRecordedDays: number,
  currentCompleteDays: number,
  totalDays: number,
  missingDays: number,
) {
  if (currentTotalHours <= 0.5) {
    return {
      title: '这个周期还没有形成可复盘数据',
      description: '先连续记几天，统计页才会更像复盘，而不是空白占位。',
    };
  }

  if (currentCompleteDays === totalDays && totalDays > 0) {
    return {
      title: '这段时间基本都记满了',
      description: `连续 ${totalDays} 天都有完整记录，现在更适合看结构和变化，而不是补漏。`,
    };
  }

  if (missingDays === 0) {
    return {
      title: '每天都有在记，剩下主要是补齐细节',
      description: `这段时间 ${currentRecordedDays}/${totalDays} 天都有记录，整体连续性已经不错。`,
    };
  }

  if (currentRecordedDays >= Math.ceil(totalDays * 0.75)) {
    return {
      title: '记录已经成型，但还有几天空着',
      description: `大部分天数都记了，当前还差 ${missingDays} 天没有补全。`,
    };
  }

  if (missingDays >= Math.ceil(totalDays / 2)) {
    return {
      title: '这个周期断档偏多，先把连续性拉起来',
      description: `目前只有 ${currentRecordedDays}/${totalDays} 天有记录，先让空白天变少，统计才会更可信。`,
    };
  }

  return {
    title: '记录在慢慢稳定下来',
    description: `当前累计 ${currentTotalHours.toFixed(1)}h，已经能看出节奏，但还可以继续补齐完整度。`,
  };
}

export function StatsView() {
  const {allocations, simulatedDateOffset} = useStore();
  const [period, setPeriod] = useState<PeriodKey>('thisWeek');
  const [trendMetric, setTrendMetric] = useState<TrendMetricKey>('total');
  const [selectedDetailDateKey, setSelectedDetailDateKey] = useState<string | null>(null);
  const sectionClassName =
    'glass-card rounded-[30px] border border-white/50 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)] min-[430px]:p-5';
  const softCardClassName = 'rounded-[24px] bg-slate-50/90 px-4 py-3';
  const metricCardClassName =
    'rounded-[24px] border border-slate-100 bg-white/85 px-4 py-3 shadow-sm';

  const todayDate = useMemo(() => getSimulatedDate(simulatedDateOffset), [simulatedDateOffset]);
  const rangeConfig = useMemo(() => buildRangeConfig(period, todayDate), [period, todayDate]);

  const currentDays = useMemo(
    () =>
      buildDateSeries(rangeConfig.startDate, rangeConfig.endDate).map((date) =>
        buildDayMetrics(date, allocations),
      ),
    [allocations, rangeConfig.endDate, rangeConfig.startDate],
  );

  const compareDays = useMemo(
    () =>
      buildDateSeries(rangeConfig.compareStartDate, rangeConfig.compareEndDate).map((date) =>
        buildDayMetrics(date, allocations),
      ),
    [allocations, rangeConfig.compareEndDate, rangeConfig.compareStartDate],
  );

  const currentTotals = useMemo(() => aggregateTypeTotals(currentDays), [currentDays]);
  const compareTotals = useMemo(() => aggregateTypeTotals(compareDays), [compareDays]);

  const currentTotalHours = currentDays.reduce((sum, day) => sum + day.total, 0);
  const compareTotalHours = compareDays.reduce((sum, day) => sum + day.total, 0);
  const currentFocusHours = currentDays.reduce((sum, day) => sum + day.focus, 0);
  const compareFocusHours = compareDays.reduce((sum, day) => sum + day.focus, 0);
  const currentAverageDailyHours =
    currentDays.length === 0 ? 0 : currentTotalHours / currentDays.length;
  const compareAverageDailyHours =
    compareDays.length === 0 ? 0 : compareTotalHours / compareDays.length;
  const currentRecordedDays = currentDays.filter((day) => day.total > 0.5).length;
  const currentCompleteDays = currentDays.filter((day) => day.complete).length;
  const compareCompleteDays = compareDays.filter((day) => day.complete).length;
  const currentFocusRatio =
    currentTotalHours <= 0.001 ? 0 : Math.round((currentFocusHours / currentTotalHours) * 100);
  const compareFocusRatio =
    compareTotalHours <= 0.001 ? 0 : Math.round((compareFocusHours / compareTotalHours) * 100);
  const partialDays = currentDays.filter((day) => day.total > 0.5 && !day.complete);
  const missingDays = currentDays.filter((day) => day.total <= 0.5).length;
  const dailyVolatility = stdDev(currentDays.map((day) => day.total));
  const coveragePercent =
    currentDays.length === 0
      ? 0
      : Math.min(100, Math.round((currentTotalHours / (currentDays.length * 24)) * 100));
  const recordedPercent =
    currentDays.length === 0 ? 0 : Math.round((currentRecordedDays / currentDays.length) * 100);
  const completePercent =
    currentDays.length === 0 ? 0 : Math.round((currentCompleteDays / currentDays.length) * 100);

  const consecutiveStreak = useMemo(() => {
    let streak = 0;
    const cursor = cloneDate(todayDate);

    while (streak < 365) {
      const total = (allocations[getDateKey(cursor)] || []).reduce(
        (sum, allocation) => sum + allocation.hours,
        0,
      );

      if (total <= 0.5) break;

      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    return streak;
  }, [allocations, todayDate]);

  const bestDay = useMemo(
    () =>
      [...currentDays].sort((left, right) => right.total - left.total)[0] ?? null,
    [currentDays],
  );
  const incompleteDays = useMemo(
    () =>
      [...currentDays]
        .filter((day) => !day.complete)
        .sort((left, right) => right.date.getTime() - left.date.getTime()),
    [currentDays],
  );
  const incompletePreview = incompleteDays.slice(0, 6);
  const hiddenIncompleteCount = Math.max(0, incompleteDays.length - incompletePreview.length);

  const summaryInsight = useMemo(
    () =>
      getCompletionSummary(
        currentTotalHours,
        currentRecordedDays,
        currentCompleteDays,
        currentDays.length,
        missingDays,
      ),
    [currentCompleteDays, currentDays.length, currentRecordedDays, currentTotalHours, missingDays],
  );
  const completeGoalTarget = Math.max(1, Math.min(currentDays.length, Math.round((5 * currentDays.length) / 7)));
  const focusGoalTarget = Math.max(4, roundToHalf((30 * currentDays.length) / 7));
  const completeGoalProgress = Math.min(
    100,
    completeGoalTarget <= 0 ? 0 : Math.round((currentCompleteDays / completeGoalTarget) * 100),
  );
  const focusGoalProgress = Math.min(
    100,
    focusGoalTarget <= 0 ? 0 : Math.round((currentFocusHours / focusGoalTarget) * 100),
  );
  const completeGoalRemaining = Math.max(0, completeGoalTarget - currentCompleteDays);
  const focusGoalRemaining = Math.max(0, focusGoalTarget - currentFocusHours);

  const compareOverviewItems = useMemo(
    () => [
      {
        label: '总记录',
        current: currentTotalHours,
        delta: currentTotalHours - compareTotalHours,
        suffix: 'h',
      },
      {
        label: '专注时长',
        current: currentFocusHours,
        delta: currentFocusHours - compareFocusHours,
        suffix: 'h',
      },
      {
        label: '完整天数',
        current: currentCompleteDays,
        delta: currentCompleteDays - compareCompleteDays,
        suffix: '天',
      },
      {
        label: '平均每天',
        current: currentAverageDailyHours,
        delta: currentAverageDailyHours - compareAverageDailyHours,
        suffix: 'h',
      },
    ],
    [
      compareAverageDailyHours,
      compareCompleteDays,
      compareFocusHours,
      compareTotalHours,
      currentAverageDailyHours,
      currentCompleteDays,
      currentFocusHours,
      currentTotalHours,
    ],
  );

  const activityChanges = useMemo(
    () =>
      ACTIVITY_CONFIG.map((activity) => {
        const current = currentTotals[activity.type];
        const compare = compareTotals[activity.type];
        const currentShare = currentTotalHours <= 0.001 ? 0 : (current / currentTotalHours) * 100;
        const compareShare = compareTotalHours <= 0.001 ? 0 : (compare / compareTotalHours) * 100;

        return {
          ...activity,
          current,
          compare,
          delta: current - compare,
          shareDelta: currentShare - compareShare,
        };
      }),
    [compareTotalHours, compareTotals, currentTotalHours, currentTotals],
  );

  const topRise = useMemo(
    () =>
      [...activityChanges]
        .filter((item) => item.delta > 0.2)
        .sort((left, right) => right.delta - left.delta)[0] ?? null,
    [activityChanges],
  );

  const topDrop = useMemo(
    () =>
      [...activityChanges]
        .filter((item) => item.delta < -0.2)
        .sort((left, right) => left.delta - right.delta)[0] ?? null,
    [activityChanges],
  );

  const compareInsight = useMemo(() => {
    if (compareTotalHours <= 0.5) {
      return '上一周期几乎没有可比数据，先把这段时间记稳，后面再看变化会更准。';
    }

    if (currentTotalHours - compareTotalHours >= 6 && currentCompleteDays >= compareCompleteDays) {
      return `比上一周期多记了 ${(currentTotalHours - compareTotalHours).toFixed(1)}h，而且完整记录天数也更多。`;
    }

    if (currentFocusRatio >= compareFocusRatio + 8) {
      return `专注占比提升了 ${currentFocusRatio - compareFocusRatio}% ，这段时间明显更聚焦。`;
    }

    if (currentTotalHours < compareTotalHours - 6) {
      return `比上一周期少记了 ${(compareTotalHours - currentTotalHours).toFixed(1)}h，优先补回空白天会更重要。`;
    }

    return '总量变化不算大，重点看哪类时间变多了、哪类时间被压缩了。';
  }, [
    compareCompleteDays,
    compareFocusRatio,
    compareTotalHours,
    currentCompleteDays,
    currentFocusRatio,
    currentTotalHours,
  ]);

  const sortedCategories = useMemo(
    () =>
      ACTIVITY_CONFIG.map((activity) => ({
        ...activity,
        hours: currentTotals[activity.type],
        percent: currentTotalHours <= 0.001 ? 0 : (currentTotals[activity.type] / currentTotalHours) * 100,
      })).sort((left, right) => right.hours - left.hours),
    [currentTotalHours, currentTotals],
  );

  const topCategories = sortedCategories.slice(0, 3);
  const dominantCategory = sortedCategories[0] ?? null;
  const secondCategory = sortedCategories[1] ?? null;
  const recapLine = useMemo(() => {
    if (currentTotalHours <= 0.5) {
      return `${rangeConfig.periodLabel}还没有形成有效记录样本，先把今天记起来，后面的趋势和结构才会更有意义。`;
    }

    const parts = [`${rangeConfig.periodLabel}共记录 ${currentTotalHours.toFixed(1)}h`];

    if (compareTotalHours > 0.5) {
      const delta = currentTotalHours - compareTotalHours;
      parts.push(
        delta >= 0 ? `比上个周期多 ${delta.toFixed(1)}h` : `比上个周期少 ${Math.abs(delta).toFixed(1)}h`,
      );
    } else {
      parts.push('上一周期暂时没有足够数据可比');
    }

    if (missingDays === 0 && partialDays.length === 0) {
      parts.push('这段时间没有漏记天');
    } else {
      if (missingDays > 0) parts.push(`有 ${missingDays} 天未记录`);
      if (partialDays.length > 0) parts.push(`${partialDays.length} 天未记满`);
    }

    if (dominantCategory && dominantCategory.hours > 0.5) {
      parts.push(`时间主要给了${dominantCategory.label}`);
    }

    return `${parts.join('，')}。`;
  }, [
    compareTotalHours,
    currentTotalHours,
    dominantCategory,
    missingDays,
    partialDays.length,
    rangeConfig.periodLabel,
  ]);

  const structureInsight = useMemo(() => {
    if (currentTotalHours <= 0.5 || !dominantCategory) {
      return '先形成连续记录，之后这里会很清楚地告诉你时间主要给了谁。';
    }

    if (dominantCategory.percent >= 45) {
      return `这段时间最主要的是${dominantCategory.label}，占了 ${Math.round(dominantCategory.percent)}%。`;
    }

    if (
      dominantCategory &&
      secondCategory &&
      Math.abs(dominantCategory.percent - secondCategory.percent) <= 8
    ) {
      return `${dominantCategory.label}和${secondCategory.label}占比接近，整体结构不算偏科。`;
    }

    return '时间分布相对均衡，没有某一类活动明显挤占其他类别。';
  }, [currentTotalHours, dominantCategory, secondCategory]);

  const stabilityInsight = useMemo(() => {
    if (currentTotalHours <= 0.5) {
      return '当前样本还不够，先把记录连起来。';
    }

    if (missingDays >= 3) {
      return `这段时间主要问题是断档，当前还有 ${missingDays} 天没记。`;
    }

    if (dailyVolatility >= 5) {
      return `每天记录量起伏有点大，波动约 ${dailyVolatility.toFixed(1)}h / 天。`;
    }

    if (consecutiveStreak >= 7) {
      return `已经连续记录 ${consecutiveStreak} 天，稳定性不错。`;
    }

    return '整体还算平稳，继续维持连续记录就好。';
  }, [consecutiveStreak, currentTotalHours, dailyVolatility, missingDays]);

  const selectedTrendOption =
    TREND_OPTIONS.find((option) => option.key === trendMetric) ?? TREND_OPTIONS[0];

  const trendDays = useMemo(
    () =>
      currentDays.map((day) => ({
        ...day,
        value: getTrendMetricValue(day, trendMetric),
      })),
    [currentDays, trendMetric],
  );

  const trendMaxValue = Math.max(...trendDays.map((day) => day.value), 0);
  const trendScaleMax = getScaleMax(selectedTrendOption, trendMaxValue);
  const hasTrendData = trendDays.some((day) => day.value > 0.01);
  const isDenseTrend = trendDays.length > 10;
  const trendGuideValues = [trendScaleMax, Math.round(trendScaleMax / 2), 0];

  const trendLabelIndices = useMemo(() => {
    if (trendDays.length === 0) return new Set<number>();

    if (!isDenseTrend) {
      return new Set(trendDays.map((_, index) => index));
    }

    return new Set([
      0,
      Math.floor((trendDays.length - 1) * 0.25),
      Math.floor((trendDays.length - 1) * 0.5),
      Math.floor((trendDays.length - 1) * 0.75),
      trendDays.length - 1,
    ]);
  }, [isDenseTrend, trendDays]);

  const trendBestDay = useMemo(
    () =>
      [...trendDays].sort((left, right) => right.value - left.value)[0] ?? null,
    [trendDays],
  );

  const trendAverage =
    trendDays.length === 0
      ? 0
      : trendDays.reduce((sum, day) => sum + day.value, 0) / trendDays.length;
  const trendActiveDays = trendDays.filter((day) => day.value > 0.01).length;

  return (
    <div className="flex-1 overflow-y-auto scroll-hide bg-slate-50 pb-28">
      <header className="px-5 pt-5 pb-2">
        <h1 className="text-2xl font-black tracking-tight text-slate-900">统计</h1>
        <p className="mt-1 text-sm text-slate-400">
          看清这段时间记得够不够、结构偏不偏、节奏稳不稳。
        </p>
      </header>

      <main className="space-y-5 px-5">
        <section className={sectionClassName}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-start gap-2 text-slate-800">
                <CalendarRange size={18} className="text-indigo-500" />
                <h2 className="text-lg font-black">周期切换</h2>
              </div>
              <p className="mt-2 text-[11px] font-medium text-slate-400">
                {rangeConfig.rangeLabel} · {rangeConfig.compareLabel}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black text-indigo-600">
              {rangeConfig.periodLabel}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.key}
                onClick={() => setPeriod(option.key)}
                className={cn(
                  'rounded-2xl px-2.5 py-3 text-xs font-black whitespace-nowrap transition-all',
                  period === option.key
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-200'
                    : 'bg-white text-slate-500 shadow-sm',
                )}>
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section className={sectionClassName}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-start gap-2 text-slate-800">
                <Sparkles size={18} className="text-indigo-500" />
                <h2 className="text-lg font-black">记录概览</h2>
              </div>
              <p className="mt-1 text-[11px] font-medium text-slate-400">
                先把这个周期最重要的信息说人话，再往下看细节。
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-500">
              覆盖 {coveragePercent}%
            </span>
          </div>

          <div className="mt-4 rounded-[28px] bg-[linear-gradient(135deg,rgba(16,185,129,0.12)_0%,rgba(255,255,255,0.96)_100%)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="mt-2 text-base leading-7 font-black text-slate-900">{recapLine}</p>
                <p className="mt-3 text-[11px] font-medium text-slate-500">{summaryInsight.description}</p>
              </div>
              <CheckCircle2 size={18} className="mt-1 shrink-0 text-emerald-500" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className={softCardClassName}>
              <p className="text-[11px] font-semibold text-slate-400">总记录</p>
              <p className="mt-2 text-2xl font-black text-slate-800">
                {currentTotalHours.toFixed(1)}
                <span className="ml-1 text-sm font-medium text-slate-400">h</span>
              </p>
            </div>
            <div className={softCardClassName}>
              <p className="text-[11px] font-semibold text-slate-400">有记录天数</p>
              <p className="mt-2 text-2xl font-black text-slate-800">
                {currentRecordedDays}
                <span className="ml-1 text-sm font-medium text-slate-400">/ {currentDays.length} 天</span>
              </p>
            </div>
            <div className={softCardClassName}>
              <p className="text-[11px] font-semibold text-slate-400">平均每天</p>
              <p className="mt-2 text-2xl font-black text-slate-800">{currentAverageDailyHours.toFixed(1)}h</p>
            </div>
            <button
              type="button"
              onClick={() => bestDay && bestDay.total > 0.01 && setSelectedDetailDateKey(bestDay.dateKey)}
              disabled={!bestDay || bestDay.total <= 0.01}
              className={cn(
                softCardClassName,
                'text-left transition-all',
                bestDay && bestDay.total > 0.01 ? 'active:scale-[0.98]' : 'cursor-default',
              )}>
              <p className="text-[11px] font-semibold text-slate-400">记得最多的一天</p>
              <p className="mt-2 text-base font-black text-slate-800">
                {bestDay ? `${bestDay.shortDate} · ${bestDay.total.toFixed(1)}h` : '暂无'}
              </p>
            </button>
          </div>
        </section>

        <section className={sectionClassName}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-start gap-2 text-slate-800">
                <CheckCircle2 size={18} className="text-emerald-500" />
                <h2 className="text-lg font-black">完整性提醒</h2>
              </div>
              <p className="mt-1 text-[11px] font-medium text-slate-400">
                这里只做历史完整性提醒，不提供跨日期补录入口。
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-500">
              未完成 {incompleteDays.length} 天
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className={softCardClassName}>
              <p className="text-[11px] font-semibold text-slate-400">完整记录</p>
              <p className="mt-2 text-xl font-black text-slate-800">{currentCompleteDays}天</p>
            </div>
            <div className={softCardClassName}>
              <p className="text-[11px] font-semibold text-slate-400">部分记录</p>
              <p className="mt-2 text-xl font-black text-slate-800">{partialDays.length}天</p>
            </div>
            <div className={softCardClassName}>
              <p className="text-[11px] font-semibold text-slate-400">未记录</p>
              <p className="mt-2 text-xl font-black text-slate-800">{missingDays}天</p>
            </div>
          </div>

          <div className="mt-4 rounded-[24px] bg-slate-50/90 p-4">
            {incompletePreview.length > 0 ? (
              <div className="space-y-3">
                {incompletePreview.map((day) => {
                  const isMissing = day.total <= 0.5;

                  return (
                    <button
                      key={day.dateKey}
                      type="button"
                      onClick={() => setSelectedDetailDateKey(day.dateKey)}
                      className="flex w-full items-center justify-between gap-3 rounded-[18px] bg-white/90 px-4 py-3 text-left transition-all active:scale-[0.98]">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-black text-slate-800">{formatMonthDay(day.date)}</p>
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[10px] font-black',
                              isMissing ? 'bg-rose-50 text-rose-500' : 'bg-amber-50 text-amber-600',
                            )}>
                            {isMissing ? '未记录' : '未记满'}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] font-medium text-slate-500">
                          {isMissing ? '当天没有记录内容' : `当天已记录 ${day.total.toFixed(1)}h，还没达到完整记录`}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-black text-slate-400">
                        {isMissing ? '0h' : `${day.total.toFixed(1)}h`}
                      </span>
                    </button>
                  );
                })}

                {hiddenIncompleteCount > 0 ? (
                  <p className="text-center text-[11px] font-medium text-slate-400">
                    还有 {hiddenIncompleteCount} 天未展开，当前先展示最近的提醒。
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="rounded-[18px] bg-white/90 px-4 py-5 text-center">
                <p className="text-sm font-black text-slate-800">这个周期没有漏记或未记满的日期</p>
                <p className="mt-1 text-[11px] font-medium text-slate-500">完整性很稳，这块暂时不用操心。</p>
              </div>
            )}
          </div>
        </section>

        <section className={sectionClassName}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-start gap-2 text-slate-800">
                <Target size={18} className="text-sky-500" />
                <h2 className="text-lg font-black">参考目标</h2>
              </div>
              <p className="mt-1 text-[11px] font-medium text-slate-400">
                这里不是你手动设置的目标，而是系统给的一条参考线：每 7 天约 5 天完整记录、30h 专注。
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-sky-50 px-3 py-1 text-[10px] font-black text-sky-600">
              系统参考
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 min-[430px]:grid-cols-2">
            <div className="rounded-[24px] bg-slate-50/90 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-slate-400">完整记录目标</p>
                  <p className="mt-2 text-2xl font-black text-slate-800">
                    {currentCompleteDays}
                    <span className="ml-1 text-sm font-medium text-slate-400">/ {completeGoalTarget} 天</span>
                  </p>
                </div>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[10px] font-black',
                    completeGoalRemaining === 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600',
                  )}>
                  {completeGoalRemaining === 0 ? '已达成' : `还差 ${completeGoalRemaining} 天`}
                </span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500"
                  style={{width: `${completeGoalProgress}%`}}
                />
              </div>
            </div>

            <div className="rounded-[24px] bg-slate-50/90 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-slate-400">专注时长目标</p>
                  <p className="mt-2 text-2xl font-black text-slate-800">
                    {currentFocusHours.toFixed(1)}
                    <span className="ml-1 text-sm font-medium text-slate-400">/ {focusGoalTarget.toFixed(1)}h</span>
                  </p>
                </div>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[10px] font-black',
                    focusGoalRemaining <= 0.05 ? 'bg-emerald-50 text-emerald-600' : 'bg-sky-50 text-sky-600',
                  )}>
                  {focusGoalRemaining <= 0.05 ? '已达成' : `还差 ${focusGoalRemaining.toFixed(1)}h`}
                </span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 to-sky-500 transition-all duration-500"
                  style={{width: `${focusGoalProgress}%`}}
                />
              </div>
            </div>
          </div>
        </section>

        <section className={sectionClassName}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-start gap-2 text-slate-800">
                <TrendingUp size={18} className="text-indigo-500" />
                <h2 className="text-lg font-black">周期对比</h2>
              </div>
              <p className="mt-1 text-[11px] font-medium text-slate-400">{compareInsight}</p>
            </div>
            <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-500">
              {rangeConfig.compareLabel}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {compareOverviewItems.map((item) => {
              const rising = item.delta >= 0;
              const digits = item.suffix === '天' ? 0 : 1;

              return (
                <div key={item.label} className={metricCardClassName}>
                  <p className="text-[11px] font-semibold text-slate-400">{item.label}</p>
                  <div className="mt-2 flex items-end gap-1">
                    <p className="text-[2rem] leading-none font-black text-slate-800">
                      {item.current.toFixed(digits)}
                      <span className="ml-1 text-xs font-normal text-slate-400">{item.suffix}</span>
                    </p>
                  </div>
                  <div className="mt-3 flex flex-col items-start gap-1.5">
                    <span className="text-[10px] font-medium whitespace-nowrap text-slate-400">较上期</span>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-black',
                        rising ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500',
                      )}>
                      {rising ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                      {formatSigned(item.delta, item.suffix, digits)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 min-[430px]:grid-cols-2">
            <div className={softCardClassName}>
              <p className="text-[11px] font-semibold text-slate-400">增加最多</p>
              {topRise ? (
                <>
                  <div className="mt-2 flex items-center gap-2">
                    <div className={cn('h-2.5 w-2.5 rounded-full', topRise.baseColor)} />
                    <p className="text-base font-black text-slate-800">{topRise.label}</p>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-emerald-600">
                    {formatSigned(topRise.delta, 'h', 1)}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-slate-500">
                    当前 {topRise.current.toFixed(1)}h，较上周期占比 {Math.round(topRise.shareDelta)}%
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm font-medium text-slate-500">这段时间没有明显增加的类别</p>
              )}
            </div>

            <div className={softCardClassName}>
              <p className="text-[11px] font-semibold text-slate-400">减少最多</p>
              {topDrop ? (
                <>
                  <div className="mt-2 flex items-center gap-2">
                    <div className={cn('h-2.5 w-2.5 rounded-full', topDrop.baseColor)} />
                    <p className="text-base font-black text-slate-800">{topDrop.label}</p>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-rose-500">
                    {formatSigned(topDrop.delta, 'h', 1)}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-slate-500">
                    当前 {topDrop.current.toFixed(1)}h，较上周期占比 {Math.round(topDrop.shareDelta)}%
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm font-medium text-slate-500">这段时间没有明显减少的类别</p>
              )}
            </div>
          </div>
        </section>

        <section className={sectionClassName}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-start gap-2 text-slate-800">
                <Flame size={18} className="text-indigo-500" />
                <h2 className="text-lg font-black">近期趋势</h2>
              </div>
              <p className="mt-1 text-[11px] font-medium text-slate-400">
                可以切换看总记录、专注或单类活动；周期变长时会自动改成密集柱状图。
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black text-indigo-600">
              {selectedTrendOption.label}
            </span>
          </div>

          <div className="-mx-1 mt-4 overflow-x-auto scroll-hide pb-1">
            <div className="flex min-w-max gap-2 px-1">
              {TREND_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  onClick={() => setTrendMetric(option.key)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-black whitespace-nowrap transition-all',
                    trendMetric === option.key
                      ? 'border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-200'
                      : 'border-slate-200 bg-white text-slate-500',
                  )}>
                  <span className={cn('h-2 w-2 rounded-full', option.badgeClassName)} />
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-[28px] border border-slate-100 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', selectedTrendOption.badgeClassName)} />
                <p className="truncate text-sm font-black text-slate-800">{rangeConfig.periodLabel} · {selectedTrendOption.label}趋势</p>
              </div>
              <span className="shrink-0 text-[10px] font-medium text-slate-400">单位：小时</span>
            </div>

            {hasTrendData ? (
              <div className="relative h-48">
                <div className="absolute left-0 top-0 bottom-6 flex w-8 flex-col justify-between text-[10px] font-medium text-slate-400">
                  {trendGuideValues.map((value, index) => (
                    <span key={`${value}-${index}`}>{value}h</span>
                  ))}
                </div>

                <div className="absolute left-10 right-0 top-0 bottom-6">
                  <div className="absolute inset-0 flex flex-col justify-between">
                    {trendGuideValues.map((value, index) => (
                      <div
                        key={`${value}-${index}`}
                        className={cn('border-t border-slate-100', index === trendGuideValues.length - 1 ? 'border-slate-200' : '')}
                      />
                    ))}
                  </div>

                  <div
                    className={cn(
                      'absolute inset-0 grid items-end',
                      isDenseTrend ? 'gap-[3px]' : 'gap-2',
                    )}
                    style={{gridTemplateColumns: `repeat(${trendDays.length}, minmax(0, 1fr))`}}>
                    {trendDays.map((day) => {
                      const heightPercent =
                        day.value <= 0.01 ? 0 : Math.max(6, (day.value / trendScaleMax) * 100);

                      return (
                        <div key={day.dateKey} className="flex h-full items-end justify-center">
                          {day.value > 0.01 ? (
                            <button
                              type="button"
                              onClick={() => setSelectedDetailDateKey(day.dateKey)}
                              className="flex h-full w-full items-end justify-center focus:outline-none">
                              <div
                              className="w-full rounded-[4px] transition-all duration-500"
                              style={{
                                height: `${heightPercent}%`,
                                maxWidth: isDenseTrend ? '10px' : '16px',
                                backgroundColor: selectedTrendOption.color,
                                boxShadow: `0 6px 14px ${selectedTrendOption.glowColor}`,
                              }}
                            />
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div
                  className={cn(
                    'absolute bottom-0 left-10 right-0 grid h-5 items-end',
                    isDenseTrend ? 'gap-[3px]' : 'gap-2',
                  )}
                  style={{gridTemplateColumns: `repeat(${trendDays.length}, minmax(0, 1fr))`}}>
                    {trendDays.map((day, index) => (
                      <div key={`${day.dateKey}-label`} className="flex justify-center overflow-visible">
                        {trendLabelIndices.has(index) ? (
                          <span className="whitespace-nowrap text-[9px] font-medium text-slate-400">
                            {day.shortDate}
                          </span>
                        ) : null}
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <div className="flex h-44 items-center justify-center text-sm font-medium text-slate-500">
                这个周期还没有相关记录，图表暂时为空
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className={softCardClassName}>
              <p className="text-[11px] font-semibold text-slate-400">
                {trendMetric === 'total' ? '记录最多的一天' : `${selectedTrendOption.label}最多`}
              </p>
              <p className="mt-2 text-base font-black text-slate-800">
                {trendBestDay && trendBestDay.value > 0.01
                  ? `${trendBestDay.shortDate} · ${trendBestDay.value.toFixed(1)}h`
                  : '暂无'}
              </p>
            </div>
            <div className={softCardClassName}>
              <p className="text-[11px] font-semibold text-slate-400">
                {trendMetric === 'total' ? '有记录天数' : `有${selectedTrendOption.label}天数`}
              </p>
              <p className="mt-2 text-base font-black text-slate-800">{trendActiveDays} 天</p>
            </div>
            <div className={cn(softCardClassName, 'col-span-2')}>
              <p className="text-[11px] font-semibold text-slate-400">
                {trendMetric === 'total' ? '平均每天' : `${selectedTrendOption.label}日均`}
              </p>
              <p className="mt-2 text-base font-black text-slate-800">{trendAverage.toFixed(1)}h</p>
            </div>
          </div>
        </section>

        <section className={sectionClassName}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-start gap-2 text-slate-800">
                <Layers3 size={18} className="text-indigo-500" />
                <h2 className="text-lg font-black">时间结构</h2>
              </div>
              <p className="mt-1 text-[11px] font-medium text-slate-400">{structureInsight}</p>
            </div>
            {dominantCategory ? (
              <span className="shrink-0 rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black text-indigo-600">
                TOP1 · {dominantCategory.label}
              </span>
            ) : null}
          </div>

          <div className="mt-4 space-y-3">
            {topCategories.map((item, index) => (
              <div key={item.type} className="rounded-[24px] bg-slate-50/90 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-black text-white">
                        TOP{index + 1}
                      </span>
                      <div className={cn('h-2.5 w-2.5 rounded-full', item.baseColor)} />
                      <span className="truncate text-sm font-black text-slate-800">{item.label}</span>
                    </div>
                    <p className="mt-2 text-[11px] font-medium text-slate-500">
                      当前周期累计 {item.hours.toFixed(1)}h
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-black text-slate-800">{Math.round(item.percent)}%</p>
                    <p className="text-[11px] font-medium text-slate-400">占比</p>
                  </div>
                </div>

                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', item.baseColor)}
                    style={{width: `${item.percent}%`}}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={sectionClassName}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-start gap-2 text-slate-800">
                <Clock3 size={18} className="text-indigo-500" />
                <h2 className="text-lg font-black">记录稳定性</h2>
              </div>
              <p className="mt-1 text-[11px] font-medium text-slate-400">{stabilityInsight}</p>
            </div>
            <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-500">
              连续性
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className={metricCardClassName}>
              <p className="text-[11px] font-semibold text-slate-400">连续记录</p>
              <p className="mt-2 text-xl font-black text-slate-800">{consecutiveStreak}天</p>
            </div>
            <div className={metricCardClassName}>
              <p className="text-[11px] font-semibold text-slate-400">空白天数</p>
              <p className="mt-2 text-xl font-black text-slate-800">{missingDays}天</p>
            </div>
            <div className={cn(metricCardClassName, 'col-span-2')}>
              <p className="text-[11px] font-semibold text-slate-400">有记录率</p>
              <p className="mt-2 text-xl font-black text-slate-800">{recordedPercent}%</p>
            </div>
          </div>
        </section>

        <section className={sectionClassName}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-start gap-2 text-slate-800">
                <History size={18} className="text-indigo-500" />
                <h2 className="text-lg font-black">历史热力图</h2>
              </div>
              <p className="mt-1 text-[11px] font-medium text-slate-400">
                热力图更适合快速找历史记录，点进去再看当天详情。
              </p>
            </div>
          </div>

          <TimeHeatmap
            allocations={allocations}
            simulatedDateOffset={simulatedDateOffset}
            variant="plain"
            onDaySelect={setSelectedDetailDateKey}
            selectedDateKey={selectedDetailDateKey}
          />
        </section>
      </main>

      <DayDetailSheet
        open={selectedDetailDateKey !== null}
        dateKey={selectedDetailDateKey}
        allocations={allocations}
        onClose={() => setSelectedDetailDateKey(null)}
      />
    </div>
  );
}
