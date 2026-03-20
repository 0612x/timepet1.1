import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  BadgeCheck,
  Calendar as CalendarIcon,
  ChevronLeft,
  Check,
  CircleAlert,
  Copy,
  FastForward,
  FileText,
  Info,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import {AnimatePresence, motion} from 'motion/react';
import {DayDetailSheet} from '../components/DayDetailSheet';
import {TimeHeatmap} from '../components/TimeHeatmap';
import {
  ACTIVITY_CONFIG,
  createEmptyActivityTotals,
  getActivityConfig,
} from '../constants/activities';
import {
  useStore,
  ActivityType,
  Allocation,
  AllocationDraft,
  CompletedPet,
  PlanTemplate,
} from '../store/useStore';
import {cn} from '../utils/cn';
import {formatZhDate, getDateKey, getSimulatedDate} from '../utils/date';
import {PETS} from '../data/pets';
import {
  getPetSpriteOptionByKey,
  hasPetSpriteAction,
  isPetSpriteKey,
  type PetSpriteAction,
} from '../data/petSprites';
import {SpriteActor} from '../components/SpriteActor';

const RING_CIRCUMFERENCE = 352;
const EMPTY_ALLOCATIONS: Allocation[] = [];
const RING_ACTIVITY_ORDER: ActivityType[] = ACTIVITY_CONFIG.map((activity) => activity.type);
const TIME_PRESETS = [0.5, 1, 2, 4, 8];
type TemplateSheetMode = 'apply' | 'create-template' | 'edit-template' | null;
type TemplateSortMode = 'recent' | 'name' | 'hours';

interface AvatarStateConfig {
  label: string;
  description: string;
  ringGradient: string;
  chipClass: string;
  badgeClass: string;
  overlayClass: string;
  imageStyle: React.CSSProperties;
  badgeIcon: React.ReactNode;
}

interface SummaryInsightConfig {
  title: string;
  description: string;
  accent: string;
  background: string;
}

interface HomePasser {
  id: string;
  pet: CompletedPet;
  customImage?: string;
  startX: number;
  endX: number;
  topOffset: number;
  duration: number;
  delay: number;
  action: PetSpriteAction;
  flipX?: boolean;
}

function resolveHomePasserAction(petId: string): PetSpriteAction {
  if (hasPetSpriteAction(petId, 'move')) return 'move';
  if (hasPetSpriteAction(petId, 'idle')) return 'idle';
  if (hasPetSpriteAction(petId, 'happy')) return 'happy';
  if (hasPetSpriteAction(petId, 'feed')) return 'feed';
  return 'idle';
}

function getDistributionTotal(totals: Record<ActivityType, number>) {
  return (Object.values(totals) as number[]).reduce((sum, hours) => sum + hours, 0);
}

function buildRingSegments(
  totals: Record<ActivityType, number>,
  orderedTypes: ActivityType[],
  visibleHours: number,
) {
  let cumulativeHours = 0;
  let remainingVisibleHours = Math.max(0, visibleHours);

  return orderedTypes.flatMap((type) => {
    const hours = totals[type];
    const segmentStartHours = cumulativeHours;
    const visibleSegmentHours = Math.min(hours, remainingVisibleHours);
    cumulativeHours += hours;
    remainingVisibleHours = Math.max(0, remainingVisibleHours - visibleSegmentHours);

    if (visibleSegmentHours <= 0.001) return [];

    const activity = getActivityConfig(type);
    if (!activity) return [];

    return [
      {
        key: type,
        colorClassName: activity.baseColor.replace('bg-', 'text-'),
        dashArray: `${(visibleSegmentHours / 24) * RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`,
        dashOffset: `${-(segmentStartHours / 24) * RING_CIRCUMFERENCE}`,
      },
    ];
  });
}

