import {createEmptyActivityTotals} from '../constants/activities';
import type {Allocation, ActivityType} from '../store/useStore';

export type SceneWorldEchoTone = 'rose' | 'amber' | 'violet' | 'emerald' | 'sky';

export interface SceneWorldEchoInsight {
  key: string;
  icon: string;
  tone: SceneWorldEchoTone;
  lines: string[];
}

interface ActivitySummary {
  totals: Record<ActivityType, number>;
  totalAllocated: number;
  focusHours: number;
  restHours: number;
  entertainmentHours: number;
  exerciseHours: number;
  activeActivityCount: number;
  dominantType: ActivityType;
  dominantShare: number;
  focusRatio: number;
}

function buildActivitySummary(allocations: Allocation[]): ActivitySummary {
  const totals = createEmptyActivityTotals();

  allocations.forEach((allocation) => {
    if (allocation.hours <= 0) return;
    totals[allocation.type] += allocation.hours;
  });

  const totalAllocated = Object.values(totals).reduce((sum, hours) => sum + hours, 0);
  const focusHours = totals.work + totals.study;
  const restHours = totals.rest;
  const entertainmentHours = totals.entertainment;
  const exerciseHours = totals.exercise;
  const activeActivityCount = (Object.values(totals) as number[]).filter((hours) => hours > 0.4).length;
  const dominantType = (Object.entries(totals) as Array<[ActivityType, number]>).reduce<ActivityType>(
    (currentBest, [type, hours]) => (hours > totals[currentBest] ? type : currentBest),
    'work',
  );
  const dominantShare = totalAllocated <= 0.001 ? 0 : totals[dominantType] / totalAllocated;
  const focusRatio = totalAllocated <= 0.001 ? 0 : focusHours / totalAllocated;

  return {
    totals,
    totalAllocated,
    focusHours,
    restHours,
    entertainmentHours,
    exerciseHours,
    activeActivityCount,
    dominantType,
    dominantShare,
    focusRatio,
  };
}

export function getSceneWorldEchoInsight(
  todayAllocations: Allocation[],
  yesterdayAllocations: Allocation[],
): SceneWorldEchoInsight | null {
  const today = buildActivitySummary(todayAllocations);
  const yesterday = buildActivitySummary(yesterdayAllocations);

  if (today.totalAllocated < 2.5) return null;

  const focusDelta = today.focusHours - yesterday.focusHours;
  const restDelta = today.restHours - yesterday.restHours;
  const entertainmentShare = today.totalAllocated <= 0.001 ? 0 : today.entertainmentHours / today.totalAllocated;

  if (
    today.totalAllocated >= 8
    && today.restHours < 6.5
    && (today.focusHours >= 6 || today.focusRatio >= 0.58)
  ) {
    return {
      key: 'rest_low',
      icon: '😪',
      tone: 'rose',
      lines: [
        '今天大家都有点困困的',
        '空气软趴趴的，好想打盹',
        '你是不是还没休息够呀',
        '我也有点提不起劲',
        '今天的步子都慢下来了',
        '我想和你一起补个觉',
      ],
    };
  }

  if (
    yesterday.totalAllocated >= 4
    && yesterday.restHours < 6.5
    && today.restHours >= 8
    && restDelta >= 2
    && today.totalAllocated >= 8
  ) {
    return {
      key: 'recovery',
      icon: '🌤️',
      tone: 'sky',
      lines: [
        '今天感觉恢复过来了',
        '你今天好像轻松了一些',
        '农场终于又松下来啦',
        '大家都跟着舒服了不少',
        '今天的呼吸变顺了',
        '看起来比昨天更有精神了',
      ],
    };
  }

  if (
    today.totalAllocated >= 12
    && today.activeActivityCount >= 3
    && today.dominantShare < 0.46
    && today.focusHours >= 5
    && today.restHours >= 6.5
  ) {
    return {
      key: 'balance',
      icon: '🍃',
      tone: 'emerald',
      lines: [
        '今天一切都刚刚好',
        '农场今天很舒服',
        '大家的节奏都很稳',
        '这里现在很安心',
        '像被好好整理过一样',
        '今天的感觉很完整',
      ],
    };
  }

  if (today.exerciseHours >= 1.5 && today.totalAllocated >= 6) {
    return {
      key: 'vitality',
      icon: '⚡',
      tone: 'emerald',
      lines: [
        '今天好有精神呀',
        '我想跑一跑',
        '连风都变快了一点',
        '草地今天很有活力',
        '大家都想活动筋骨',
        '今天连脚步都轻快了',
      ],
    };
  }

  if (
    (today.focusHours >= 6 && today.focusRatio >= 0.56)
    || (today.totalAllocated >= 8 && today.focusHours >= 5 && focusDelta >= 2)
  ) {
    return {
      key: 'focus_glow',
      icon: '✨',
      tone: 'amber',
      lines: [
        '今天的风都安静了一点',
        '草地亮亮的，像被认真照顾过',
        '我感觉这里更明亮了',
        '连阳光都变得规整了',
        '今天的空气很清透',
        '你今天好专心呀',
      ],
    };
  }

  if (today.entertainmentHours >= 3 && entertainmentShare >= 0.23 && today.totalAllocated >= 6) {
    return {
      key: 'ease',
      icon: '☁️',
      tone: 'sky',
      lines: [
        '今天的农场好轻松',
        '心情像晒过太阳一样',
        '大家今天都挺开心',
        '今天这里软绵绵的',
        '空气里有种轻飘飘的快乐',
        '连草叶都在慢慢晃',
      ],
    };
  }

  if (today.restHours < 6 && today.totalAllocated >= 7) {
    return {
      key: 'rest_low_soft',
      icon: '😴',
      tone: 'violet',
      lines: [
        '今天大家有点想偷懒',
        '我好像有一点点犯困',
        '农场今天慢吞吞的',
        '今天的气息有点软塌塌',
        '好想找一块草地躺一下',
        '今天走两步就想歇一会儿',
      ],
    };
  }

  return null;
}
