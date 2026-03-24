import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {AnimatePresence, motion} from 'motion/react';
import {Coins, Package2, Sparkles, Store, Wheat, X} from 'lucide-react';
import {type FoodId, type FoodInventory, FOOD_ITEMS} from '../data/foods';
import {type EggInventory, EGG_TIERS, getEggTierQualityEntries, type EggTierId} from '../data/eggs';
import {FACILITY_ITEMS, type FacilityId, type FacilityInventory} from '../data/facilities';
import {getEggSpriteOffsetY, getEggSpriteScale} from '../data/eggSprites';
import {getSceneUiAssetPath} from '../data/sceneUiAssets';
import {FoodSprite} from './FoodSprite';
import {EggActor} from './EggActor';
import {BroomActor} from './BroomActor';
import {UiTextureLayer} from './UiTextureLayer';
import {cn} from '../utils/cn';
import {getPetQualityBadgeClass} from '../utils/petQuality';

type ShopTab = 'food' | 'facility' | 'egg';

const SHOP_PANEL_WIDTH = 360;
const SHOP_PANEL_SAFE_GAP = 10;
const FLOATING_PANEL_ASSET_PATH = getSceneUiAssetPath('floatingPanel');
const SHOP_BUTTON_ASSET_PATH = getSceneUiAssetPath('shopButton');

interface FloatingPanelAnchor {
  x: number;
  y: number;
}

interface SceneShopSheetProps {
  open: boolean;
  anchor?: FloatingPanelAnchor | null;
  coins: number;
  selectedFoodId: FoodId;
  foodInventory: FoodInventory;
  eggInventory: EggInventory;
  facilityInventory: FacilityInventory;
  onBuyFood: (foodId: FoodId, quantity: number) => boolean;
  onBuyEgg: (tierId: EggTierId, quantity?: number) => boolean;
  onBuyFacility: (facilityId: FacilityId) => boolean;
  onStartFacilityPlacement?: (facilityId: FacilityId) => void;
  onInteract?: () => void;
  onClose: () => void;
}

type ShopPanelLayout =
  | {
    mode: 'sheet';
    width: number;
    maxHeight: number;
  }
  | {
    mode: 'floating';
    left: number;
    bottom: number;
    width: number;
    maxHeight: number;
  };

const SHOP_TABS: Array<{id: ShopTab; label: string}> = [
  {id: 'food', label: '食物'},
  {id: 'facility', label: '设施'},
  {id: 'egg', label: '蛋'},
];

function formatEggDayLabel(totalHours: number) {
  const days = totalHours / 24;
  if (Number.isInteger(days)) return `${days} 天`;
  return `${days.toFixed(1)} 天`;
}

