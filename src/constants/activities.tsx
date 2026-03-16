import type {ReactNode} from 'react';
import {Bed, BookOpen, Briefcase, Dumbbell, Gamepad2} from 'lucide-react';
import type {ActivityType} from '../store/useStore';

export interface ActivityConfig {
  type: ActivityType;
  label: string;
  icon: ReactNode;
  color: string;
  baseColor: string;
  hexColor: string;
}

export const ACTIVITY_CONFIG: ActivityConfig[] = [
  {
    type: 'work',
    label: '工作',
    icon: <Briefcase size={16} />,
    color: 'text-rose-500 border-rose-500 bg-rose-50',
    baseColor: 'bg-rose-500',
    hexColor: '#f43f5e',
  },
  {
    type: 'study',
    label: '学习',
    icon: <BookOpen size={16} />,
    color: 'text-amber-500 border-amber-500 bg-amber-50',
    baseColor: 'bg-amber-500',
    hexColor: '#f59e0b',
  },
  {
    type: 'entertainment',
    label: '娱乐',
    icon: <Gamepad2 size={16} />,
    color: 'text-sky-500 border-sky-500 bg-sky-50',
    baseColor: 'bg-sky-500',
    hexColor: '#0ea5e9',
  },
  {
    type: 'rest',
    label: '休息',
    icon: <Bed size={16} />,
    color: 'text-indigo-500 border-indigo-500 bg-indigo-50',
    baseColor: 'bg-indigo-500',
    hexColor: '#6366f1',
  },
  {
    type: 'exercise',
    label: '运动',
    icon: <Dumbbell size={16} />,
    color: 'text-emerald-500 border-emerald-500 bg-emerald-50',
    baseColor: 'bg-emerald-500',
    hexColor: '#10b981',
  },
];

export function createEmptyActivityTotals(): Record<ActivityType, number> {
  return {
    work: 0,
    study: 0,
    entertainment: 0,
    rest: 0,
    exercise: 0,
  };
}

export function getActivityConfig(type: ActivityType) {
  return ACTIVITY_CONFIG.find((activity) => activity.type === type);
}
