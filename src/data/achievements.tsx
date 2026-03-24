import React from 'react';
import {
  Award,
  BookOpen,
  CalendarCheck2,
  Palette,
  ShieldCheck,
  Smile,
  Sparkles,
  Target,
  Utensils,
  Wand2,
  Wheat,
  Zap,
} from 'lucide-react';
import {PET_SPRITE_OPTIONS} from './petSprites';
import {getDateKey, getSimulatedDate} from '../utils/date';
import type {CompletedPet} from '../store/useStore';
import type {FacilityInventory} from './facilities';
import type {FoodInventory} from './foods';

type ActivityAllocation = {hours: number; type: string};

export type AchievementCategory = 'collection' | 'companionship' | 'habit' | 'management';
export type AchievementIconKey =
  | 'sparkles'
  | 'target'
  | 'award'
  | 'shield'
  | 'calendar'
  | 'smile'
  | 'palette'
  | 'utensils'
  | 'wand'
  | 'wheat'
  | 'book'
  | 'zap';

export interface AchievementItem {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  progress: string;
  iconKey: AchievementIconKey;
  category: AchievementCategory;
}

export interface AchievementCatalogInput {
  unlockedPets: Record<string, string[]>;
  completedPets: CompletedPet[];
  allocations: Record<string, ActivityAllocation[]>;
  simulatedDateOffset: number;
  facilityInventory: FacilityInventory;
  foodInventory: FoodInventory;
  planTemplateCount: number;
}

interface AchievementStats {
  farmUnlockedCount: number;
  farmTotalCount: number;
  farmOwnedCount: number;
  farmRareOrEpicCount: number;
  farmPerfectCount: number;
  customOwnedCount: number;
  namedPetCount: number;
  totalPetCount: number;
  recordStreak: number;
  recordedDayCount: number;
  fullDayCount: number;
  recentRecordedDays: number;
  recentExerciseDays: number;
  balancedDayCount: number;
  totalExerciseHours: number;
  totalFocusHours: number;
  ownsMagicBroom: boolean;
  foodOwnedTypeCount: number;
  totalFoodStock: number;
  customPlanCount: number;
}

export interface AchievementOverviewStats {
  recordStreak: number;
  recordedDayCount: number;
  fullDayCount: number;
  farmUnlockedCount: number;
  farmTotalCount: number;
  farmOwnedCount: number;
  farmRareOrEpicCount: number;
}

interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  iconKey: AchievementIconKey;
  category: AchievementCategory;
  getProgress: (stats: AchievementStats) => string;
  isUnlocked: (stats: AchievementStats) => boolean;
}

export const ACHIEVEMENT_CATEGORY_META: Record<
  AchievementCategory,
  {label: string; description: string}
> = {
  collection: {
    label: '收集成就',
    description: '围绕图鉴解锁与个体收藏展开。',
  },
  companionship: {
    label: '陪伴成就',
    description: '关注品质、命名与陪伴规模。',
  },
  habit: {
    label: '习惯成就',
    description: '记录、连续性与生活节奏相关。',
  },
  management: {
    label: '经营成就',
    description: '设施、库存与自定义经营能力。',
  },
};

const FARM_SPRITE_OPTIONS = PET_SPRITE_OPTIONS.filter((option) => option.scene === 'farm');
const ACTIVITY_TYPES = ['work', 'study', 'entertainment', 'rest', 'exercise'] as const;
const DEFAULT_PLAN_TEMPLATE_COUNT = 3;

function getDayAllocatedHours(dayAllocations?: ActivityAllocation[]) {
  if (!dayAllocations || dayAllocations.length === 0) return 0;
  return dayAllocations.reduce((sum, item) => sum + item.hours, 0);
}

function hasActivityHours(
  dayAllocations: ActivityAllocation[] | undefined,
  activityType: string,
  minimumHours = 0.5,
) {
  if (!dayAllocations || dayAllocations.length === 0) return false;
  return dayAllocations.some((item) => item.type === activityType && item.hours >= minimumHours);
}