export function SceneShopSheet({
  open,
  anchor,
  coins,
  selectedFoodId,
  foodInventory,
  eggInventory,
  facilityInventory,
  onBuyFood,
  onBuyEgg,
  onBuyFacility,
  onStartFacilityPlacement,
  onInteract,
  onClose,
}: SceneShopSheetProps) {
  const [activeTab, setActiveTab] = useState<ShopTab>('food');
  const [feedback, setFeedback] = useState<string | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const totalFoodStock = useMemo(
    () => FOOD_ITEMS.reduce((sum, item) => sum + (foodInventory[item.id] ?? 0), 0),
    [foodInventory],
  );
  const totalEggStock = useMemo(
    () => EGG_TIERS.reduce((sum, item) => sum + (eggInventory[item.id] ?? 0), 0),
    [eggInventory],
  );
  const totalFacilityOwned = useMemo(
    () => FACILITY_ITEMS.reduce((sum, item) => sum + Math.min(1, facilityInventory[item.id] ?? 0), 0),
    [facilityInventory],
  );

  const panelLayout = useMemo<ShopPanelLayout | null>(() => {
    if (typeof window === 'undefined') return null;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (viewportWidth <= 680) {
      return {
        mode: 'sheet',
        width: Math.min(420, viewportWidth - 24),
        maxHeight: Math.min(Math.max(viewportHeight * 0.78, 380), viewportHeight - 14),
      };
    }

    if (!anchor) return null;
    const width = Math.min(SHOP_PANEL_WIDTH, viewportWidth - SHOP_PANEL_SAFE_GAP * 2);
    const left = Math.min(
      Math.max(anchor.x, SHOP_PANEL_SAFE_GAP),
      viewportWidth - width - SHOP_PANEL_SAFE_GAP,
    );
    const bottom = Math.max(86, viewportHeight - anchor.y + 16);
    const maxHeight = Math.max(
      300,
      Math.min(470, viewportHeight - bottom - SHOP_PANEL_SAFE_GAP * 2),
    );

    return {
      mode: 'floating',
      left,
      bottom,
      width,
      maxHeight,
    };
  }, [anchor]);

  const pushFeedback = useCallback((nextFeedback: string) => {
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    setFeedback(nextFeedback);
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedback(null);
      feedbackTimerRef.current = null;
    }, 1400);
  }, []);

  useEffect(() => {
    if (!open) {
      setActiveTab('food');
      setFeedback(null);
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = null;
      }
    }
  }, [open]);

  useEffect(() => () => {
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
    }
  }, []);

  const foodCards = useMemo(() => FOOD_ITEMS.map((food) => {
    const stock = foodInventory[food.id] ?? 0;
    const isSelected = food.id === selectedFoodId;
    const buyOneDisabled = coins < food.price;
    const buyFiveDisabled = coins < food.price * 5;

    return (
      <section
        key={food.id}
        className={cn(
          'rounded-[20px] border-[2px] px-3.5 py-3.5 shadow-[0_3px_0_#d6b17a,0_12px_18px_rgba(84,57,28,0.12)] transition-colors',
          isSelected
            ? 'border-[#8a6137] bg-[linear-gradient(180deg,#fff8de,#f5e2b1)]'
            : 'border-[#b78e5f] bg-[linear-gradient(180deg,#fff7df,#f1ddb6)]',
        )}>
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] border-[2px] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]',
              isSelected
                ? 'border-[#d8b57c] bg-[#fffaf0]'
                : 'border-[#d7bc8c] bg-[#fff8e8]',
            )}>
            <FoodSprite foodId={food.id} size={24} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[14px] font-black text-[#5c4023]">{food.label}</p>
                  {isSelected && (
                    <span className="rounded-[999px] border border-[#d4a14a] bg-[#ffe5a9] px-2 py-0.5 text-[9px] font-black text-[#8c5711] shadow-[0_2px_0_#eacb7d]">
                      当前选择
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] font-medium text-[#8d6b43]">恢复 {food.satietyGain} 点饱食度</p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#9a7548]">价格</p>
                <div className="mt-1 inline-flex items-center gap-1.5 rounded-[8px] border border-[#d8bf8d] bg-[#fbf2d8] px-2.5 py-1 text-[12px] font-black text-[#6b5230]">
                  <Coins size={11} className="text-[#b6893a]" />
                  <span>{food.price}</span>
                  <span className="text-[10px] font-semibold text-[#9a7548]">金币</span>
                </div>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] border border-[#d9bf8f] bg-[#fff8e8] px-2.5 py-1 text-[10px] font-semibold text-[#7a5f39]">
                <Package2 size={11} className="text-[#a58961]" />
                <span>库存 {stock}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={buyOneDisabled}
                  onClick={() => {
                    const bought = onBuyFood(food.id, 1);
                    pushFeedback(bought ? `${food.label} +1` : '金币不够啦');
                  }}
                  className={cn(
                    'inline-flex h-8 min-w-[60px] items-center justify-center rounded-[8px] border-[2px] px-3 text-[11px] font-black transition-all active:translate-y-px',
                    buyOneDisabled
                      ? 'cursor-not-allowed border-[#d7c39a] bg-[#ebe0c2] text-[#b49b75] shadow-none'
                      : 'border-[#a36b1e] bg-[linear-gradient(180deg,#ffd968,#f2ae2b)] text-[#654008] shadow-[0_2px_0_#cb8918,inset_0_1px_0_rgba(255,255,255,0.22)] hover:brightness-105 active:shadow-[0_1px_0_#cb8918,inset_0_1px_0_rgba(255,255,255,0.1)]',
                  )}>
                  买 1
                </button>
                <button
                  type="button"
                  disabled={buyFiveDisabled}
                  onClick={() => {
                    const bought = onBuyFood(food.id, 5);
                    pushFeedback(bought ? `${food.label} +5` : '金币不够啦');
                  }}
                  className={cn(
                    'inline-flex h-8 min-w-[60px] items-center justify-center rounded-[8px] border-[2px] px-3 text-[11px] font-black transition-all active:translate-y-px',
                    buyFiveDisabled
                      ? 'cursor-not-allowed border-[#d7c39a] bg-[#ebe0c2] text-[#b49b75] shadow-none'
                      : 'border-[#a36b1e] bg-[linear-gradient(180deg,#ffd968,#f2ae2b)] text-[#654008] shadow-[0_2px_0_#cb8918,inset_0_1px_0_rgba(255,255,255,0.24)] hover:brightness-105 active:shadow-[0_1px_0_#cb8918,inset_0_1px_0_rgba(255,255,255,0.1)]',
                  )}>
                  买 5
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }), [coins, foodInventory, onBuyFood, pushFeedback, selectedFoodId]);
  const eggCards = useMemo(() => EGG_TIERS.map((tier) => {
    const stock = eggInventory[tier.id] ?? 0;
    const buyOneDisabled = coins < tier.price;
    const buyTwoDisabled = coins < tier.price * 2;
    const qualityEntries = getEggTierQualityEntries(tier.id);

    return (
      <section
        key={tier.id}
        className="rounded-[20px] border-[2px] border-[#b78e5f] bg-[linear-gradient(180deg,#fff7df,#f1ddb6)] px-3.5 py-3.5 shadow-[0_3px_0_#d6b17a,0_12px_18px_rgba(84,57,28,0.12)] transition-colors">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[14px] border-[2px] border-[#d7bc8c] bg-[#fff8e8] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
            <div
              style={{
                transform: `translateY(${getEggSpriteOffsetY(tier.id, 'library')}px)`,
              }}>
              <EggActor
                tierId={tier.id}
                animation="static"
                scale={getEggSpriteScale(tier.id, 'library', 'static')}
                ariaLabel={tier.label}
              />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate text-[14px] font-black text-[#5c4023]">{tier.label}</p>
                  <span className="rounded-[999px] border border-[#d4a14a] bg-[#fff1c8] px-2 py-0.5 text-[9px] font-black text-[#8c5711] shadow-[0_2px_0_#ecd59b]">
                    {tier.totalHours}h
                  </span>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#9a7548]">价格</p>
                <div className="mt-1 inline-flex items-center gap-1.5 rounded-[8px] border border-[#d8bf8d] bg-[#fbf2d8] px-2.5 py-1 text-[12px] font-black text-[#6b5230]">
                  <Coins size={11} className="text-[#b6893a]" />
                  <span>{tier.price}</span>
                  <span className="text-[10px] font-semibold text-[#9a7548]">金币</span>
                </div>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {qualityEntries.map((entry) => (
                <div
                  key={`${tier.id}-${entry.quality}`}
                  className={cn(
                    'rounded-[9px] border px-1 py-[3px] text-center',
                    getPetQualityBadgeClass(entry.quality),
                  )}>
                  <p className="text-[8px] font-black leading-none">{entry.label}</p>
                  <p className="mt-0.5 text-[11px] font-black leading-none">{entry.chance}%</p>
                </div>
              ))}
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] border border-[#d9bf8f] bg-[#fff8e8] px-2.5 py-1 text-[10px] font-semibold text-[#7a5f39]">
                <Package2 size={11} className="text-[#a58961]" />
                <span>库存 {stock}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={buyOneDisabled}
                  onClick={() => {
                    const bought = onBuyEgg(tier.id, 1);
                    pushFeedback(bought ? `${tier.label} +1` : '金币不够啦');
                  }}
                  className={cn(
                    'inline-flex h-8 min-w-[60px] items-center justify-center rounded-[8px] border-[2px] px-3 text-[11px] font-black transition-all active:translate-y-px',
                    buyOneDisabled
                      ? 'cursor-not-allowed border-[#d7c39a] bg-[#ebe0c2] text-[#b49b75] shadow-none'
                      : 'border-[#a36b1e] bg-[linear-gradient(180deg,#ffd968,#f2ae2b)] text-[#654008] shadow-[0_2px_0_#cb8918,inset_0_1px_0_rgba(255,255,255,0.22)] hover:brightness-105 active:shadow-[0_1px_0_#cb8918,inset_0_1px_0_rgba(255,255,255,0.1)]',
                  )}>
                  买 1
                </button>
                <button
                  type="button"
                  disabled={buyTwoDisabled}
                  onClick={() => {
                    const bought = onBuyEgg(tier.id, 2);
                    pushFeedback(bought ? `${tier.label} +2` : '金币不够啦');
                  }}
                  className={cn(
                    'inline-flex h-8 min-w-[60px] items-center justify-center rounded-[8px] border-[2px] px-3 text-[11px] font-black transition-all active:translate-y-px',
                    buyTwoDisabled
                      ? 'cursor-not-allowed border-[#d7c39a] bg-[#ebe0c2] text-[#b49b75] shadow-none'
                      : 'border-[#a36b1e] bg-[linear-gradient(180deg,#ffd968,#f2ae2b)] text-[#654008] shadow-[0_2px_0_#cb8918,inset_0_1px_0_rgba(255,255,255,0.24)] hover:brightness-105 active:shadow-[0_1px_0_#cb8918,inset_0_1px_0_rgba(255,255,255,0.1)]',
                  )}>
                  买 2
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }), [coins, eggInventory, onBuyEgg, pushFeedback]);
  const facilityCards = useMemo(() => FACILITY_ITEMS.map((facility) => {
    const owned = (facilityInventory[facility.id] ?? 0) > 0;
    const buyDisabled = owned || coins < facility.price;

    return (
      <section
        key={facility.id}
        className={cn(
          'rounded-[20px] border-[2px] px-3.5 py-3.5 shadow-[0_3px_0_#d6b17a,0_12px_18px_rgba(84,57,28,0.12)] transition-colors',
          owned
            ? 'border-[#8a6137] bg-[linear-gradient(180deg,#fff8de,#f5e2b1)]'
            : 'border-[#b78e5f] bg-[linear-gradient(180deg,#fff7df,#f1ddb6)]',
        )}>
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[14px] border-[2px] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]',
              owned
                ? 'border-[#d8b57c] bg-[#fffaf0]'
                : 'border-[#d7bc8c] bg-[#fff8e8]',
            )}>
            <BroomActor action="static" scale={0.3} ariaLabel={facility.label} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[14px] font-black text-[#5c4023]">{facility.label}</p>
                  {owned && (
                    <span className="shrink-0 whitespace-nowrap rounded-[999px] border border-[#6cbf8f] bg-[#dff8e7] px-2 py-0.5 text-[9px] font-black text-[#24724a] shadow-[0_2px_0_#bde5ca]">
                      已拥有
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] font-medium leading-4 text-[#8d6b43]">{facility.description}</p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#9a7548]">价格</p>
                <div className="mt-1 inline-flex items-center gap-1.5 rounded-[8px] border border-[#d8bf8d] bg-[#fbf2d8] px-2.5 py-1 text-[12px] font-black text-[#6b5230]">
                  <Coins size={11} className="text-[#b6893a]" />
                  <span>{facility.price}</span>
                  <span className="text-[10px] font-semibold text-[#9a7548]">金币</span>
                </div>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] border border-[#d9bf8f] bg-[#fff8e8] px-2.5 py-1 text-[10px] font-semibold text-[#7a5f39]">
                <Package2 size={11} className="text-[#a58961]" />
                <span>{owned ? '已解锁' : '未拥有'}</span>
              </div>

              {owned ? (
                <button
                  type="button"
                  onClick={() => {
                    onStartFacilityPlacement?.(facility.id);
                    pushFeedback('点场景设置扫把家');
                  }}
                  className="inline-flex h-8 min-w-[76px] items-center justify-center rounded-[8px] border-[2px] border-[#2d8a57] bg-[linear-gradient(180deg,#c7f2d9,#84ddaa)] px-3 text-[11px] font-black text-[#14532d] shadow-[0_2px_0_#5cb884,inset_0_1px_0_rgba(255,255,255,0.28)] transition-all active:translate-y-px">
                  摆位置
                </button>
              ) : (
                <button
                  type="button"
                  disabled={buyDisabled}
                  onClick={() => {
                    const bought = onBuyFacility(facility.id);
                    pushFeedback(
                      bought
                        ? `${facility.label} 已入驻`
                        : '金币不够啦',
                    );
                  }}
                  className={cn(
                    'inline-flex h-8 min-w-[76px] items-center justify-center rounded-[8px] border-[2px] px-3 text-[11px] font-black transition-all active:translate-y-px',
                    buyDisabled
                      ? 'cursor-not-allowed border-[#d7c39a] bg-[#ebe0c2] text-[#b49b75] shadow-none'
                      : 'border-[#a36b1e] bg-[linear-gradient(180deg,#ffd968,#f2ae2b)] text-[#654008] shadow-[0_2px_0_#cb8918,inset_0_1px_0_rgba(255,255,255,0.24)] hover:brightness-105 active:shadow-[0_1px_0_#cb8918,inset_0_1px_0_rgba(255,255,255,0.1)]',
                  )}>
                  购买
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }), [coins, facilityInventory, onBuyFacility, onStartFacilityPlacement, pushFeedback]);

  const panelContent = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-[14px] border-[2px] border-[#a36d33] bg-[linear-gradient(180deg,#ffd68a,#f2b347)] text-[#6e450f] shadow-[0_2px_0_#d18d2c,0_8px_16px_rgba(117,73,27,0.18)]">
              <UiTextureLayer path={SHOP_BUTTON_ASSET_PATH} className="rounded-[inherit]" opacity={0.18} />
              <Store size={16} className="relative z-[1]" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#a07a4b]">Farm Shop</p>
              <h3 className="truncate text-[16px] font-black text-[#5d4022]">农场补给铺</h3>
              <p className="mt-0.5 text-[11px] font-medium text-[#8b6b43]">补食物、囤蛋，再去照料农场的小家伙们。</p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="rounded-[14px] border-[2px] border-[#8b6030] bg-[linear-gradient(180deg,#f8dc8c,#e6b34f)] px-3 py-1.5 shadow-[0_2px_0_#bb7e29,0_8px_16px_rgba(117,73,27,0.16)]">
            <div className="flex items-center gap-1.5 text-[13px] font-black text-[#5f3a09]">
              <Coins size={13} className="text-[#8b5700]" />
              <span>{coins}</span>
              <span className="text-[10px] font-semibold text-[#8f652d]">金币</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border-[2px] border-[#b89161] bg-[#fff8e7] text-[#8b6941] shadow-[0_2px_0_#e2c89a] transition-colors hover:text-[#5c4023]">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="inline-flex rounded-[12px] border-[2px] border-[#af8455] bg-[#e8cf9f] p-1 shadow-[0_2px_0_#c79761]">
          {SHOP_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'h-8 rounded-[8px] px-3 text-[11px] font-black transition-all',
                activeTab === tab.id
                  ? 'border border-[#e0c48d] bg-[#fff8e7] text-[#5b4124] shadow-[0_2px_0_#ecd9b5]'
                  : 'text-[#8b6941] hover:text-[#5b4124]',
              )}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="rounded-[10px] border border-[#d5bd8d] bg-[#fff8e7] px-2.5 py-1 text-[10px] font-semibold text-[#7a5f39] shadow-[0_2px_8px_rgba(84,57,28,0.05)]">
          <span className="inline-flex items-center gap-1">
            <Package2 size={11} className="text-[#a68a5d]" />
            {activeTab === 'food'
              ? `总库存 ${totalFoodStock}`
              : activeTab === 'egg'
                ? `蛋库 ${totalEggStock}`
                : `已拥有 ${totalFacilityOwned}`}
          </span>
        </div>
      </div>

      <div className="mt-3 min-h-[44px]">
        <div
          className={cn(
            'rounded-[14px] border-[2px] px-3 py-2 text-[11px] font-black transition-colors duration-150',
            feedback
              ? 'border-[#d4a14a] bg-[linear-gradient(180deg,#ffe9b6,#ffd98b)] text-[#8b5610] shadow-[0_2px_0_#e8c06c,0_8px_14px_rgba(117,73,27,0.08)]'
              : 'border-[#d7bf91] bg-[linear-gradient(180deg,#fbf1d7,#f2e1b9)] text-[#a2855b] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]',
          )}>
          <div className={cn('flex items-center gap-1.5', feedback ? '' : 'justify-center')}>
            <Sparkles size={12} className={feedback ? '' : 'opacity-45'} />
            {feedback ? <span>{feedback}</span> : null}
          </div>
        </div>
      </div>

      {activeTab === 'food' ? (
        <div className="pr-1">
          <div className="space-y-2.5">{foodCards}</div>
        </div>
      ) : activeTab === 'egg' ? (
        <div className="pr-1">
          <div className="space-y-2.5">{eggCards}</div>
        </div>
      ) : activeTab === 'facility' ? (
        <div className="pr-1">
          <div className="space-y-2.5">{facilityCards}</div>
        </div>
      ) : (
        <div className="mt-3 rounded-[22px] border border-dashed border-slate-200 bg-white/88 px-4 py-7 text-center shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-[18px] bg-slate-100 text-slate-400">
            {activeTab === 'facility' ? <Store size={16} /> : <Wheat size={16} />}
          </div>
          <p className="mt-3 text-sm font-black text-slate-700">即将开放</p>
          <p className="mt-1 text-[11px] font-medium leading-5 text-slate-400">
            {activeTab === 'facility'
              ? '后面会接扫把、装饰和自动化设施。'
              : '后面会继续扩充更多特殊蛋与稀有池。'}
          </p>
        </div>
      )}
    </>
  );

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && panelLayout ? (
        <div className="fixed inset-0 z-[12500]" onClick={onClose}>
          <motion.div
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            transition={{duration: 0.14, ease: 'easeOut'}}
            className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,240,190,0.12),transparent_30%),linear-gradient(180deg,rgba(36,24,12,0.14),rgba(36,24,12,0.26))]"
          />

          {panelLayout.mode === 'sheet' ? (
            <div
              className="absolute inset-0 flex items-end justify-center p-3"
              style={{paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)'}}>
              <motion.div
                initial={{y: 28, opacity: 0}}
                animate={{y: 0, opacity: 1}}
                exit={{y: 28, opacity: 0}}
                transition={{duration: 0.18, ease: 'easeOut'}}
                className="pointer-events-auto w-full overflow-hidden rounded-[28px] border-[2px] border-[#6f4a29] bg-[linear-gradient(180deg,#b87a47,#8b5b34)] shadow-[0_18px_36px_rgba(73,47,22,0.34)]"
                style={{
                  maxWidth: panelLayout.width,
                  height: panelLayout.maxHeight,
                }}
                onClick={(event) => event.stopPropagation()}>
                <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
                  <UiTextureLayer path={FLOATING_PANEL_ASSET_PATH} className="rounded-[inherit]" opacity={0.14} />
                  <div className="relative z-[1] mx-auto mt-2 h-1.5 w-11 rounded-full bg-[#f3d3a2]/90" />
                  <div
                    className="relative z-[1] m-2 min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-[22px] border border-[#e6cd98] bg-[linear-gradient(180deg,#fbf2d6,#f2dfb4)] px-4 pb-4 pt-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
                    onPointerDownCapture={onInteract}
                    onWheelCapture={onInteract}
                    style={{
                      touchAction: 'pan-y',
                      WebkitOverflowScrolling: 'touch',
                      scrollbarWidth: 'thin',
                    }}>
                    {panelContent}
                  </div>
                </div>
              </motion.div>
            </div>
          ) : (
            <motion.div
              initial={{opacity: 0, y: 10}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: 10}}
              transition={{duration: 0.16, ease: 'easeOut'}}
              className="pointer-events-auto absolute transform-gpu"
              style={{
                left: panelLayout.left,
                bottom: panelLayout.bottom,
                width: panelLayout.width,
                height: panelLayout.maxHeight,
              }}
              onClick={(event) => event.stopPropagation()}>
              <div className="relative h-full overflow-visible">
                <span className="absolute -left-1.5 bottom-5 h-3.5 w-3.5 rotate-45 rounded-[3px] border-l-[2px] border-b-[2px] border-[#6f4a29] bg-[#f1ddb1] shadow-[-3px_3px_8px_rgba(73,47,22,0.12)]" />
                <section className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border-[2px] border-[#6f4a29] bg-[linear-gradient(180deg,#b87a47,#8b5b34)] shadow-[0_18px_36px_rgba(73,47,22,0.28)]">
                  <UiTextureLayer path={FLOATING_PANEL_ASSET_PATH} className="rounded-[inherit]" opacity={0.14} />
                  <div
                    className="relative z-[1] m-2 h-[calc(100%-1rem)] overflow-y-auto rounded-[20px] border border-[#e6cd98] bg-[linear-gradient(180deg,#fbf2d6,#f2dfb4)] px-3.5 pb-3.5 pt-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]"
                    onPointerDownCapture={onInteract}
                    onWheelCapture={onInteract}
                    style={{
                      touchAction: 'pan-y',
                      WebkitOverflowScrolling: 'touch',
                      scrollbarWidth: 'thin',
                    }}>
                    {panelContent}
                  </div>
                </section>
              </div>
            </motion.div>
          )}
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
