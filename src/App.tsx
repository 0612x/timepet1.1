/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useStore } from './store/useStore';
import { BottomNav } from './components/BottomNav';
import { HomeView } from './views/HomeView';
import { FeedView } from './views/FeedView';
import { SceneView } from './views/SceneView';
import { PokedexView } from './views/PokedexView';
import { StatsView } from './views/StatsView';
import { cn } from './utils/cn';

export default function App() {
  const { currentTab } = useStore();

  return (
    <div className="min-h-screen w-full flex justify-center bg-gray-100">
      <div className="w-full max-w-[48rem] h-screen relative flex flex-col overflow-hidden bg-slate-50 text-slate-900 font-sans shadow-2xl">
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