function sumActivityHours(allocations: Record<string, ActivityAllocation[]>, activityTypes: string[]) {
  return Object.values(allocations).reduce((sum, day) => (
    sum + day.reduce((daySum, item) => (
      activityTypes.includes(item.type) ? daySum + item.hours : daySum
    ), 0)
  ), 0);
}

function formatProgressValue(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

function formatThresholdProgress(value: number, target: number) {
  return `${formatProgressValue(Math.min(value, target))}/${formatProgressValue(target)}`;
}

function buildAchievementStats(input: AchievementCatalogInput): AchievementStats {
  const recentDateKeys = Array.from({length: 7}, (_, index) =>
    getDateKey(getSimulatedDate(input.simulatedDateOffset - (6 - index))),
  );
  const farmUnlockedCount = FARM_SPRITE_OPTIONS.reduce((sum, option) => {
    const states = input.unlockedPets[option.key] ?? [];
    return sum + (states.includes('base') ? 1 : 0);
  }, 0);
  const farmOwnedPets = input.completedPets.filter((pet) => pet.theme === 'A');
  const recordStreak = (() => {
    let streak = 0;
    for (let index = 0; index < 365; index += 1) {
      const key = getDateKey(getSimulatedDate(input.simulatedDateOffset - index));
      if (getDayAllocatedHours(input.allocations[key]) <= 0.01) break;
      streak += 1;
    }
    return streak;
  })();
  const recordedDayCount = Object.values(input.allocations).filter((day) => getDayAllocatedHours(day) > 0.01).length;
  const fullDayCount = Object.values(input.allocations).filter((day) => getDayAllocatedHours(day) >= 23.99).length;
  const balancedDayCount = Object.values(input.allocations).filter((day) => (
    getDayAllocatedHours(day) >= 23.99
    && ACTIVITY_TYPES.every((type) => hasActivityHours(day, type, 0.5))
  )).length;

  return {
    farmUnlockedCount,
    farmTotalCount: FARM_SPRITE_OPTIONS.length,
    farmOwnedCount: farmOwnedPets.length,
    farmRareOrEpicCount: farmOwnedPets.filter((pet) => pet.quality === 'rare' || pet.quality === 'epic').length,
    farmPerfectCount: farmOwnedPets.filter((pet) => pet.quality === 'epic').length,
    customOwnedCount: input.completedPets.filter((pet) => pet.theme === 'custom').length,
    namedPetCount: input.completedPets.filter((pet) => (pet.nickname ?? '').trim().length > 0).length,
    totalPetCount: input.completedPets.length,
    recordStreak,
    recordedDayCount,
    fullDayCount,
    recentRecordedDays: recentDateKeys.filter((key) => getDayAllocatedHours(input.allocations[key]) > 0.01).length,
    recentExerciseDays: recentDateKeys.filter((key) => hasActivityHours(input.allocations[key], 'exercise', 0.5)).length,
    balancedDayCount,
    totalExerciseHours: sumActivityHours(input.allocations, ['exercise']),
    totalFocusHours: sumActivityHours(input.allocations, ['work', 'study']),
    ownsMagicBroom: (input.facilityInventory.magicBroom ?? 0) > 0,
    foodOwnedTypeCount: Object.values(input.foodInventory).filter((count) => count > 0).length,
    totalFoodStock: Object.values(input.foodInventory).reduce((sum, count) => sum + count, 0),
    customPlanCount: Math.max(0, input.planTemplateCount - DEFAULT_PLAN_TEMPLATE_COUNT),
  };
}

export function buildAchievementOverviewStats(input: AchievementCatalogInput): AchievementOverviewStats {
  const stats = buildAchievementStats(input);
  return {
    recordStreak: stats.recordStreak,
    recordedDayCount: stats.recordedDayCount,
    fullDayCount: stats.fullDayCount,
    farmUnlockedCount: stats.farmUnlockedCount,
    farmTotalCount: stats.farmTotalCount,
    farmOwnedCount: stats.farmOwnedCount,
    farmRareOrEpicCount: stats.farmRareOrEpicCount,
  };
}

const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    id: 'farm-first',
    title: '初次邂逅',
    description: '解锁 1 只农场幻兽',
    iconKey: 'sparkles',
    category: 'collection',
    getProgress: (stats) => formatThresholdProgress(stats.farmUnlockedCount, 1),
    isUnlocked: (stats) => stats.farmUnlockedCount >= 1,
  },
  {
    id: 'farm-five',
    title: '小小牧场主',
    description: '解锁 5 只农场幻兽',
    iconKey: 'target',
    category: 'collection',
    getProgress: (stats) => formatThresholdProgress(stats.farmUnlockedCount, 5),
    isUnlocked: (stats) => stats.farmUnlockedCount >= 5,
  },
  {
    id: 'farm-ten',
    title: '图鉴渐丰',
    description: '解锁 10 只农场幻兽',
    iconKey: 'book',
    category: 'collection',
    getProgress: (stats) => formatThresholdProgress(stats.farmUnlockedCount, 10),
    isUnlocked: (stats) => stats.farmUnlockedCount >= 10,
  },
  {
    id: 'farm-half',
    title: '收集半程',
    description: '农场解锁达到 50%',
    iconKey: 'target',
    category: 'collection',
    getProgress: (stats) => {
      const target = Math.max(1, Math.ceil(stats.farmTotalCount * 0.5));
      return `${stats.farmUnlockedCount}/${target}`;
    },
    isUnlocked: (stats) => stats.farmUnlockedCount >= Math.max(1, Math.ceil(stats.farmTotalCount * 0.5)),
  },
  {
    id: 'farm-three-quarter',
    title: '收集冲刺',
    description: '农场解锁达到 75%',
    iconKey: 'shield',
    category: 'collection',
    getProgress: (stats) => {
      const target = Math.max(1, Math.ceil(stats.farmTotalCount * 0.75));
      return `${stats.farmUnlockedCount}/${target}`;
    },
    isUnlocked: (stats) => stats.farmUnlockedCount >= Math.max(1, Math.ceil(stats.farmTotalCount * 0.75)),
  },
  {
    id: 'farm-master',
    title: '农场图鉴师',
    description: '解锁全部农场幻兽',
    iconKey: 'award',
    category: 'collection',
    getProgress: (stats) => `${stats.farmUnlockedCount}/${stats.farmTotalCount}`,
    isUnlocked: (stats) => stats.farmTotalCount > 0 && stats.farmUnlockedCount === stats.farmTotalCount,
  },
  {
    id: 'farm-twenty',
    title: '收藏展柜',
    description: '解锁 20 只农场幻兽',
    iconKey: 'award',
    category: 'collection',
    getProgress: (stats) => formatThresholdProgress(stats.farmUnlockedCount, 20),
    isUnlocked: (stats) => stats.farmUnlockedCount >= 20,
  },
  {
    id: 'farm-owned-three',
    title: '新邻居入住',
    description: '累计拥有 3 只农场个体',
    iconKey: 'smile',
    category: 'companionship',
    getProgress: (stats) => formatThresholdProgress(stats.farmOwnedCount, 3),
    isUnlocked: (stats) => stats.farmOwnedCount >= 3,
  },
  {
    id: 'farm-owned-ten',
    title: '陪伴成群',
    description: '累计拥有 10 只农场个体',
    iconKey: 'smile',
    category: 'companionship',
    getProgress: (stats) => formatThresholdProgress(stats.farmOwnedCount, 10),
    isUnlocked: (stats) => stats.farmOwnedCount >= 10,
  },
  {
    id: 'farm-owned-twenty',
    title: '牧场热闹起来',
    description: '累计拥有 20 只农场个体',
    iconKey: 'award',
    category: 'companionship',
    getProgress: (stats) => formatThresholdProgress(stats.farmOwnedCount, 20),
    isUnlocked: (stats) => stats.farmOwnedCount >= 20,
  },
  {
    id: 'farm-owned-thirty',
    title: '牧场住满了',
    description: '累计拥有 30 只农场个体',
    iconKey: 'award',
    category: 'companionship',
    getProgress: (stats) => formatThresholdProgress(stats.farmOwnedCount, 30),
    isUnlocked: (stats) => stats.farmOwnedCount >= 30,
  },
  {
    id: 'farm-quality-three',
    title: '挑剔收藏家',
    description: '获得 3 只优秀或完美个体',
    iconKey: 'shield',
    category: 'companionship',
    getProgress: (stats) => formatThresholdProgress(stats.farmRareOrEpicCount, 3),
    isUnlocked: (stats) => stats.farmRareOrEpicCount >= 3,
  },
  {
    id: 'farm-quality-eight',
    title: '光芒渐盛',
    description: '获得 8 只优秀或完美个体',
    iconKey: 'sparkles',
    category: 'companionship',
    getProgress: (stats) => formatThresholdProgress(stats.farmRareOrEpicCount, 8),
    isUnlocked: (stats) => stats.farmRareOrEpicCount >= 8,
  },
  {
    id: 'farm-quality-fifteen',
    title: '闪光橱窗',
    description: '获得 15 只优秀或完美个体',
    iconKey: 'award',
    category: 'companionship',
    getProgress: (stats) => formatThresholdProgress(stats.farmRareOrEpicCount, 15),
    isUnlocked: (stats) => stats.farmRareOrEpicCount >= 15,
  },
  {
    id: 'farm-perfect-first',
    title: '完美降临',
    description: '获得 1 只完美品质幻兽',
    iconKey: 'sparkles',
    category: 'companionship',
    getProgress: (stats) => formatThresholdProgress(stats.farmPerfectCount, 1),
    isUnlocked: (stats) => stats.farmPerfectCount >= 1,
  },
  {
    id: 'farm-perfect-three',
    title: '闪耀收藏',
    description: '获得 3 只完美品质幻兽',
    iconKey: 'award',
    category: 'companionship',
    getProgress: (stats) => formatThresholdProgress(stats.farmPerfectCount, 3),
    isUnlocked: (stats) => stats.farmPerfectCount >= 3,
  },
  {
    id: 'farm-perfect-five',
    title: '星级收藏柜',
    description: '获得 5 只完美品质幻兽',
    iconKey: 'sparkles',
    category: 'companionship',
    getProgress: (stats) => formatThresholdProgress(stats.farmPerfectCount, 5),
    isUnlocked: (stats) => stats.farmPerfectCount >= 5,
  },
  {
    id: 'named-first',
    title: '它有名字了',
    description: '为 1 只幻兽命名',
    iconKey: 'smile',
    category: 'companionship',
    getProgress: (stats) => formatThresholdProgress(stats.namedPetCount, 1),
    isUnlocked: (stats) => stats.namedPetCount >= 1,
  },
  {
    id: 'named-five',
    title: '它们都有名字',
    description: '为 5 只幻兽命名',
    iconKey: 'book',
    category: 'companionship',
    getProgress: (stats) => formatThresholdProgress(stats.namedPetCount, 5),
    isUnlocked: (stats) => stats.namedPetCount >= 5,
  },
  {
    id: 'named-twelve',
    title: '名字册写满',
    description: '为 12 只幻兽命名',
    iconKey: 'book',
    category: 'companionship',
    getProgress: (stats) => formatThresholdProgress(stats.namedPetCount, 12),
    isUnlocked: (stats) => stats.namedPetCount >= 12,
  },
  {
    id: 'pets-all-themes',
    title: '大家庭',
    description: '累计拥有 20 只任意场景的宠物',
    iconKey: 'smile',
    category: 'companionship',
    getProgress: (stats) => formatThresholdProgress(stats.totalPetCount, 20),
    isUnlocked: (stats) => stats.totalPetCount >= 20,
  },
  {
    id: 'record-streak-3',
    title: '连续记录',
    description: '连续记录 3 天',
    iconKey: 'calendar',
    category: 'habit',
    getProgress: (stats) => formatThresholdProgress(stats.recordStreak, 3),
    isUnlocked: (stats) => stats.recordStreak >= 3,
  },
  {
    id: 'record-streak-7',
    title: '稳定在线',
    description: '连续记录 7 天',
    iconKey: 'calendar',
    category: 'habit',
    getProgress: (stats) => formatThresholdProgress(stats.recordStreak, 7),
    isUnlocked: (stats) => stats.recordStreak >= 7,
  },
  {
    id: 'record-streak-14',
    title: '节奏成形',
    description: '连续记录 14 天',
    iconKey: 'shield',
    category: 'habit',
    getProgress: (stats) => formatThresholdProgress(stats.recordStreak, 14),
    isUnlocked: (stats) => stats.recordStreak >= 14,
  },
  {
    id: 'record-streak-30',
    title: '整月守约',
    description: '连续记录 30 天',
    iconKey: 'award',
    category: 'habit',
    getProgress: (stats) => formatThresholdProgress(stats.recordStreak, 30),
    isUnlocked: (stats) => stats.recordStreak >= 30,
  },
  {
    id: 'recorded-days-15',
    title: '习惯打卡员',
    description: '累计记录 15 天',
    iconKey: 'calendar',
    category: 'habit',
    getProgress: (stats) => formatThresholdProgress(stats.recordedDayCount, 15),
    isUnlocked: (stats) => stats.recordedDayCount >= 15,
  },
  {
    id: 'recorded-days-30',
    title: '习惯已发芽',
    description: '累计记录 30 天',
    iconKey: 'book',
    category: 'habit',
    getProgress: (stats) => formatThresholdProgress(stats.recordedDayCount, 30),
    isUnlocked: (stats) => stats.recordedDayCount >= 30,
  },
  {
    id: 'recorded-days-60',
    title: '记录常青树',
    description: '累计记录 60 天',
    iconKey: 'award',
    category: 'habit',
    getProgress: (stats) => formatThresholdProgress(stats.recordedDayCount, 60),
    isUnlocked: (stats) => stats.recordedDayCount >= 60,
  },
  {
    id: 'full-days-3',
    title: '全天候记录',
    description: '完成 3 天完整记录',
    iconKey: 'shield',
    category: 'habit',
    getProgress: (stats) => formatThresholdProgress(stats.fullDayCount, 3),
    isUnlocked: (stats) => stats.fullDayCount >= 3,
  },
  {
    id: 'full-days-10',
    title: '满格生活',
    description: '完成 10 天完整记录',
    iconKey: 'award',
    category: 'habit',
    getProgress: (stats) => formatThresholdProgress(stats.fullDayCount, 10),
    isUnlocked: (stats) => stats.fullDayCount >= 10,
  },
  {
    id: 'full-days-30',
    title: '整月满格',
    description: '完成 30 天完整记录',
    iconKey: 'award',
    category: 'habit',
    getProgress: (stats) => formatThresholdProgress(stats.fullDayCount, 30),
    isUnlocked: (stats) => stats.fullDayCount >= 30,
  },
  {
    id: 'recent-record-5',
    title: '稳定习惯',
    description: '近 7 天记录 ≥ 5 天',
    iconKey: 'calendar',
    category: 'habit',
    getProgress: (stats) => `${stats.recentRecordedDays}/5`,
    isUnlocked: (stats) => stats.recentRecordedDays >= 5,
  },
  {
    id: 'recent-record-7',
    title: '整周在线',
    description: '近 7 天连续全记录',
    iconKey: 'shield',
    category: 'habit',
    getProgress: (stats) => `${stats.recentRecordedDays}/7`,
    isUnlocked: (stats) => stats.recentRecordedDays >= 7,
  },
  {
    id: 'recent-exercise-3',
    title: '活力节奏',
    description: '近 7 天运动 ≥ 3 天',
    iconKey: 'zap',
    category: 'habit',
    getProgress: (stats) => `${stats.recentExerciseDays}/3`,
    isUnlocked: (stats) => stats.recentExerciseDays >= 3,
  },
  {
    id: 'recent-exercise-5',
    title: '运动惯性',
    description: '近 7 天运动 ≥ 5 天',
    iconKey: 'zap',
    category: 'habit',
    getProgress: (stats) => `${stats.recentExerciseDays}/5`,
    isUnlocked: (stats) => stats.recentExerciseDays >= 5,
  },
  {
    id: 'focus-hours-50',
    title: '专注储量',
    description: '累计投入 50 小时工作或学习',
    iconKey: 'book',
    category: 'habit',
    getProgress: (stats) => formatThresholdProgress(stats.totalFocusHours, 50),
    isUnlocked: (stats) => stats.totalFocusHours >= 50,
  },
  {
    id: 'focus-hours-150',
    title: '深度专注者',
    description: '累计投入 150 小时工作或学习',
    iconKey: 'award',
    category: 'habit',
    getProgress: (stats) => formatThresholdProgress(stats.totalFocusHours, 150),
    isUnlocked: (stats) => stats.totalFocusHours >= 150,
  },
  {
    id: 'exercise-hours-20',
    title: '活力储备',
    description: '累计运动 20 小时',
    iconKey: 'zap',
    category: 'habit',
    getProgress: (stats) => formatThresholdProgress(stats.totalExerciseHours, 20),
    isUnlocked: (stats) => stats.totalExerciseHours >= 20,
  },
  {
    id: 'exercise-hours-50',
    title: '动能满仓',
    description: '累计运动 50 小时',
    iconKey: 'award',
    category: 'habit',
    getProgress: (stats) => formatThresholdProgress(stats.totalExerciseHours, 50),
    isUnlocked: (stats) => stats.totalExerciseHours >= 50,
  },
  {
    id: 'balanced-days-3',
    title: '平衡生活家',
    description: '完成 3 天五类都被照顾到的完整记录',
    iconKey: 'sparkles',
    category: 'habit',
    getProgress: (stats) => formatThresholdProgress(stats.balancedDayCount, 3),
    isUnlocked: (stats) => stats.balancedDayCount >= 3,
  },
  {
    id: 'balanced-days-10',
    title: '生活调音师',
    description: '完成 10 天五类都被照顾到的完整记录',
    iconKey: 'shield',
    category: 'habit',
    getProgress: (stats) => formatThresholdProgress(stats.balancedDayCount, 10),
    isUnlocked: (stats) => stats.balancedDayCount >= 10,
  },
  {
    id: 'custom-first',
    title: '灵感降落',
    description: '拥有 1 只手绘宠物',
    iconKey: 'palette',
    category: 'management',
    getProgress: (stats) => formatThresholdProgress(stats.customOwnedCount, 1),
    isUnlocked: (stats) => stats.customOwnedCount >= 1,
  },
  {
    id: 'custom-three',
    title: '画笔繁星',
    description: '拥有 3 只手绘宠物',
    iconKey: 'palette',
    category: 'management',
    getProgress: (stats) => formatThresholdProgress(stats.customOwnedCount, 3),
    isUnlocked: (stats) => stats.customOwnedCount >= 3,
  },
  {
    id: 'custom-five',
    title: '创意展台',
    description: '拥有 5 只手绘宠物',
    iconKey: 'palette',
    category: 'management',
    getProgress: (stats) => formatThresholdProgress(stats.customOwnedCount, 5),
    isUnlocked: (stats) => stats.customOwnedCount >= 5,
  },
  {
    id: 'broom-owned',
    title: '魔法清扫上岗',
    description: '拥有 1 把魔法扫把',
    iconKey: 'wand',
    category: 'management',
    getProgress: (stats) => formatThresholdProgress(stats.ownsMagicBroom ? 1 : 0, 1),
    isUnlocked: (stats) => stats.ownsMagicBroom,
  },
  {
    id: 'food-types-4',
    title: '补给铺开张',
    description: '持有 4 种不同食物',
    iconKey: 'utensils',
    category: 'management',
    getProgress: (stats) => formatThresholdProgress(stats.foodOwnedTypeCount, 4),
    isUnlocked: (stats) => stats.foodOwnedTypeCount >= 4,
  },
  {
    id: 'food-types-8',
    title: '丰盛库存',
    description: '持有 8 种不同食物',
    iconKey: 'wheat',
    category: 'management',
    getProgress: (stats) => formatThresholdProgress(stats.foodOwnedTypeCount, 8),
    isUnlocked: (stats) => stats.foodOwnedTypeCount >= 8,
  },
  {
    id: 'food-stock-20',
    title: '粮仓见底前',
    description: '累计持有 20 份食物库存',
    iconKey: 'utensils',
    category: 'management',
    getProgress: (stats) => formatThresholdProgress(stats.totalFoodStock, 20),
    isUnlocked: (stats) => stats.totalFoodStock >= 20,
  },
  {
    id: 'food-stock-60',
    title: '补给山丘',
    description: '累计持有 60 份食物库存',
    iconKey: 'wheat',
    category: 'management',
    getProgress: (stats) => formatThresholdProgress(stats.totalFoodStock, 60),
    isUnlocked: (stats) => stats.totalFoodStock >= 60,
  },
  {
    id: 'custom-plan-first',
    title: '规划师',
    description: '保存 1 套自定义计划模板',
    iconKey: 'book',
    category: 'management',
    getProgress: (stats) => formatThresholdProgress(stats.customPlanCount, 1),
    isUnlocked: (stats) => stats.customPlanCount >= 1,
  },
  {
    id: 'custom-plan-three',
    title: '时间架构师',
    description: '保存 3 套自定义计划模板',
    iconKey: 'shield',
    category: 'management',
    getProgress: (stats) => formatThresholdProgress(stats.customPlanCount, 3),
    isUnlocked: (stats) => stats.customPlanCount >= 3,
  },
];