function formatHours(hours: number) {
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded.toFixed(0)}` : rounded.toFixed(1);
}

function normalizeDraftCollection(drafts: AllocationDraft[]) {
  const totals = createEmptyActivityTotals();
  drafts.forEach((draft) => {
    if (draft.hours <= 0) return;
    totals[draft.type] += draft.hours;
  });

  return RING_ACTIVITY_ORDER.map((type) => ({
    type,
    hours: Math.round(totals[type] * 10) / 10,
  })).filter((draft) => draft.hours > 0);
}

function buildDraftsFromTotals(totals: Record<ActivityType, number>) {
  return normalizeDraftCollection(
    RING_ACTIVITY_ORDER.map((type) => ({
      type,
      hours: totals[type],
    })),
  );
}

function getDraftTotal(drafts: AllocationDraft[]) {
  return drafts.reduce((sum, draft) => sum + draft.hours, 0);
}

function setDraftHours(drafts: AllocationDraft[], type: ActivityType, hours: number) {
  const nextHours = Math.max(0, Math.round(hours * 10) / 10);
  const filteredDrafts = drafts.filter((draft) => draft.type !== type);

  if (nextHours <= 0) return normalizeDraftCollection(filteredDrafts);

  return normalizeDraftCollection([...filteredDrafts, {type, hours: nextHours}]);
}

function addDraftType(drafts: AllocationDraft[], type: ActivityType) {
  if (drafts.some((draft) => draft.type === type)) return normalizeDraftCollection(drafts);
  return normalizeDraftCollection([...drafts, {type, hours: 1}]);
}

function removeDraftType(drafts: AllocationDraft[], type: ActivityType) {
  return normalizeDraftCollection(drafts.filter((draft) => draft.type !== type));
}

function getMaxDraftHours(drafts: AllocationDraft[], type: ActivityType) {
  const currentHours = drafts.find((draft) => draft.type === type)?.hours ?? 0;
  return Math.max(0, 24 - (getDraftTotal(drafts) - currentHours));
}

function buildTemplateSummary(drafts: AllocationDraft[]) {
  const summary = [...normalizeDraftCollection(drafts)]
    .sort((left, right) => right.hours - left.hours)
    .slice(0, 3)
    .map((draft) => {
      const activity = getActivityConfig(draft.type);
      return `${activity?.label ?? draft.type} ${formatHours(draft.hours)}h`;
    })
    .join(' · ');

  return summary || '先添加几个活动模板';
}

interface AnimatedHoursValueProps {
  value: number;
  valueClassName: string;
  unitClassName?: string;
}

const AnimatedHoursValue = React.memo(function AnimatedHoursValue({
  value,
  valueClassName,
  unitClassName,
}: AnimatedHoursValueProps) {
  const displayValue = formatHours(value);
  const previousValueRef = useRef(value);
  const directionRef = useRef(1);

  if (value !== previousValueRef.current) {
    directionRef.current = value >= previousValueRef.current ? 1 : -1;
  }

  useEffect(() => {
    previousValueRef.current = value;
  }, [value]);

  return (
    <span className="inline-flex items-end">
      <span
        className={cn(
          'relative inline-flex overflow-hidden align-baseline whitespace-nowrap leading-[1.14]',
          valueClassName,
        )}
        style={{height: '1.26em', perspective: '240px'}}>
        <span aria-hidden className="invisible inline-block pt-[0.04em]">
          {displayValue}
        </span>
        <AnimatePresence initial={false} custom={directionRef.current}>
          <motion.span
            key={displayValue}
            custom={directionRef.current}
            initial={(direction) => ({
              y: direction > 0 ? '92%' : '-92%',
              opacity: 0,
              rotateX: direction > 0 ? -16 : 16,
              filter: 'blur(1.5px)',
            })}
            animate={{
              y: '0%',
              opacity: 1,
              rotateX: 0,
              filter: 'blur(0px)',
            }}
            exit={(direction) => ({
              y: direction > 0 ? '-92%' : '92%',
              opacity: 0,
              rotateX: direction > 0 ? 16 : -16,
              filter: 'blur(1.5px)',
            })}
            transition={{duration: 0.18, ease: [0.22, 1, 0.36, 1]}}
            className="absolute inset-0 inline-block pt-[0.04em] will-change-transform">
            {displayValue}
          </motion.span>
        </AnimatePresence>
      </span>
      {unitClassName ? <span className={unitClassName}>h</span> : null}
    </span>
  );
});

interface AllocationComposerPanelProps {
  remaining: number;
  onAllocate: (type: ActivityType, hours: number) => boolean;
}

const AllocationComposerPanel = React.memo(function AllocationComposerPanel({
  remaining,
  onAllocate,
}: AllocationComposerPanelProps) {
  const [selectedType, setSelectedType] = useState<ActivityType>('work');
  const [allocateHours, setAllocateHours] = useState(0.5);
  const pendingHoursRef = useRef(0.5);
  const frameRef = useRef<number | null>(null);

  const sliderMax = remaining > 0 ? remaining : 0;
  const selectedActivity = getActivityConfig(selectedType);
  const sliderPercent =
    sliderMax === 0 ? 0 : Math.min(100, Math.max(0, (allocateHours / sliderMax) * 100));

  const scheduleHours = useCallback(
    (hours: number) => {
      const nextHours =
        sliderMax <= 0 ? 0 : Math.max(0, Math.min(sliderMax, Math.round(hours * 10) / 10));
      pendingHoursRef.current = nextHours;

      if (frameRef.current !== null) return;

      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        setAllocateHours(pendingHoursRef.current);
      });
    },
    [sliderMax],
  );

  useEffect(() => {
    const nextHours = sliderMax <= 0 ? 0 : Math.min(pendingHoursRef.current, sliderMax);
    pendingHoursRef.current = nextHours;
    setAllocateHours(nextHours);
  }, [sliderMax]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const handleAllocateClick = () => {
    const nextHours = Math.round(pendingHoursRef.current * 10) / 10;
    if (nextHours <= 0 || nextHours > remaining) return;

    const success = onAllocate(selectedType, nextHours);
    if (!success) return;

    pendingHoursRef.current = 0;
    setAllocateHours(0);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-1.5">
        {ACTIVITY_CONFIG.map((activity) => (
          <button
            key={activity.type}
            onClick={() => setSelectedType(activity.type)}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-2xl border px-1.5 py-2.5 transition-all',
              selectedType === activity.type
                ? cn(activity.color, 'shadow-sm')
                : 'border-transparent bg-white/80 text-slate-400 shadow-sm',
            )}>
            {activity.icon}
            <span className="text-[9px] font-black">{activity.label}</span>
          </button>
        ))}
      </div>

      <div className="rounded-[28px] border border-indigo-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(243,244,255,0.92)_100%)] p-3.5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-lg',
                selectedActivity?.baseColor,
              )}>
              {selectedActivity?.icon}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                当前分配
              </p>
              <p className="mt-1 text-sm font-black text-slate-800">{selectedActivity?.label}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
              本次时长
            </p>
            <div className="mt-1 text-[28px] font-mono font-black tracking-tight text-slate-900">
              <AnimatedHoursValue
                value={allocateHours}
                valueClassName=""
                unitClassName="ml-1 text-sm font-bold text-slate-400"
              />
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {TIME_PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => scheduleHours(Math.min(preset, sliderMax))}
              disabled={sliderMax === 0}
              className={cn(
                'rounded-full border px-2.5 py-1.5 text-[11px] font-black transition-all whitespace-nowrap',
                sliderMax > 0
                  ? 'border-slate-200 bg-white text-slate-600 active:scale-[0.96]'
                  : 'border-slate-100 bg-slate-50 text-slate-300',
              )}>
              {formatHours(preset)}h
            </button>
          ))}
        </div>

        <div className="mt-3 rounded-[18px] border border-indigo-50 bg-white px-2.5 py-2.5 shadow-[inset_0_1px_3px_rgba(15,23,42,0.03)]">
          <input
            type="range"
            min="0"
            max={sliderMax}
            step="0.5"
            value={Math.min(allocateHours, sliderMax)}
            onInput={(event) =>
              scheduleHours(parseFloat((event.target as HTMLInputElement).value))
            }
            className="time-slider w-full appearance-none"
            style={{
              '--slider-color': selectedActivity?.hexColor ?? '#6366f1',
              '--slider-shadow': `${selectedActivity?.hexColor ?? '#6366f1'}30`,
              '--slider-soft': `${selectedActivity?.hexColor ?? '#6366f1'}16`,
              background: `linear-gradient(90deg, ${selectedActivity?.hexColor ?? '#6366f1'} 0%, ${selectedActivity?.hexColor ?? '#6366f1'} ${sliderPercent}%, rgba(226,232,240,0.92) ${sliderPercent}%, rgba(226,232,240,0.92) 100%)`,
            } as React.CSSProperties}
            disabled={remaining === 0}
          />
        </div>

        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-[11px] font-medium text-slate-400">左右拖动调节，支持 0.5h 步进</span>
          <span className="rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-black text-slate-500 shadow-sm whitespace-nowrap">
            {remaining === 0 ? '今日已满' : `本次最多 ${formatHours(sliderMax)}h`}
          </span>
        </div>

        <button
          onClick={handleAllocateClick}
          disabled={remaining === 0 || allocateHours <= 0 || allocateHours > remaining}
          className={cn(
            'mt-3 w-full rounded-2xl py-3.5 text-sm font-black uppercase tracking-[0.24em] transition-all active:scale-95',
            remaining === 0 || allocateHours <= 0 || allocateHours > remaining
              ? 'bg-slate-100 text-slate-300'
              : 'bg-slate-900 text-white shadow-lg shadow-slate-200',
          )}>
          加入今日分配
        </button>
      </div>
    </div>
  );
});

interface DraftComposerRowProps {
  draft: AllocationDraft;
  drafts: AllocationDraft[];
  onChange: (drafts: AllocationDraft[]) => void;
}

const DraftComposerRow = React.memo(function DraftComposerRow({
  draft,
  drafts,
  onChange,
}: DraftComposerRowProps) {
  const activity = getActivityConfig(draft.type);
  const maxHours = useMemo(() => getMaxDraftHours(drafts, draft.type), [drafts, draft.type]);
  const [localHours, setLocalHours] = useState(draft.hours);
  const pendingHoursRef = useRef(draft.hours);
  const frameRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (isDraggingRef.current) return;
    pendingHoursRef.current = draft.hours;
    setLocalHours(draft.hours);
  }, [draft.hours]);

  useEffect(() => {
    const nextHours = Math.min(pendingHoursRef.current, maxHours);
    pendingHoursRef.current = nextHours;
    setLocalHours(nextHours);
  }, [maxHours]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const commitHours = useCallback(
    (hours: number) => {
      const nextHours = Math.max(0, Math.min(maxHours, Math.round(hours * 10) / 10));
      onChange(setDraftHours(drafts, draft.type, nextHours));
    },
    [draft.type, drafts, maxHours, onChange],
  );

  const scheduleHours = useCallback(
    (hours: number) => {
      const nextHours = Math.max(0, Math.min(maxHours, Math.round(hours * 10) / 10));
      pendingHoursRef.current = nextHours;

      if (frameRef.current !== null) return;

      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        setLocalHours(pendingHoursRef.current);
      });
    },
    [maxHours],
  );

  const finishDragging = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    commitHours(pendingHoursRef.current);
  }, [commitHours]);

  const sliderPercent =
    maxHours <= 0 ? 0 : Math.min(100, Math.max(0, (localHours / maxHours) * 100));

  return (
    <div className="rounded-[26px] border border-white/70 bg-white/92 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm',
              activity?.baseColor,
            )}>
            {activity?.icon}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-800">{activity?.label}</p>
            <p className="mt-1 text-[11px] font-medium text-slate-400">
              本项最高可设 {formatHours(maxHours)}h
            </p>
          </div>
        </div>
        <button
          onClick={() => onChange(removeDraftType(drafts, draft.type))}
          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-black text-slate-500 transition-all active:scale-[0.96]">
          移除
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="rounded-2xl bg-slate-50 px-3 py-2">
          <AnimatedHoursValue
            value={localHours}
            valueClassName="text-[22px] font-mono font-black tracking-tight text-slate-900"
            unitClassName="ml-1 text-sm font-bold text-slate-400"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const nextHours = localHours - 0.5;
              scheduleHours(nextHours);
              commitHours(nextHours);
            }}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-600 shadow-sm transition-all active:scale-[0.96]">
            -0.5h
          </button>
          <button
            onClick={() => {
              const nextHours = Math.min(maxHours, localHours + 0.5);
              scheduleHours(nextHours);
              commitHours(nextHours);
            }}
            disabled={localHours >= maxHours}
            className={cn(
              'rounded-2xl px-3 py-2 text-[11px] font-black transition-all',
              localHours >= maxHours
                ? 'bg-slate-100 text-slate-300'
                : 'bg-slate-900 text-white shadow-sm active:scale-[0.96]',
            )}>
            +0.5h
          </button>
        </div>
      </div>

      <div className="mt-3 rounded-[18px] border border-indigo-50 bg-white px-2.5 py-2.5 shadow-[inset_0_1px_3px_rgba(15,23,42,0.03)]">
        <input
          type="range"
          min="0"
          max={maxHours}
          step="0.5"
          value={Math.min(localHours, maxHours)}
          onInput={(event) => {
            isDraggingRef.current = true;
            scheduleHours(parseFloat((event.target as HTMLInputElement).value));
          }}
          onPointerUp={finishDragging}
          onPointerCancel={finishDragging}
          onTouchEnd={finishDragging}
          onMouseUp={finishDragging}
          onBlur={finishDragging}
          className="time-slider w-full appearance-none"
          style={{
            '--slider-color': activity?.hexColor ?? '#6366f1',
            '--slider-shadow': `${activity?.hexColor ?? '#6366f1'}30`,
            '--slider-soft': `${activity?.hexColor ?? '#6366f1'}16`,
            background: `linear-gradient(90deg, ${activity?.hexColor ?? '#6366f1'} 0%, ${activity?.hexColor ?? '#6366f1'} ${sliderPercent}%, rgba(226,232,240,0.92) ${sliderPercent}%, rgba(226,232,240,0.92) 100%)`,
          } as React.CSSProperties}
          disabled={maxHours <= 0}
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium text-slate-400">左右拖动调节，支持 0.5h 步进</span>
        <span className="rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-black text-slate-500 shadow-sm whitespace-nowrap">
          本项最多 {formatHours(maxHours)}h
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {Array.from(new Set(TIME_PRESETS.map((preset) => Math.min(preset, maxHours))))
          .filter((preset) => preset > 0)
          .map((preset) => {
            const isActive = Math.abs(localHours - preset) < 0.05;
            return (
              <button
                key={`${draft.type}-${preset}`}
                onClick={() => {
                  scheduleHours(preset);
                  commitHours(preset);
                }}
                className={cn(
                  'rounded-full border px-2.5 py-1.5 text-[10px] font-black transition-all whitespace-nowrap',
                  isActive
                    ? cn(activity?.color ?? 'text-indigo-600 border-indigo-100 bg-indigo-50')
                    : 'border-slate-200 bg-white text-slate-500 active:scale-[0.96]',
                )}>
                {formatHours(preset)}h
              </button>
            );
          })}
      </div>
    </div>
  );
});

interface TodayDistributionSectionProps {
  distribution: Record<ActivityType, number>;
  recordProgress: number;
  summaryInsight: SummaryInsightConfig;
  dayKey: string;
}

const TodayDistributionSection = React.memo(function TodayDistributionSection({
  distribution,
  recordProgress,
  summaryInsight,
  dayKey,
}: TodayDistributionSectionProps) {
  const [highlightDistribution, setHighlightDistribution] = useState(false);
  const [animatedDistribution, setAnimatedDistribution] =
    useState<Record<ActivityType, number>>(() => distribution);
  const animatedDistributionRef = useRef(animatedDistribution);
  const [ringClearState, setRingClearState] = useState<{
    active: boolean;
    source: Record<ActivityType, number>;
  }>({
    active: false,
    source: createEmptyActivityTotals(),
  });

  const distributionSignature = useMemo(
    () => ACTIVITY_CONFIG.map((activity) => distribution[activity.type].toFixed(2)).join('|'),
    [distribution],
  );
  const previousDistributionSignatureRef = useRef(distributionSignature);

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
    const isClearing =
      (Object.values(distribution) as number[]).every((hours) => hours <= 0.001) &&
      (Object.values(startDistribution) as number[]).some((hours) => hours > 0.001);
    const duration = isClearing ? 1180 : 560;
    let frameId = 0;
    const startTime = performance.now();

    const tick = (currentTime: number) => {
      const progress = Math.min(1, (currentTime - startTime) / duration);
      const eased = Math.min(1, Math.max(0, (() => {
        if (!isClearing) return 1 - (1 - progress) ** 2.6;
        const slowDownStart = 0.46;
        if (progress <= slowDownStart) return progress;
        const tailProgress = (progress - slowDownStart) / (1 - slowDownStart);
        const tailEased =
          (-1.55 * (tailProgress ** 3)) + (2 * (tailProgress ** 2)) + (0.55 * tailProgress);
        return slowDownStart + (1 - slowDownStart) * tailEased;
      })()));
      const nextDistribution = createEmptyActivityTotals();

      (Object.keys(distribution) as ActivityType[]).forEach((type) => {
        const nextValue =
          startDistribution[type] + (distribution[type] - startDistribution[type]) * eased;
        nextDistribution[type] = Math.abs(nextValue) < 0.001 ? 0 : Math.max(0, nextValue);
      });

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
  }, [distribution, dayKey]);

  useEffect(() => {
    const nextTotal = getDistributionTotal(distribution);
    const startDistribution = {...animatedDistributionRef.current};
    const startTotal = getDistributionTotal(startDistribution);

    if (nextTotal > 0.001 || startTotal <= 0.001) {
      setRingClearState((previous) =>
        previous.active
          ? {
              active: false,
              source: createEmptyActivityTotals(),
            }
          : previous,
      );
      return;
    }

    setRingClearState({
      active: true,
      source: startDistribution,
    });
  }, [distribution, dayKey]);

  const animatedTotalAllocated = useMemo(
    () => (Object.values(animatedDistribution) as number[]).reduce((sum, hours) => sum + hours, 0),
    [animatedDistribution],
  );

  useEffect(() => {
    if (!ringClearState.active || animatedTotalAllocated > 0.01) return;

    setRingClearState({
      active: false,
      source: createEmptyActivityTotals(),
    });
  }, [animatedTotalAllocated, ringClearState.active]);

  useEffect(() => {
    const previousSignature = previousDistributionSignatureRef.current;
    previousDistributionSignatureRef.current = distributionSignature;

    if (previousSignature === distributionSignature) return;

    setHighlightDistribution(true);
    const timer = window.setTimeout(() => setHighlightDistribution(false), 720);
    return () => window.clearTimeout(timer);
  }, [distributionSignature, dayKey]);

  const ringDisplayDistribution = ringClearState.active ? ringClearState.source : animatedDistribution;
  const ringVisibleHours = ringClearState.active
    ? animatedTotalAllocated
    : getDistributionTotal(ringDisplayDistribution);
  const ringSegments = useMemo(
    () => buildRingSegments(ringDisplayDistribution, RING_ACTIVITY_ORDER, ringVisibleHours),
    [ringDisplayDistribution, ringVisibleHours],
  );
  const maxDistributionHours = useMemo(
    () => Math.max(...(Object.values(animatedDistribution) as number[]), 0),
    [animatedDistribution],
  );

  return (
    <section
      className={cn(
        'glass-card rounded-[32px] p-5 shadow-xl border-white/40 transition-all duration-500',
        highlightDistribution && 'ring-2 ring-indigo-100 shadow-[0_18px_42px_rgba(99,102,241,0.14)]',
      )}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold flex items-center gap-2 text-slate-800">
          <TrendingUp size={18} className="text-indigo-500" />
          今日时间分布
        </h2>
        <span className="text-xs text-slate-400">记录进度 {recordProgress}%</span>
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
            {ringSegments.map((segment) => (
              <circle
                key={segment.key}
                cx="64"
                cy="64"
                r="56"
                fill="none"
                stroke="currentColor"
                strokeWidth="12"
                strokeDasharray={segment.dashArray}
                strokeDashoffset={segment.dashOffset}
                className={segment.colorClassName}
                strokeLinecap="butt"
              />
            ))}
          </svg>
          <div className="text-center">
            <div className="text-2xl font-black tracking-tighter">{animatedTotalAllocated.toFixed(1)}</div>
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

      <div className={cn('mt-5 rounded-[24px] px-4 py-3', summaryInsight.background)}>
        <div className={cn('text-sm font-black', summaryInsight.accent)}>{summaryInsight.title}</div>
        <p className="mt-1 text-xs font-medium leading-5 text-slate-500">{summaryInsight.description}</p>
      </div>
    </section>
  );
});

export function HomeView() {
  const {
    allocations,
    completedPets,
    customPets,
    planTemplates,
    allocateTime,
    applyAllocationDrafts,
    clearUnusedAllocations,
    createPlanTemplate,
    copyAllocationsFromDate,
    deletePlanTemplate,
    duplicatePlanTemplate,
    deleteUnusedAllocation,
    markPlanTemplateUsed,
    removeLastUnusedAllocation,
    simulatedDateOffset,
    advanceDay,
    currentEgg,
    togglePlanTemplatePinned,
    updatePlanTemplate,
    updateUnusedAllocation,
    homeTabEnterSignal,
  } = useStore();
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [selectedDetailDateKey, setSelectedDetailDateKey] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [templateSheetMode, setTemplateSheetMode] = useState<TemplateSheetMode>(null);
  const [templateEditorId, setTemplateEditorId] = useState<string | null>(null);
  const [templateEditorLabel, setTemplateEditorLabel] = useState('');
  const [templateEditorDrafts, setTemplateEditorDrafts] = useState<AllocationDraft[]>([]);
  const [templateSortMode, setTemplateSortMode] = useState<TemplateSortMode>('recent');
  const [showSecondaryActions, setShowSecondaryActions] = useState(false);
  const [editingAllocationId, setEditingAllocationId] = useState<string | null>(null);
  const [editType, setEditType] = useState<ActivityType>('work');
  const [editHours, setEditHours] = useState(0.5);
  const [showAvatarInsight, setShowAvatarInsight] = useState(false);
  const [homePassers, setHomePassers] = useState<HomePasser[]>([]);
  const avatarInsightRef = useRef<HTMLDivElement | null>(null);
  const homeSignalRef = useRef<number>(-1);
  const homePasserTimerRef = useRef<number | null>(null);

  const todayDate = useMemo(() => getSimulatedDate(simulatedDateOffset), [simulatedDateOffset]);
  const today = useMemo(() => formatZhDate(todayDate), [todayDate]);

  const todayStr = getDateKey(todayDate);
  const todayAllocations = useMemo(
    () => allocations[todayStr] ?? EMPTY_ALLOCATIONS,
    [allocations, todayStr],
  );
  const todayUsedAllocations = todayAllocations.filter((allocation) => allocation.used);
  const todayUnusedAllocations = todayAllocations.filter((allocation) => !allocation.used);
  const totalAllocated = todayAllocations.reduce((sum, a) => sum + a.hours, 0);
  const remaining = 24 - totalAllocated;
  const editingAllocation = useMemo(
    () => todayAllocations.find((allocation) => allocation.id === editingAllocationId && !allocation.used) ?? null,
    [todayAllocations, editingAllocationId],
  );

  const handleAllocate = (type: ActivityType, hours: number) => {
    if (hours <= 0 || hours > remaining) return false;
    const success = allocateTime(todayStr, type, hours);
    if (!success) return false;
    setActionFeedback('已新增分配');
    return true;
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

  const triggerHomePassers = useCallback(() => {
    if (homePasserTimerRef.current !== null) {
      window.clearTimeout(homePasserTimerRef.current);
      homePasserTimerRef.current = null;
    }

    const farmPets = completedPets.filter((pet) => pet.theme === 'A');

    if (farmPets.length === 0) {
      setHomePassers([]);
      return;
    }

    const sampleCount = Math.min(farmPets.length, 1 + Math.floor(Math.random() * 3));
    const pickedPets = [...farmPets]
      .sort(() => Math.random() - 0.5)
      .slice(0, sampleCount);
    const moveLeftToRight = Math.random() > 0.3;
    const startX = moveLeftToRight ? -22 : 106;
    const endX = moveLeftToRight ? 106 : -22;

    const nextPassers: HomePasser[] = pickedPets.map((pet, index) => {
      const customImage = pet.theme === 'custom'
        ? customPets.find((item) => item.id === pet.petId)?.image
        : undefined;
      const spriteOption = isPetSpriteKey(pet.petId)
        ? getPetSpriteOptionByKey(pet.petId)
        : null;
      const baseFlip = Boolean(spriteOption?.flipX);
      return {
        id: `${pet.instanceId}-${Date.now()}-${index}`,
        pet,
        customImage,
        startX,
        endX,
        topOffset: 9,
        duration: 4,
        delay: index * 0.42,
        action: resolveHomePasserAction(pet.petId),
        flipX: moveLeftToRight ? baseFlip : !baseFlip,
      };
    });

    setHomePassers(nextPassers);

    const maxDurationMs =
      Math.max(...nextPassers.map((passer) => (passer.duration + passer.delay) * 1000), 0) + 260;
    homePasserTimerRef.current = window.setTimeout(() => {
      setHomePassers([]);
      homePasserTimerRef.current = null;
    }, maxDurationMs);
  }, [completedPets, customPets]);

  useEffect(() => {
    if (!editingAllocationId) return;

    if (!editingAllocation) {
      setEditingAllocationId(null);
      return;
    }

    setEditType(editingAllocation.type);
    setEditHours(editingAllocation.hours);
  }, [editingAllocation, editingAllocationId]);

  useEffect(() => {
    if (!actionFeedback) return;
    const timer = window.setTimeout(() => setActionFeedback(null), 1800);
    return () => window.clearTimeout(timer);
  }, [actionFeedback]);

  useEffect(() => {
    if (homeSignalRef.current === homeTabEnterSignal) return;
    const shouldTrigger = homeTabEnterSignal > 0;
    homeSignalRef.current = homeTabEnterSignal;
    if (!shouldTrigger) return;
    triggerHomePassers();
  }, [homeTabEnterSignal, triggerHomePassers]);

  useEffect(
    () => () => {
      if (homePasserTimerRef.current !== null) {
        window.clearTimeout(homePasserTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    setShowSecondaryActions(false);
  }, [todayStr]);

  useEffect(() => {
    if (!showAvatarInsight) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!avatarInsightRef.current?.contains(event.target as Node)) {
        setShowAvatarInsight(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [showAvatarInsight]);

  const yesterdayDateKey = useMemo(() => {
    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    return getDateKey(yesterdayDate);
  }, [todayDate]);
  const yesterdayAllocations = useMemo(
    () => allocations[yesterdayDateKey] ?? EMPTY_ALLOCATIONS,
    [allocations, yesterdayDateKey],
  );
  const yesterdayFocusHours = useMemo(
    () =>
      yesterdayAllocations.reduce((sum, allocation) => {
        if (allocation.type === 'work' || allocation.type === 'study') {
          return sum + allocation.hours;
        }
        return sum;
      }, 0),
    [yesterdayAllocations],
  );
  const yesterdayTotal = yesterdayAllocations.reduce((sum, allocation) => sum + allocation.hours, 0);

  const focusHours = distribution.work + distribution.study;
  const recordProgress = Math.min(100, Math.round((totalAllocated / 24) * 100));
  const focusRatio = totalAllocated === 0 ? 0 : Math.round((focusHours / totalAllocated) * 100);
  const focusDelta = focusHours - yesterdayFocusHours;

  const efficiencyLabel = (() => {
    if (focusRatio >= 80) return 'A+';
    if (focusRatio >= 65) return 'A';
    if (focusRatio >= 50) return 'B';
    if (focusRatio >= 35) return 'C';
    return 'D';
  })();
  const dominantActivity = useMemo(
    () =>
      ACTIVITY_CONFIG.reduce(
        (currentBest, activity) =>
          distribution[activity.type] > currentBest.hours
            ? {type: activity.type, hours: distribution[activity.type]}
            : currentBest,
        {type: 'work' as ActivityType, hours: 0},
      ),
    [distribution],
  );
  const activeActivityCount = useMemo(
    () => ACTIVITY_CONFIG.filter((activity) => distribution[activity.type] > 0.4).length,
    [distribution],
  );
  const dominantShare = totalAllocated <= 0.001 ? 0 : dominantActivity.hours / totalAllocated;
  const avatarState = useMemo<AvatarStateConfig>(() => {
    const dominantConfig = getActivityConfig(dominantActivity.type) ?? ACTIVITY_CONFIG[0];
    const workHours = distribution.work;
    const studyHours = distribution.study;
    const exerciseHours = distribution.exercise;
    const entertainmentHours = distribution.entertainment;
    const restHours = distribution.rest;
    const isComplete = remaining <= 0.001;
    const workShare = totalAllocated <= 0.001 ? 0 : workHours / totalAllocated;
    const studyShare = totalAllocated <= 0.001 ? 0 : studyHours / totalAllocated;
    const entertainmentShare = totalAllocated <= 0.001 ? 0 : entertainmentHours / totalAllocated;
    const restShare = totalAllocated <= 0.001 ? 0 : restHours / totalAllocated;

    if (totalAllocated <= 0.5) {
      return {
        label: '待记录',
        description: `今天只记录了 ${formatHours(totalAllocated)}h，还不足以形成稳定画像。`,
        ringGradient: 'from-slate-200 via-slate-100 to-slate-300',
        chipClass: 'bg-white text-slate-500',
        badgeClass: 'bg-white text-slate-500',
        overlayClass: 'from-slate-200/10 to-transparent',
        imageStyle: {filter: 'saturate(0.92) brightness(1.02)'},
        badgeIcon: <CalendarIcon size={11} />,
      };
    }

    if (totalAllocated < 3) {
      return {
        label: '起步中',
        description: `目前只记录了 ${formatHours(totalAllocated)}h，先把关键时段补进来，状态会更清晰。`,
        ringGradient: 'from-indigo-200 via-sky-200 to-violet-300',
        chipClass: 'bg-white text-indigo-600',
        badgeClass: 'bg-white text-indigo-600',
        overlayClass: 'from-indigo-200/15 to-transparent',
        imageStyle: {filter: 'saturate(1.02) brightness(1.03)'},
        badgeIcon: <Plus size={11} />,
      };
    }

    if (totalAllocated < 8) {
      return {
        label: '渐入状态',
        description: `今天已记录 ${formatHours(totalAllocated)}h，主要节奏开始出现，再补几段会更稳定。`,
        ringGradient: 'from-sky-300 via-indigo-300 to-violet-400',
        chipClass: 'bg-white text-sky-600',
        badgeClass: 'bg-white text-sky-600',
        overlayClass: 'from-sky-200/15 to-transparent',
        imageStyle: {filter: 'saturate(1.04) brightness(1.04)'},
        badgeIcon: <Sparkles size={11} />,
      };
    }

    if (
      isComplete &&
      workHours >= 8 &&
      restHours >= 8 &&
      focusHours >= 8 &&
      activeActivityCount <= 3 &&
      entertainmentHours <= 3.5
    ) {
      return {
        label: '劳逸平衡',
        description: `今天专注 ${formatHours(focusHours)}h、休息 ${formatHours(restHours)}h，投入和恢复都比较充分。`,
        ringGradient: 'from-rose-400 via-fuchsia-300 to-indigo-500',
        chipClass: 'bg-white text-fuchsia-600',
        badgeClass: 'bg-white text-fuchsia-600',
        overlayClass: 'from-fuchsia-200/20 to-transparent',
        imageStyle: {filter: 'saturate(1.12) contrast(1.04) brightness(1.02)'},
        badgeIcon: <BadgeCheck size={11} />,
      };
    }

    if (workHours >= 7 && workShare >= 0.34 && focusHours >= workHours && totalAllocated >= 10) {
      return {
        label: '工作主场',
        description: `工作 ${formatHours(workHours)}h，占今天 ${Math.round(workShare * 100)}%，整体节奏明显偏向推进任务。`,
        ringGradient: 'from-rose-400 via-orange-300 to-amber-300',
        chipClass: 'bg-white text-rose-500',
        badgeClass: 'bg-white text-rose-500',
        overlayClass: 'from-rose-200/20 to-transparent',
        imageStyle: {filter: 'saturate(1.14) contrast(1.03)'},
        badgeIcon: dominantConfig.type === 'work' ? dominantConfig.icon : <TrendingUp size={11} />,
      };
    }

    if (focusRatio >= 76 && focusHours >= 6.5) {
      return {
        label: '高专注',
        description: `工作和学习合计 ${formatHours(focusHours)}h，占今天 ${focusRatio}%，专注是今天的核心节奏。`,
        ringGradient: 'from-rose-400 via-amber-300 to-indigo-500',
        chipClass: 'bg-white text-rose-500',
        badgeClass: 'bg-white text-rose-500',
        overlayClass: 'from-rose-200/20 to-transparent',
        imageStyle: {filter: 'saturate(1.15) contrast(1.03)'},
        badgeIcon: <TrendingUp size={11} />,
      };
    }

    if (studyHours >= 4.5 && studyHours >= workHours && studyShare >= 0.28) {
      return {
        label: '学习沉浸',
        description: `学习 ${formatHours(studyHours)}h，占今天 ${Math.round(studyShare * 100)}%，今天更像是在集中吸收和输入。`,
        ringGradient: 'from-amber-300 via-orange-300 to-indigo-400',
        chipClass: 'bg-white text-amber-600',
        badgeClass: 'bg-white text-amber-600',
        overlayClass: 'from-amber-200/20 to-transparent',
        imageStyle: {filter: 'saturate(1.12) brightness(1.04)'},
        badgeIcon: <FileText size={11} />,
      };
    }

    if (focusHours >= 6 && exerciseHours >= 1.5 && restHours >= 7 && activeActivityCount >= 3) {
      return {
        label: '节奏在线',
        description: `专注 ${formatHours(focusHours)}h、运动 ${formatHours(exerciseHours)}h、休息 ${formatHours(restHours)}h，今天的结构比较完整。`,
        ringGradient: 'from-emerald-400 via-sky-300 to-indigo-400',
        chipClass: 'bg-white text-emerald-600',
        badgeClass: 'bg-white text-emerald-600',
        overlayClass: 'from-emerald-200/20 to-transparent',
        imageStyle: {filter: 'saturate(1.1) brightness(1.04)'},
        badgeIcon: <BadgeCheck size={11} />,
      };
    }

    if (exerciseHours >= 2.5 && exerciseHours / totalAllocated >= 0.18) {
      return {
        label: '活力充电',
        description: `运动 ${formatHours(exerciseHours)}h，占今天 ${Math.round((exerciseHours / totalAllocated) * 100)}%，今天整体更偏活跃。`,
        ringGradient: 'from-emerald-400 via-lime-300 to-cyan-400',
        chipClass: 'bg-white text-emerald-600',
        badgeClass: 'bg-white text-emerald-600',
        overlayClass: 'from-emerald-200/20 to-transparent',
        imageStyle: {filter: 'saturate(1.12) brightness(1.03)'},
        badgeIcon: dominantConfig.type === 'exercise' ? dominantConfig.icon : <Sparkles size={11} />,
      };
    }

    if (entertainmentHours >= 4 && entertainmentShare >= 0.26) {
      return {
        label: '放松一下',
        description: `娱乐 ${formatHours(entertainmentHours)}h，占今天 ${Math.round(entertainmentShare * 100)}%，今天更偏轻松和放松。`,
        ringGradient: 'from-sky-400 via-fuchsia-300 to-indigo-400',
        chipClass: 'bg-white text-sky-600',
        badgeClass: 'bg-white text-sky-600',
        overlayClass: 'from-sky-200/20 to-transparent',
        imageStyle: {filter: 'saturate(1.12) brightness(1.03)'},
        badgeIcon: dominantConfig.type === 'entertainment' ? dominantConfig.icon : <Sparkles size={11} />,
      };
    }

    if (restHours >= 9 && entertainmentHours >= 3 && restShare >= 0.42) {
      return {
        label: '松弛日',
        description: `休息 ${formatHours(restHours)}h、娱乐 ${formatHours(entertainmentHours)}h，今天整体节奏更松一点。`,
        ringGradient: 'from-indigo-300 via-sky-300 to-violet-400',
        chipClass: 'bg-white text-indigo-600',
        badgeClass: 'bg-white text-indigo-600',
        overlayClass: 'from-indigo-200/20 to-transparent',
        imageStyle: {filter: 'saturate(1.04) brightness(1.06)'},
        badgeIcon: <Sparkles size={11} />,
      };
    }

    if (restHours >= 10 && activeActivityCount <= 2) {
      return {
        label: '休整蓄能',
        description: `休息 ${formatHours(restHours)}h 是今天的主线，像是在专门给自己补能量。`,
        ringGradient: 'from-indigo-300 via-violet-400 to-slate-400',
        chipClass: 'bg-white text-indigo-600',
        badgeClass: 'bg-white text-indigo-600',
        overlayClass: 'from-indigo-200/20 to-transparent',
        imageStyle: {filter: 'saturate(1.02) brightness(1.05)'},
        badgeIcon: dominantConfig.type === 'rest' ? dominantConfig.icon : <Check size={11} />,
      };
    }

    if (isComplete && activeActivityCount >= 3 && dominantShare < 0.46) {
      return {
        label: '均衡日',
        description: '今天已经记满 24 小时，而且几类时间没有明显失衡，整体比较平均。',
        ringGradient: 'from-amber-300 via-indigo-400 to-emerald-400',
        chipClass: 'bg-white text-indigo-600',
        badgeClass: 'bg-white text-indigo-600',
        overlayClass: 'from-indigo-200/20 to-transparent',
        imageStyle: {filter: 'saturate(1.08) brightness(1.04)'},
        badgeIcon: <Sparkles size={11} />,
      };
    }

    if (activeActivityCount >= 4 && dominantShare < 0.34 && totalAllocated >= 10) {
      return {
        label: '多线切换',
        description: `今天切换了 ${activeActivityCount} 类活动，没有单一类型特别压过其他。`,
        ringGradient: 'from-slate-300 via-sky-300 to-violet-400',
        chipClass: 'bg-white text-slate-600',
        badgeClass: 'bg-white text-slate-600',
        overlayClass: 'from-sky-100/20 to-transparent',
        imageStyle: {filter: 'saturate(0.98) brightness(1.04)'},
        badgeIcon: <LayoutGrid size={11} />,
      };
    }

    if (dominantActivity.type === 'work' && dominantActivity.hours >= 6) {
      return {
        label: '工作推进',
        description: `工作 ${formatHours(dominantActivity.hours)}h，是今天占比最高的一条主线。`,
        ringGradient: 'from-rose-300 via-orange-300 to-amber-300',
        chipClass: 'bg-white text-rose-500',
        badgeClass: 'bg-white text-rose-500',
        overlayClass: 'from-rose-200/15 to-transparent',
        imageStyle: {filter: 'saturate(1.08) brightness(1.03)'},
        badgeIcon: dominantConfig.icon,
      };
    }

    if (dominantActivity.type === 'study' && dominantActivity.hours >= 4) {
      return {
        label: '学习日',
        description: `学习 ${formatHours(dominantActivity.hours)}h，是今天最主要的投入方向。`,
        ringGradient: 'from-amber-300 via-orange-200 to-yellow-300',
        chipClass: 'bg-white text-amber-600',
        badgeClass: 'bg-white text-amber-600',
        overlayClass: 'from-amber-200/15 to-transparent',
        imageStyle: {filter: 'saturate(1.08) brightness(1.03)'},
        badgeIcon: dominantConfig.icon,
      };
    }

    if (dominantActivity.type === 'rest' && dominantActivity.hours >= 6) {
      return {
        label: '休整中',
        description: `休息 ${formatHours(restHours)}h，是今天最主要的一部分，节奏更偏恢复。`,
        ringGradient: 'from-indigo-300 via-violet-400 to-slate-400',
        chipClass: 'bg-white text-indigo-600',
        badgeClass: 'bg-white text-indigo-600',
        overlayClass: 'from-indigo-200/20 to-transparent',
        imageStyle: {filter: 'saturate(1.02) brightness(1.05)'},
        badgeIcon: dominantConfig.icon,
      };
    }

    if (dominantActivity.type === 'exercise' && dominantActivity.hours >= 1.5) {
      return {
        label: '活力态',
        description: `运动 ${formatHours(exerciseHours)}h，让今天整体更偏行动和激活。`,
        ringGradient: 'from-emerald-400 via-lime-300 to-cyan-400',
        chipClass: 'bg-white text-emerald-600',
        badgeClass: 'bg-white text-emerald-600',
        overlayClass: 'from-emerald-200/20 to-transparent',
        imageStyle: {filter: 'saturate(1.12) brightness(1.03)'},
        badgeIcon: dominantConfig.icon,
      };
    }

    if (dominantActivity.type === 'entertainment' && dominantActivity.hours >= 3) {
      return {
        label: '放松中',
        description: `娱乐 ${formatHours(entertainmentHours)}h，是今天的主要部分，状态更偏轻松。`,
        ringGradient: 'from-sky-400 via-fuchsia-300 to-indigo-400',
        chipClass: 'bg-white text-sky-600',
        badgeClass: 'bg-white text-sky-600',
        overlayClass: 'from-sky-200/20 to-transparent',
        imageStyle: {filter: 'saturate(1.12) brightness(1.03)'},
        badgeIcon: dominantConfig.icon,
      };
    }

    return {
      label: `${dominantConfig.label}态`,
      description: `${dominantConfig.label} ${formatHours(dominantActivity.hours)}h，是当前占比最高的部分。`,
      ringGradient: 'from-indigo-400 via-violet-400 to-sky-400',
      chipClass: 'bg-white text-slate-700',
      badgeClass: 'bg-white text-slate-700',
      overlayClass: 'from-slate-200/15 to-transparent',
      imageStyle: {filter: 'saturate(1.02) brightness(1.02)'},
      badgeIcon: dominantConfig.icon,
    };
  }, [
    activeActivityCount,
    distribution,
    dominantActivity,
    dominantShare,
    focusHours,
    focusRatio,
    remaining,
      totalAllocated,
  ]);
  useEffect(() => {
    setShowAvatarInsight(false);
  }, [avatarState.label, todayStr]);
  const recordStatus = useMemo(() => {
    if (totalAllocated > 24.001) {
      return {
        tone: 'rose' as const,
        title: '今日记录超出 24h',
        description: '数据看起来有冲突，建议检查当天分配。',
      };
    }

    if (remaining <= 0.001) {
      return {
        tone: 'emerald' as const,
        title: '今日已完整记录',
        description: '24 小时已经归档完成，可以直接去看反馈或投喂。',
      };
    }

    if (totalAllocated <= 0.001) {
      return {
        tone: 'slate' as const,
        title: '今天还没开始记录',
        description: '先分配第一段时间，今天的画像和建议才会出现。',
      };
    }

    return {
      tone: 'amber' as const,
      title: `今日还差 ${formatHours(remaining)}h 未记录`,
      description: '先补齐关键时段，首页的反馈会更准确。',
    };
  }, [remaining, totalAllocated]);
  const summaryInsight = useMemo(() => {
    if (totalAllocated <= 0.001) {
      return {
        title: '今天还没有形成画像',
        description: '先完成几段分配，首页会开始给你节奏反馈。',
        accent: 'text-slate-500',
        background: 'bg-slate-50',
      };
    }

    if (totalAllocated < 3) {
      return {
        title: '今天还在成型中',
        description: `目前只记录了 ${formatHours(totalAllocated)}h，先继续补齐更多时段，再看反馈会更准。`,
        accent: 'text-slate-600',
        background: 'bg-slate-50',
      };
    }

    if (focusRatio >= 72 && distribution.rest < 7 && totalAllocated >= 8) {
      return {
        title: '今天是高专注日',
        description:
          remaining <= 0.001
            ? '专注投入很高，但恢复时段偏少，今天整体节奏会更紧一些。'
            : '专注投入很高，但休息略少，后面可以补一点恢复时段。',
        accent: 'text-rose-500',
        background: 'bg-rose-50',
      };
    }

    if (distribution.rest >= 10 && focusHours < 5 && totalAllocated >= 8) {
      return {
        title: '今天更偏休整',
        description: '恢复和放松占比更高，整体节奏是放松向的。',
        accent: 'text-indigo-600',
        background: 'bg-indigo-50',
      };
    }

    if (distribution.exercise >= 1.5 && focusHours >= 5 && totalAllocated >= 8) {
      return {
        title: '今天结构比较均衡',
        description: '专注、运动和恢复都照顾到了，节奏很完整。',
        accent: 'text-emerald-600',
        background: 'bg-emerald-50',
      };
    }

    if (remaining <= 0.001) {
      return {
        title: '今天已完整记录',
        description: '24 小时已经记录完成，可以去回看流水、统计或继续投喂。',
        accent: 'text-emerald-600',
        background: 'bg-emerald-50',
      };
    }

    if (totalAllocated < 8) {
      return {
        title: '今天还在逐步成型',
        description: `已记录 ${formatHours(totalAllocated)}h，继续补齐后，当天画像会更稳定。`,
        accent: 'text-slate-600',
        background: 'bg-slate-50',
      };
    }

    return {
      title: '今天在稳步推进',
      description: '继续把剩余时间补齐，就能看到更完整的当天反馈。',
      accent: 'text-slate-600',
      background: 'bg-slate-50',
    };
  }, [
    distribution.exercise,
    distribution.rest,
    focusHours,
    focusRatio,
    remaining,
    totalAllocated,
  ]);
  const editHoursMax = useMemo(() => {
    if (!editingAllocation) return 0;
    const totalWithoutCurrent = todayAllocations.reduce((sum, allocation) => {
      if (allocation.id === editingAllocation.id) return sum;
      return sum + allocation.hours;
    }, 0);
    return Math.max(0, 24 - totalWithoutCurrent);
  }, [editingAllocation, todayAllocations]);

  const templateLibrary = useMemo(
    () =>
      [...planTemplates]
        .map((template) => {
          const drafts = normalizeDraftCollection(template.drafts);
          return {
            ...template,
            drafts,
            summary: buildTemplateSummary(drafts),
            totalHours: getDraftTotal(drafts),
          };
        })
        .sort((left, right) => {
          if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;

          if (templateSortMode === 'name') {
            return left.label.localeCompare(right.label, 'zh-Hans-CN');
          }

          if (templateSortMode === 'hours' && right.totalHours !== left.totalHours) {
            return right.totalHours - left.totalHours;
          }

          const leftRecent = left.lastUsedAt ?? left.updatedAt ?? left.createdAt;
          const rightRecent = right.lastUsedAt ?? right.updatedAt ?? right.createdAt;

          if (rightRecent !== leftRecent) return rightRecent - leftRecent;
          if (right.usageCount !== left.usageCount) return right.usageCount - left.usageCount;

          return left.label.localeCompare(right.label, 'zh-Hans-CN');
        }),
    [planTemplates, templateSortMode],
  );
  const recentTemplates = useMemo(
    () =>
      [...planTemplates]
        .map((template) => {
          const drafts = normalizeDraftCollection(template.drafts);
          return {
            ...template,
            drafts,
            totalHours: getDraftTotal(drafts),
          };
        })
        .filter((template) => template.lastUsedAt !== null || template.usageCount > 0)
        .sort((left, right) => {
          const leftRecent = left.lastUsedAt ?? 0;
          const rightRecent = right.lastUsedAt ?? 0;
          if (rightRecent !== leftRecent) return rightRecent - leftRecent;
          if (right.usageCount !== left.usageCount) return right.usageCount - left.usageCount;
          return right.updatedAt - left.updatedAt;
        })
        .slice(0, 2),
    [planTemplates],
  );
  const currentDistributionDrafts = useMemo(
    () => buildDraftsFromTotals(distribution),
    [distribution],
  );
  const canQuickFill = todayUsedAllocations.length === 0;
  const canCopyYesterday = canQuickFill && yesterdayAllocations.length > 0;
  const canUndoLast = todayUnusedAllocations.length > 0;
  const canClearToday = todayUnusedAllocations.length > 0;
  const hasSecondaryActions = canUndoLast || canClearToday;

  useEffect(() => {
    if (hasSecondaryActions) return;
    setShowSecondaryActions(false);
  }, [hasSecondaryActions]);

  const handleCopyYesterday = () => {
    if (!copyAllocationsFromDate(yesterdayDateKey, todayStr)) {
      setActionFeedback(canQuickFill ? '昨天还没有分布可复制' : '已投喂后无法覆盖分布');
      return;
    }

    setActionFeedback('已复制昨天');
  };

  const handleApplyTemplate = (template: Pick<PlanTemplate, 'id' | 'label' | 'drafts'>) => {
    if (!applyAllocationDrafts(todayStr, template.drafts)) {
      setActionFeedback(canQuickFill ? '模板应用失败' : '已投喂后无法应用模板');
      return;
    }

    markPlanTemplateUsed(template.id);
    setTemplateSheetMode(null);
    setActionFeedback(`已套用${template.label}`);
  };

  const handleOpenTemplateSheet = () => {
    setShowSecondaryActions(false);
    setTemplateSheetMode('apply');
  };

  const handleOpenCreateTemplate = ({
    seedDrafts,
    label,
  }: {
    seedDrafts?: AllocationDraft[];
    label?: string;
  } = {}) => {
    const nextSeedDrafts =
      seedDrafts ?? (currentDistributionDrafts.length > 0 ? currentDistributionDrafts : []);
    setTemplateEditorId(null);
    setTemplateEditorLabel(label ?? '');
    setTemplateEditorDrafts(normalizeDraftCollection(nextSeedDrafts));
    setTemplateSheetMode('create-template');
  };

  const handleOpenEditTemplate = (template: PlanTemplate) => {
    setTemplateEditorId(template.id);
    setTemplateEditorLabel(template.label);
    setTemplateEditorDrafts(normalizeDraftCollection(template.drafts));
    setTemplateSheetMode('edit-template');
  };

  const handleCloseTemplateSheet = () => {
    setTemplateSheetMode(null);
    setTemplateEditorId(null);
    setTemplateEditorLabel('');
    setTemplateEditorDrafts([]);
  };

  const handleBackToTemplateList = () => {
    setTemplateSheetMode('apply');
    setTemplateEditorId(null);
    setTemplateEditorLabel('');
    setTemplateEditorDrafts([]);
  };

  const handleSaveTemplateEditor = () => {
    const nextDrafts = normalizeDraftCollection(templateEditorDrafts);
    const nextLabel = templateEditorLabel.trim();

    if (!nextLabel || nextDrafts.length === 0) {
      setActionFeedback('请先填写模板名称并补充分布');
      return;
    }

    const success = templateEditorId
      ? updatePlanTemplate(templateEditorId, {
          label: nextLabel,
          drafts: nextDrafts,
        })
      : createPlanTemplate({
          label: nextLabel,
          drafts: nextDrafts,
        });

    if (!success) {
      setActionFeedback('模板保存失败');
      return;
    }

    setTemplateSheetMode('apply');
    setTemplateEditorId(null);
    setTemplateEditorLabel('');
    setTemplateEditorDrafts([]);
    setActionFeedback(templateEditorId ? '已更新模板' : '已新增模板');
  };

  const handleDeleteTemplate = (templateId: string, label: string) => {
    if (!deletePlanTemplate(templateId)) {
      setActionFeedback('模板删除失败');
      return;
    }

    if (templateEditorId === templateId) {
      setTemplateEditorId(null);
      setTemplateEditorLabel('');
      setTemplateEditorDrafts([]);
    }
    setActionFeedback(`已删除${label}`);
  };

  const handleToggleTemplatePinned = (template: Pick<PlanTemplate, 'id' | 'label' | 'pinned'>) => {
    if (!togglePlanTemplatePinned(template.id)) {
      setActionFeedback('模板置顶失败');
      return;
    }

    setActionFeedback(template.pinned ? `已取消置顶${template.label}` : `已置顶${template.label}`);
  };

  const handleDuplicateTemplate = (template: Pick<PlanTemplate, 'id' | 'label'>) => {
    if (!duplicatePlanTemplate(template.id)) {
      setActionFeedback('模板复制失败');
      return;
    }

    setActionFeedback(`已复制${template.label}`);
  };

  const handleUndoLast = () => {
    if (!removeLastUnusedAllocation(todayStr)) {
      setActionFeedback('没有可撤销的分配');
      return;
    }

    setShowSecondaryActions(false);
    setActionFeedback('已撤销上次分配');
  };

  const handleClearToday = () => {
    if (!clearUnusedAllocations(todayStr)) {
      setActionFeedback('没有可清空的未投喂分配');
      return;
    }

    setShowSecondaryActions(false);
    setActionFeedback('已清空未投喂分配');
  };

  const handleOpenEditor = (allocationId: string) => {
    setEditingAllocationId(allocationId);
  };

  const handleSaveEdit = () => {
    if (!editingAllocationId) return;
    if (!updateUnusedAllocation(todayStr, editingAllocationId, {type: editType, hours: editHours})) {
      setActionFeedback('保存失败，请检查分配时长');
      return;
    }

    setEditingAllocationId(null);
    setActionFeedback('已更新这条分配');
  };

  const handleDeleteAllocation = (allocationId: string) => {
    if (!deleteUnusedAllocation(todayStr, allocationId)) {
      setActionFeedback('已投喂记录不可删除');
      return;
    }

    if (editingAllocationId === allocationId) {
      setEditingAllocationId(null);
    }
    setActionFeedback('已删除这条分配');
  };

  const renderDraftComposer = ({
    drafts,
    onChange,
    labelValue,
    onLabelChange,
  }: {
    drafts: AllocationDraft[];
    onChange: (drafts: AllocationDraft[]) => void;
    labelValue?: string;
    onLabelChange?: (value: string) => void;
  }) => {
    const normalizedDrafts = normalizeDraftCollection(drafts);
    const total = getDraftTotal(normalizedDrafts);
    const remainingHours = Math.max(0, 24 - total);
    const availableActivities = ACTIVITY_CONFIG.filter(
      (activity) => !normalizedDrafts.some((draft) => draft.type === activity.type),
    );

    return (
      <div className="space-y-4">
        {onLabelChange ? (
          <div className="rounded-[26px] border border-white/70 bg-white/90 p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
              模板名称
            </p>
            <input
              value={labelValue ?? ''}
              onChange={(event) => onLabelChange(event.target.value)}
              placeholder="例如：轻工作日 / 外出日"
              className="mt-3 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-800 outline-none transition-colors placeholder:text-slate-300 focus:border-indigo-200 focus:bg-white"
            />
          </div>
        ) : null}

        <div className="rounded-[28px] border border-white/70 bg-white/90 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                当前结构
              </p>
              <div className="mt-2 flex items-end gap-1">
                <span className="text-[28px] font-mono font-black tracking-tight text-slate-900">
                  {formatHours(total)}
                </span>
                <span className="pb-1 text-sm font-bold text-slate-400">h</span>
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-3 py-2 text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                剩余可配
              </p>
              <p className="mt-1 text-sm font-black text-slate-700">{formatHours(remainingHours)}h</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] font-medium leading-5 text-slate-400">
            {total > 0
              ? remainingHours > 0
                ? '可先设核心结构，不必一次写满 24h。'
                : '已经排满 24h，如需调整可直接改单项时长。'
              : '先从下面添加活动，再微调每一项时长。'}
          </p>
        </div>

        {normalizedDrafts.length > 0 ? (
          <div className="space-y-3">
            {normalizedDrafts.map((draft) => (
              <DraftComposerRow
                key={draft.type}
                draft={draft}
                drafts={normalizedDrafts}
                onChange={onChange}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[26px] border border-dashed border-slate-200 bg-white/80 px-4 py-6 text-center">
            <p className="text-sm font-black text-slate-700">还没有添加活动</p>
            <p className="mt-1 text-[11px] font-medium text-slate-400">
              先挑几类今天会出现的活动，再设置对应时长。
            </p>
          </div>
        )}

        <div className="rounded-[26px] border border-white/70 bg-white/88 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-black text-slate-800">添加活动</p>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">
              还可添加 {availableActivities.length} 项
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {availableActivities.length > 0 ? (
              availableActivities.map((activity) => (
                <button
                  key={`add-${activity.type}`}
                  onClick={() => onChange(addDraftType(normalizedDrafts, activity.type))}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-600 shadow-sm transition-all active:scale-[0.96]">
                  <span
                    className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-full text-white',
                      activity.baseColor,
                    )}>
                    {activity.icon}
                  </span>
                  {activity.label}
                </button>
              ))
            ) : (
              <span className="text-[11px] font-medium text-slate-400">
                五类活动都已加入，可以直接微调时长。
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-y-auto scroll-hide pb-24 relative">
      <header className="relative z-40 px-5 pt-4 pb-1">
        <div className="flex justify-between items-center mb-3">
          <div>
            <p className="text-slate-400 text-xs font-medium flex items-center gap-1">
              <CalendarIcon size={12} /> {today}
            </p>
            <h1 className="text-2xl font-black tracking-tight">你好, 训练师</h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={advanceDay} 
              className="w-10 h-10 rounded-full glass-card flex items-center justify-center text-slate-600 shadow-sm active:scale-90 transition-transform"
            >
              <FastForward size={20} />
            </button>
            <div ref={avatarInsightRef} className="relative flex flex-col items-end gap-1">
              <button
                type="button"
                aria-expanded={showAvatarInsight}
                aria-label={`查看${avatarState.label}状态说明`}
                onClick={() => setShowAvatarInsight((previous) => !previous)}
                className="flex flex-col items-end gap-1 rounded-2xl outline-none">
                <motion.div
                  layout
                  transition={{type: 'spring', stiffness: 340, damping: 26, mass: 0.7}}
                  className="relative">
                  <div className={cn('h-12 w-12 rounded-full bg-gradient-to-br p-[2px] shadow-[0_12px_26px_rgba(15,23,42,0.12)]', avatarState.ringGradient)}>
                    <div className="relative h-full w-full overflow-hidden rounded-full border border-white/80 bg-white p-[2px]">
                      <div className="relative h-full w-full overflow-hidden rounded-full bg-slate-100">
                        <img
                          src="https://api.dicebear.com/7.x/avataaars/svg?seed=trainer"
                          alt="Avatar"
                          className="h-full w-full object-cover transition-[filter,transform] duration-500"
                          style={avatarState.imageStyle}
                        />
                        <div
                          aria-hidden="true"
                          className={cn(
                            'pointer-events-none absolute inset-0 bg-gradient-to-br transition-opacity duration-500',
                            avatarState.overlayClass,
                          )}
                        />
                      </div>
                    </div>
                  </div>
                  <motion.span
                    key={avatarState.label}
                    initial={{scale: 0.82, opacity: 0.4}}
                    animate={{scale: 1, opacity: 1}}
                    transition={{duration: 0.24, ease: 'easeOut'}}
                    className={cn(
                      'absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-white shadow-sm',
                      avatarState.badgeClass,
                    )}>
                    {avatarState.badgeIcon}
                  </motion.span>
                </motion.div>
                <motion.div
                  key={`avatar-chip-${avatarState.label}`}
                  initial={{y: 3, opacity: 0}}
                  animate={{y: 0, opacity: 1}}
                  transition={{duration: 0.24, ease: 'easeOut'}}
                  className={cn(
                    'max-w-[84px] rounded-full px-2 py-0.5 text-[10px] font-black shadow-sm whitespace-nowrap',
                    avatarState.chipClass,
                  )}>
                  {avatarState.label}
                </motion.div>
              </button>

              <AnimatePresence>
                {showAvatarInsight ? (
                  <motion.div
                    initial={{opacity: 0, y: -6, scale: 0.96}}
                    animate={{opacity: 1, y: 0, scale: 1}}
                    exit={{opacity: 0, y: -6, scale: 0.96}}
                    transition={{duration: 0.2, ease: 'easeOut'}}
                    className="pointer-events-auto absolute right-0 top-full z-[80] mt-2 w-[220px] rounded-[22px] border border-white/70 bg-white/95 p-3 shadow-[0_18px_40px_rgba(15,23,42,0.14)] backdrop-blur-xl">
                    <div className="flex items-start gap-2">
                      <div className={cn('mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-br', avatarState.ringGradient)} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-black text-slate-800">{avatarState.label}</p>
                          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-black text-slate-500">
                            今日状态
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] font-medium leading-5 text-slate-500">
                          {avatarState.description}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-0 px-5 space-y-4">
        <div className="relative">
          <AnimatePresence>
            {homePassers.length > 0 ? (
              <div className="pointer-events-none absolute inset-x-2 -top-12 z-[300] h-14">
                {homePassers.map((passer) => {
                  const spriteOption = isPetSpriteKey(passer.pet.petId)
                    ? getPetSpriteOptionByKey(passer.pet.petId)
                    : null;
                  const legacyPet = !spriteOption
                    ? PETS.find((pet) => pet.id === passer.pet.petId)
                    : null;
                  const legacyEmoji = passer.pet.state === 'focus'
                    ? legacyPet?.focus
                    : passer.pet.state === 'heal'
                      ? legacyPet?.heal
                      : passer.pet.state === 'active'
                        ? legacyPet?.active
                        : legacyPet?.base;

                  return (
                    <motion.div
                      key={passer.id}
                      initial={{left: `${passer.startX}%`, opacity: 0, scale: 0.88}}
                      animate={{
                        left: `${passer.endX}%`,
                        opacity: [0, 1, 1, 0],
                        scale: [0.88, 1, 1, 0.97],
                      }}
                      exit={{opacity: 0}}
                      transition={{
                        left: {
                          duration: passer.duration,
                          delay: passer.delay,
                          ease: 'linear',
                        },
                        opacity: {
                          duration: passer.duration,
                          delay: passer.delay,
                          times: [0, 0.06, 0.92, 1],
                          ease: 'linear',
                        },
                        scale: {
                          duration: passer.duration,
                          delay: passer.delay,
                          times: [0, 0.06, 0.9, 1],
                          ease: 'easeOut',
                        },
                      }}
                      className="absolute z-[301]"
                      style={{top: `${passer.topOffset}px`}}>
                      {spriteOption ? (
                        <SpriteActor
                          spriteKey={spriteOption.key}
                          action={passer.action}
                          scale={Math.min((spriteOption.sceneScale ?? 2.3) * 0.58, 1.55)}
                          flipX={passer.flipX}
                          ariaLabel={spriteOption.label}
                          className="drop-shadow-[0_4px_8px_rgba(15,23,42,0.22)]"
                        />
                      ) : passer.customImage ? (
                        <img
                          src={passer.customImage}
                          alt={passer.pet.nickname || '宠物'}
                          className="h-9 w-9 object-contain drop-shadow-[0_4px_8px_rgba(15,23,42,0.22)]"
                        />
                      ) : (
                        <span className="text-[28px] leading-none drop-shadow-[0_4px_8px_rgba(15,23,42,0.2)]">{legacyEmoji ?? '🐾'}</span>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            ) : null}
          </AnimatePresence>

          <section className="relative overflow-visible glass-card rounded-[26px] p-3.5 shadow-lg border-white/40">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[15px] font-black leading-none text-slate-900">{recordStatus.title}</p>
              </div>
              <p className="mt-1 text-[11px] font-medium leading-5 text-slate-500">
                已记录 {formatHours(totalAllocated)}h
                {remaining > 0.001 ? ` · 还差 ${formatHours(remaining)}h` : ' · 已完成'}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {actionFeedback ? (
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600 whitespace-nowrap">
                  {actionFeedback}
                </span>
              ) : null}
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-2xl shadow-sm',
                  recordStatus.tone === 'emerald' && 'bg-emerald-100 text-emerald-600',
                  recordStatus.tone === 'amber' && 'bg-amber-100 text-amber-600',
                  recordStatus.tone === 'rose' && 'bg-rose-100 text-rose-600',
                  recordStatus.tone === 'slate' && 'bg-white text-slate-500',
                )}>
                {recordStatus.tone === 'emerald' ? <BadgeCheck size={16} /> : <CircleAlert size={16} />}
              </div>
            </div>
          </div>

          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold text-slate-500">
              <span>今日完成度</span>
              <span>{formatHours(totalAllocated)} / 24h</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/85 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-700',
                  recordStatus.tone === 'emerald' && 'bg-emerald-500',
                  recordStatus.tone === 'amber' && 'bg-amber-500',
                  recordStatus.tone === 'rose' && 'bg-rose-500',
                  recordStatus.tone === 'slate' && 'bg-slate-400',
                )}
                style={{width: `${Math.min((Math.max(totalAllocated, 0) / 24) * 100, 100)}%`}}
              />
            </div>
          </div>

          {canQuickFill && recentTemplates.length > 0 ? (
            <div className="mt-3 flex items-center gap-2 overflow-x-auto scroll-hide">
              <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-slate-400">
                最近模板
              </span>
              {recentTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleApplyTemplate(template)}
                  className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-700 shadow-sm transition-all active:scale-[0.97]">
                  <span className="text-slate-800">{template.label}</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-400">{formatHours(template.totalHours)}h</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-3 flex items-center gap-2">
            {canCopyYesterday ? (
              <button
                onClick={handleCopyYesterday}
                className="flex h-9 flex-1 items-center justify-center gap-2 rounded-xl border border-indigo-100 bg-white px-3 text-[11px] font-black text-indigo-700 shadow-sm transition-all active:scale-[0.97]">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
                  <Copy size={12} />
                </span>
                复制昨天
              </button>
            ) : null}

            <button
              onClick={handleOpenTemplateSheet}
              className={cn(
                'flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-700 shadow-sm transition-all active:scale-[0.97]',
                canCopyYesterday || hasSecondaryActions ? 'flex-1' : 'w-full',
              )}>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <LayoutGrid size={12} />
              </span>
              模板
            </button>

            {hasSecondaryActions ? (
              <button
                type="button"
                onClick={() => setShowSecondaryActions((previous) => !previous)}
                aria-expanded={showSecondaryActions}
                className={cn(
                  'flex h-9 items-center justify-center gap-1.5 rounded-xl border px-3 text-[11px] font-black shadow-sm transition-all active:scale-[0.97]',
                  showSecondaryActions
                    ? 'border-slate-300 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-600',
                )}>
                <MoreHorizontal size={14} />
                更多
              </button>
            ) : null}
          </div>

          <AnimatePresence>
            {showSecondaryActions ? (
              <motion.div
                initial={{opacity: 0, y: -6}}
                animate={{opacity: 1, y: 0}}
                exit={{opacity: 0, y: -6}}
                transition={{duration: 0.18, ease: 'easeOut'}}
                className={cn(
                  'mt-3 grid gap-2',
                  canUndoLast && canClearToday ? 'grid-cols-2' : 'grid-cols-1',
                )}>
                {canUndoLast ? (
                  <button
                    onClick={handleUndoLast}
                    className="flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-700 shadow-sm transition-all active:scale-[0.97]">
                    <RotateCcw size={12} />
                    撤销上次
                  </button>
                ) : null}
                {canClearToday ? (
                  <button
                    onClick={handleClearToday}
                    className="flex h-9 items-center justify-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 text-[11px] font-black text-rose-500 transition-all active:scale-[0.97]">
                    <Trash2 size={12} />
                    清空未投喂
                  </button>
                ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>
          </section>
        </div>

        <section className="glass-card rounded-[28px] p-3.5 shadow-xl border-white/40">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-black flex items-center gap-2 text-slate-900">
                <Plus size={20} className="text-indigo-500" />
                分配时间
              </h2>
              <p className="mt-1 text-[11px] font-medium text-slate-400">记录今天的时间结构</p>
            </div>
            <button
              onClick={() => setShowHeatmap(!showHeatmap)}
              title="查看热力图"
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors',
                showHeatmap
                  ? 'bg-indigo-50 text-indigo-600 border-indigo-100'
                  : 'text-slate-400 hover:bg-slate-50 border-slate-200',
              )}>
              <CalendarIcon size={16} />
            </button>
          </div>

          {showHeatmap ? (
            <TimeHeatmap
              allocations={allocations}
              simulatedDateOffset={simulatedDateOffset}
              variant="plain"
              onDaySelect={setSelectedDetailDateKey}
              selectedDateKey={selectedDetailDateKey}
            />
          ) : (
            <AllocationComposerPanel remaining={remaining} onAllocate={handleAllocate} />
          )}
        </section>

        <TodayDistributionSection
          distribution={distribution}
          recordProgress={recordProgress}
          summaryInsight={summaryInsight}
          dayKey={todayStr}
        />

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
                    ? '农场'
                    : currentEgg.theme === 'B'
                      ? '深海（暂未开放）'
                      : currentEgg.theme === 'custom'
                        ? '手绘乐园'
                        : '农场'}{' '}
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
          <div className="mb-4 flex items-center justify-between gap-3 px-1">
            <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">今日流水</h3>
              <p className="mt-1 text-[11px] font-medium text-slate-400">未投喂可直接编辑，已投喂记录保持锁定</p>
            </div>
            <div className="flex gap-2">
              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-500 shadow-sm">
                未投喂 {todayUnusedAllocations.length}
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-indigo-600 shadow-sm">
                已投喂 {todayUsedAllocations.length}
              </span>
            </div>
          </div>
          {todayAllocations.length === 0 ? (
            <div className="p-10 text-center glass-card rounded-3xl border-dashed border-slate-200">
              <p className="text-xs font-bold text-slate-300">还没有记录哦...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayAllocations.map((allocation) => {
                const activity = getActivityConfig(allocation.type);
                return (
                  <div key={allocation.id} className="glass-card rounded-[28px] border-white/40 p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 border-white text-white shadow-sm',
                          activity?.baseColor,
                        )}>
                        {activity?.icon}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h5 className="truncate text-sm font-black text-slate-800">{activity?.label}</h5>
                          {allocation.used ? (
                            <span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-black text-indigo-600">
                              已投喂
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500">
                              可编辑
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] font-medium text-slate-400">
                          分配于 {new Date(allocation.timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                        </p>
                      </div>

                      <div className="text-right">
                        <div className="text-lg font-mono font-black text-slate-800">+{formatHours(allocation.hours)}h</div>
                        {allocation.used ? (
                          <p className="mt-2 text-[10px] font-bold text-slate-300">已进入成长进度</p>
                        ) : (
                          <div className="mt-2 flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditor(allocation.id)}
                              className="rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-black text-slate-600 transition-all active:scale-[0.96]">
                              <span className="inline-flex items-center gap-1">
                                <Pencil size={10} />
                                编辑
                              </span>
                            </button>
                            <button
                              onClick={() => handleDeleteAllocation(allocation.id)}
                              className="rounded-full border border-rose-100 bg-rose-50 px-2.5 py-1.5 text-[10px] font-black text-rose-500 transition-all active:scale-[0.96]">
                              删除
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {templateSheetMode ? (
        <div
          className="fixed inset-0 z-[80] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.58),_transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.08),rgba(15,23,42,0.28))] backdrop-blur-[10px]"
          onClick={handleCloseTemplateSheet}>
          <div
            className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-hidden rounded-t-[36px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(248,250,252,0.99)_100%)] p-5 shadow-[0_-20px_60px_rgba(15,23,42,0.16)]"
            onClick={(event) => event.stopPropagation()}>
            <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.14),_transparent_58%)]" />
            <div className="absolute -right-8 top-6 h-28 w-28 rounded-full bg-sky-100/70 blur-3xl" />
            <div className="absolute -left-10 bottom-8 h-24 w-24 rounded-full bg-emerald-100/60 blur-3xl" />

            <div className="relative mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200" />

            <div className="relative mb-4 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2">
                {templateSheetMode === 'create-template' || templateSheetMode === 'edit-template' ? (
                  <button
                    onClick={handleBackToTemplateList}
                    className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/80 bg-white/90 text-slate-400 shadow-sm transition-colors hover:text-slate-700">
                    <ChevronLeft size={18} />
                  </button>
                ) : null}
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">模板库</p>
                  <h3 className="mt-1 text-xl font-black text-slate-900">
                    {templateSheetMode === 'apply'
                      ? '套用常用模板'
                      : templateSheetMode === 'create-template'
                        ? '新建模板'
                        : '编辑模板'}
                  </h3>
                  <p className="mt-1 text-[11px] font-medium leading-5 text-slate-400">
                    {templateSheetMode === 'apply'
                      ? '这里可以直接套用、编辑或新增常用分布模板。'
                      : templateSheetMode === 'create-template'
                        ? '保存一个常用分布，后面可以一键套用。'
                        : '调整名称和结构，保存后模板库会同步更新。'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseTemplateSheet}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-white/90 text-slate-400 shadow-sm transition-colors hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <div className="relative max-h-[calc(88vh-120px)] overflow-y-auto scroll-hide pr-1">
              {templateSheetMode === 'apply' ? (
                <div className="space-y-3 pb-1">
                  <button
                    onClick={handleOpenCreateTemplate}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-[12px] font-black text-slate-700 shadow-sm transition-all active:scale-[0.97]">
                    新建模板
                  </button>

                  <div className="flex items-center justify-between gap-3 rounded-[24px] border border-white/80 bg-white/82 px-3 py-3 shadow-sm">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">模板排序</p>
                      <p className="mt-1 text-[11px] font-medium text-slate-400">始终优先展示置顶模板</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 p-1">
                      {([
                        {value: 'recent', label: '最近'},
                        {value: 'name', label: '名称'},
                        {value: 'hours', label: '时长'},
                      ] as Array<{value: TemplateSortMode; label: string}>).map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setTemplateSortMode(option.value)}
                          className={cn(
                            'rounded-full px-3 py-1.5 text-[11px] font-black transition-all whitespace-nowrap',
                            templateSortMode === option.value
                              ? 'bg-white text-slate-800 shadow-sm'
                              : 'text-slate-500',
                          )}>
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {templateSheetMode === 'apply' && !canQuickFill ? (
                    <div className="rounded-[24px] border border-amber-100 bg-amber-50/80 px-4 py-3">
                      <p className="text-[11px] font-black text-amber-700">今天已有投喂记录</p>
                      <p className="mt-1 text-[11px] font-medium leading-5 text-amber-600/80">
                        仍可在这里新增或编辑模板，但当前日期不能整体覆盖分配。
                      </p>
                    </div>
                  ) : null}

                  {templateLibrary.length > 0 ? (
                    templateLibrary.map((template) => (
                      <div
                        key={template.id}
                        className="rounded-[28px] border border-white/90 bg-white/88 p-4 shadow-[0_12px_24px_rgba(15,23,42,0.06)]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm font-black text-slate-800">{template.label}</div>
                              {template.pinned ? (
                                <span className="rounded-full border border-amber-100 bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-600">
                                  置顶
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs font-medium leading-5 text-slate-400">
                              {template.summary}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-slate-50 px-3 py-1.5 text-[10px] font-black text-slate-500">
                            {formatHours(template.totalHours)}h
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {template.drafts.map((draft) => {
                            const activity = getActivityConfig(draft.type);
                            return (
                              <span
                                key={`${template.id}-${draft.type}`}
                                className="inline-flex items-center gap-1.5 rounded-full border border-slate-100 bg-white/85 px-2.5 py-1 text-[10px] font-bold text-slate-500">
                                <span className={cn('h-2 w-2 rounded-full', activity?.baseColor)} />
                                {activity?.label} {formatHours(draft.hours)}h
                              </span>
                            );
                          })}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-50 px-3 py-1.5 text-[10px] font-black text-slate-500">
                            使用 {template.usageCount} 次
                          </span>
                          <span className="rounded-full bg-slate-50 px-3 py-1.5 text-[10px] font-black text-slate-500">
                            {template.lastUsedAt
                              ? `最近 ${new Date(template.lastUsedAt).toLocaleDateString('zh-CN', {
                                  month: 'numeric',
                                  day: 'numeric',
                                })}`
                              : '暂未使用'}
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-4 gap-2">
                          <button
                            onClick={() => handleToggleTemplatePinned(template)}
                            className={cn(
                              'flex items-center justify-center gap-1.5 rounded-2xl border px-2 py-2.5 text-[11px] font-black transition-all active:scale-[0.97]',
                              template.pinned
                                ? 'border-amber-100 bg-amber-50 text-amber-600'
                                : 'border-slate-200 bg-white text-slate-600',
                            )}>
                            <Pin size={12} />
                            置顶
                          </button>
                          <button
                            onClick={() => handleDuplicateTemplate(template)}
                            className="flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-2 py-2.5 text-[11px] font-black text-slate-600 transition-all active:scale-[0.97]">
                            <Copy size={12} />
                            复制
                          </button>
                          <button
                            onClick={() => handleOpenEditTemplate(template)}
                            className="flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-2 py-2.5 text-[11px] font-black text-slate-600 transition-all active:scale-[0.97]">
                            <Pencil size={12} />
                            编辑
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template.id, template.label)}
                            className="flex items-center justify-center gap-1.5 rounded-2xl border border-rose-100 bg-rose-50 px-2 py-2.5 text-[11px] font-black text-rose-500 transition-all active:scale-[0.97]">
                            <Trash2 size={12} />
                            删除
                          </button>
                        </div>

                        <div className="mt-3 flex items-center justify-end">
                          <button
                            onClick={() => handleApplyTemplate(template)}
                            disabled={!canQuickFill}
                            className={cn(
                              'rounded-full px-4 py-2 text-[11px] font-black transition-all whitespace-nowrap',
                              canQuickFill
                                ? 'bg-slate-900 text-white shadow-sm active:scale-[0.97]'
                                : 'bg-slate-100 text-slate-300',
                            )}>
                            套用到今天
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[28px] border border-dashed border-slate-200 bg-white/88 px-4 py-8 text-center">
                      <p className="text-sm font-black text-slate-700">还没有保存模板</p>
                      <p className="mt-1 text-[11px] font-medium text-slate-400">
                        先创建一个常用分布，之后首页就可以一键套用。
                      </p>
                      <button
                        onClick={handleOpenCreateTemplate}
                        className="mt-4 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black text-slate-700 shadow-sm transition-all active:scale-[0.97]">
                        新建第一个模板
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4 pb-1">
                  {renderDraftComposer({
                    drafts: templateEditorDrafts,
                    onChange: (drafts) => setTemplateEditorDrafts(drafts),
                    labelValue: templateEditorLabel,
                    onLabelChange: setTemplateEditorLabel,
                  })}

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleBackToTemplateList}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-black text-slate-500 transition-all active:scale-[0.97]">
                      返回列表
                    </button>
                    <button
                      onClick={handleSaveTemplateEditor}
                      disabled={templateEditorLabel.trim().length === 0 || templateEditorDrafts.length === 0}
                      className={cn(
                        'rounded-2xl px-4 py-4 text-sm font-black transition-all active:scale-[0.97]',
                        templateEditorLabel.trim().length === 0 || templateEditorDrafts.length === 0
                          ? 'bg-slate-100 text-slate-300'
                          : 'bg-slate-900 text-white shadow-lg shadow-slate-200',
                      )}>
                      保存模板
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {editingAllocation ? (
        <div className="fixed inset-0 z-[90] bg-slate-900/30 backdrop-blur-sm" onClick={() => setEditingAllocationId(null)}>
          <div
            className="absolute inset-x-0 bottom-0 glass-card rounded-t-[36px] border-white/40 p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">流水编辑</p>
                <h3 className="mt-1 text-xl font-black text-slate-900">调整这条时间分配</h3>
              </div>
              <button
                onClick={() => setEditingAllocationId(null)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm transition-colors hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {ACTIVITY_CONFIG.map((activity) => (
                <button
                  key={activity.type}
                  onClick={() => setEditType(activity.type)}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-2xl border px-2 py-3 transition-all',
                    editType === activity.type
                      ? cn(activity.color, 'shadow-sm')
                      : 'border-transparent bg-white text-slate-400 shadow-sm',
                  )}>
                  {activity.icon}
                  <span className="text-[9px] font-black">{activity.label}</span>
                </button>
              ))}
            </div>

            <div className="mt-5 rounded-[28px] bg-slate-900 p-4 text-white">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black">分配时长</span>
                <div className="text-2xl font-mono font-black">
                  <AnimatedHoursValue value={editHours} valueClassName="" unitClassName="" />
                  <span>h</span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {TIME_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setEditHours(Math.min(preset, editHoursMax))}
                    disabled={editHoursMax === 0}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-[11px] font-black transition-all',
                      editHoursMax > 0
                        ? 'border-white/15 bg-white/10 text-white/85 active:scale-[0.96]'
                        : 'border-white/10 bg-white/5 text-white/30',
                    )}>
                    {formatHours(preset)}h
                  </button>
                ))}
              </div>

              <div className="mt-4 rounded-full bg-white/12 px-1.5 py-2">
                <input
                  type="range"
                  min="0"
                  max={editHoursMax}
                  step="0.5"
                  value={Math.min(editHours, editHoursMax)}
                  onInput={(e) => setEditHours(parseFloat((e.target as HTMLInputElement).value))}
                  className="time-slider w-full cursor-pointer appearance-none"
                  style={{
                    '--slider-color': getActivityConfig(editType)?.hexColor ?? '#6366f1',
                    '--slider-shadow': `${getActivityConfig(editType)?.hexColor ?? '#6366f1'}33`,
                    '--slider-soft': `${getActivityConfig(editType)?.hexColor ?? '#6366f1'}16`,
                    background: `linear-gradient(90deg, ${getActivityConfig(editType)?.hexColor ?? '#6366f1'} 0%, ${getActivityConfig(editType)?.hexColor ?? '#6366f1'} ${editHoursMax === 0 ? 0 : (editHours / editHoursMax) * 100}%, rgba(255,255,255,0.16) ${editHoursMax === 0 ? 0 : (editHours / editHoursMax) * 100}%, rgba(255,255,255,0.16) 100%)`,
                  } as React.CSSProperties}
                  disabled={editHoursMax === 0}
                />
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-[11px] font-medium text-white/60">左右拖动调节</span>
                <span className="rounded-full bg-white/12 px-3 py-1.5 text-[10px] font-black text-white/80 whitespace-nowrap">
                  上限 {formatHours(editHoursMax)}h
                </span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={() => handleDeleteAllocation(editingAllocation.id)}
                className="flex items-center justify-center gap-2 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-4 text-sm font-black text-rose-500 transition-all active:scale-[0.97]">
                <Trash2 size={16} />
                删除这条
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editHours <= 0 || editHours > editHoursMax}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-2xl px-4 py-4 text-sm font-black transition-all active:scale-[0.97]',
                  editHours <= 0 || editHours > editHoursMax
                    ? 'bg-slate-100 text-slate-300'
                    : 'bg-indigo-600 text-white shadow-lg shadow-indigo-200',
                )}>
                <Check size={16} />
                保存修改
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <DayDetailSheet
        open={selectedDetailDateKey !== null}
        dateKey={selectedDetailDateKey}
        allocations={allocations}
        onClose={() => setSelectedDetailDateKey(null)}
      />
    </div>
  );
}
