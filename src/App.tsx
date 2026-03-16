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

export default function App() {
  const { currentTab } = useStore();

  return (
    <div className="min-h-screen w-full flex justify-center bg-gray-100">
      <div className="w-full max-w-[48rem] h-screen relative flex flex-col overflow-hidden bg-slate-50 text-slate-900 font-sans shadow-2xl">
        {/* Main Content Area */}
        {currentTab === 'home' && <HomeView />}
        {currentTab === 'feed' && <FeedView />}
        {currentTab === 'scene' && <SceneView />}
        {currentTab === 'pokedex' && <PokedexView />}
        {currentTab === 'stats' && <StatsView />}

        {/* Bottom Navigation */}
        <BottomNav />
      </div>
    </div>
  );
}