export function buildAchievementCatalog(input: AchievementCatalogInput): AchievementItem[] {
  const stats = buildAchievementStats(input);
  return ACHIEVEMENT_DEFINITIONS.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    unlocked: item.isUnlocked(stats),
    progress: item.getProgress(stats),
    iconKey: item.iconKey,
    category: item.category,
  }));
}

export function AchievementIcon({
  iconKey,
  size = 14,
  className,
}: {
  iconKey: AchievementIconKey;
  size?: number;
  className?: string;
}) {
  switch (iconKey) {
    case 'target':
      return <Target size={size} className={className} />;
    case 'award':
      return <Award size={size} className={className} />;
    case 'shield':
      return <ShieldCheck size={size} className={className} />;
    case 'calendar':
      return <CalendarCheck2 size={size} className={className} />;
    case 'smile':
      return <Smile size={size} className={className} />;
    case 'palette':
      return <Palette size={size} className={className} />;
    case 'utensils':
      return <Utensils size={size} className={className} />;
    case 'wand':
      return <Wand2 size={size} className={className} />;
    case 'wheat':
      return <Wheat size={size} className={className} />;
    case 'book':
      return <BookOpen size={size} className={className} />;
    case 'zap':
      return <Zap size={size} className={className} />;
    case 'sparkles':
    default:
      return <Sparkles size={size} className={className} />;
  }
}
