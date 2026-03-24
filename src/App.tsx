/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {useEffect, useMemo, useRef, useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import { useStore } from './store/useStore';
import { BottomNav } from './components/BottomNav';
import { HomeView } from './views/HomeView';
import { FeedView } from './views/FeedView';
import { SceneView } from './views/SceneView';
import { PokedexView } from './views/PokedexView';
import { StatsView } from './views/StatsView';
import { cn } from './utils/cn';
import {Award, Coins} from 'lucide-react';
import {
  ACHIEVEMENT_CATEGORY_META,
  AchievementIcon,
  buildAchievementCatalog,
  type AchievementItem,
} from './data/achievements';

export default function App() {
  const {
    currentTab,
    coins,
    unlockedPets,
    completedPets,
    allocations,
    simulatedDateOffset,
    facilityInventory,
    foodInventory,
    planTemplates,
  } = useStore();
  const previousCoinsRef = useRef(coins);
  const previousUnlockedAchievementIdsRef = useRef<Set<string> | null>(null);
  const [coinDelta, setCoinDelta] = useState<number | null>(null);
  const [achievementQueue, setAchievementQueue] = useState<AchievementItem[]>([]);
  const [activeAchievement, setActiveAchievement] = useState<AchievementItem | null>(null);

  const achievements = useMemo(
    () => buildAchievementCatalog({
      unlockedPets,
      completedPets,
      allocations,
      simulatedDateOffset,
      facilityInventory,
      foodInventory,
      planTemplateCount: planTemplates.length,
    }),
    [
      allocations,
      completedPets,
      facilityInventory,
      foodInventory,
      planTemplates.length,
      simulatedDateOffset,
      unlockedPets,
    ],
  );

  useEffect(() => {
    const delta = coins - previousCoinsRef.current;
    previousCoinsRef.current = coins;
    if (delta <= 0) return;
    setCoinDelta(delta);
    const timer = window.setTimeout(() => setCoinDelta(null), 1800);
    return () => window.clearTimeout(timer);
  }, [coins]);

  useEffect(() => {
    const currentUnlocked = achievements.filter((item) => item.unlocked);
    const currentUnlockedIds = new Set(currentUnlocked.map((item) => item.id));

    if (previousUnlockedAchievementIdsRef.current === null) {
      previousUnlockedAchievementIdsRef.current = currentUnlockedIds;
      return;
    }

    const previousUnlockedIds = previousUnlockedAchievementIdsRef.current;
    const nextUnlocked = currentUnlocked.filter((item) => !previousUnlockedIds.has(item.id));
    previousUnlockedAchievementIdsRef.current = currentUnlockedIds;

    if (nextUnlocked.length === 0) return;

    setAchievementQueue((previous) => {
      const existingIds = new Set([
        ...previous.map((item) => item.id),
        ...(activeAchievement ? [activeAchievement.id] : []),
      ]);
      const merged = [...previous];
      nextUnlocked.forEach((item) => {
        if (existingIds.has(item.id)) return;
        existingIds.add(item.id);
        merged.push(item);
      });
      return merged;
    });
  }, [achievements, activeAchievement]);

  useEffect(() => {
    if (activeAchievement || achievementQueue.length === 0) return;
    const [nextAchievement, ...rest] = achievementQueue;
    setActiveAchievement(nextAchievement);
    setAchievementQueue(rest);
  }, [achievementQueue, activeAchievement]);

  useEffect(() => {
    if (!activeAchievement) return;
    const timer = window.setTimeout(() => {
      setActiveAchievement(null);
    }, 2800);
    return () => window.clearTimeout(timer);
  }, [activeAchievement]);

  return (
    <div className="min-h-screen w-full flex justify-center bg-gray-100">
      <div className="w-full max-w-[48rem] h-screen relative flex flex-col overflow-hidden bg-slate-50 text-slate-900 font-sans shadow-2xl">
        <div
          className="pointer-events-none absolute inset-x-0 z-[13060] flex justify-center px-4"
          style={{top: 'calc(env(safe-area-inset-top) + 10px)'}}>
          <AnimatePresence mode="wait">
            {activeAchievement ? (
              <motion.div
                key={activeAchievement.id}
                initial={{opacity: 0, y: -18, scale: 0.96}}
                animate={{opacity: 1, y: 0, scale: 1}}
                exit={{opacity: 0, y: -14, scale: 0.98}}
                transition={{duration: 0.24, ease: 'easeOut'}}
                className="w-full max-w-[360px]">
                <div className="overflow-hidden rounded-[22px] border border-emerald-200/90 bg-[linear-gradient(180deg,rgba(244,255,249,0.98),rgba(220,252,231,0.96))] shadow-[0_18px_40px_rgba(16,185,129,0.18)] backdrop-blur-md">
                  <div className="flex items-start gap-3 px-4 py-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-emerald-200 bg-white/82 text-emerald-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
                      <AchievementIcon iconKey={activeAchievement.iconKey} size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-700/80">
                        <Award size={11} />
                        <span>成就达成</span>
                      </div>
                      <p className="mt-1 truncate text-[15px] font-black text-slate-800">
                        {activeAchievement.title}
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium leading-4 text-slate-600">
                        {activeAchievement.description}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white/78 px-2 py-1 text-[10px] font-black text-emerald-700">
                      {ACHIEVEMENT_CATEGORY_META[activeAchievement.category].label}
                    </span>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+88px)] z-[13050] flex justify-center px-4">
          <div
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[12px] font-black shadow-[0_14px_30px_rgba(245,158,11,0.22)] backdrop-blur-md transition-all duration-250',
              coinDelta === null ? 'translate-y-3 scale-95 opacity-0' : 'translate-y-0 scale-100 opacity-100',
              'border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.96),rgba(254,243,199,0.92))] text-amber-700',
            )}>
            <Coins size={14} />
            <span>+{coinDelta ?? 0} 金币</span>
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] text-amber-600">
              当前 {coins}
            </span>
          </div>
        </div>

        {/* Main Content Area */}
        {currentTab === 'home' && <HomeView />}
        {currentTab === 'feed' && <FeedView />}
        <div
          className={cn(
            'absolute inset-0 h-full transition-none',
            currentTab === 'scene'
              ? 'z-20 opacity-100 pointer-events-auto'
              : '-z-10 opacity-0 pointer-events-none',
          )}>
          <SceneView />
        </div>
        {currentTab === 'pokedex' && <PokedexView />}
        {currentTab === 'stats' && <StatsView />}

        {/* Bottom Navigation */}
        <BottomNav />
      </div>
    </div>
  );
}
