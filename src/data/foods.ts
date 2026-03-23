export type FoodId =
  | 'carrot'
  | 'tomato'
  | 'eggplant'
  | 'pumpkin'
  | 'grape'
  | 'apple'
  | 'banana'
  | 'cherry';

export interface FoodItem {
  id: FoodId;
  label: string;
  satietyGain: number;
  price: number;
  fallbackEmoji: string;
  imagePaths: string[];
}

export type FoodInventory = Record<FoodId, number>;
const FOOD_ASSET_VERSION = 'farm-scene-v1';

function createFoodImagePaths(id: FoodId) {
  const farmName = `farm_food_${id}`;
  const withVersion = (path: string) => `${path}?v=${FOOD_ASSET_VERSION}`;
  return [
    withVersion(`/images/scenes/farm/${farmName}.png`),
    withVersion(`/images/ui/scene/${farmName}.png`),
    withVersion(`/images/ui/${farmName}.png`),
    withVersion(`/images/shop/foods/${farmName}.png`),
    withVersion(`/images/foods/${farmName}.png`),
    withVersion(`/images/shop/foods/${id}.png`),
    withVersion(`/images/foods/${id}.png`),
  ];
}

export const FOOD_ITEMS: FoodItem[] = [
  {
    id: 'carrot',
    label: '胡萝卜',
    satietyGain: 5,
    price: 6,
    fallbackEmoji: '🥕',
    imagePaths: createFoodImagePaths('carrot'),
  },
  {
    id: 'tomato',
    label: '西红柿',
    satietyGain: 10,
    price: 11,
    fallbackEmoji: '🍅',
    imagePaths: createFoodImagePaths('tomato'),
  },
  {
    id: 'eggplant',
    label: '茄子',
    satietyGain: 15,
    price: 17,
    fallbackEmoji: '🍆',
    imagePaths: createFoodImagePaths('eggplant'),
  },
  {
    id: 'pumpkin',
    label: '南瓜',
    satietyGain: 20,
    price: 24,
    fallbackEmoji: '🎃',
    imagePaths: createFoodImagePaths('pumpkin'),
  },
  {
    id: 'grape',
    label: '葡萄',
    satietyGain: 25,
    price: 32,
    fallbackEmoji: '🍇',
    imagePaths: createFoodImagePaths('grape'),
  },
  {
    id: 'apple',
    label: '苹果',
    satietyGain: 30,
    price: 41,
    fallbackEmoji: '🍎',
    imagePaths: createFoodImagePaths('apple'),
  },
  {
    id: 'banana',
    label: '香蕉',
    satietyGain: 35,
    price: 51,
    fallbackEmoji: '🍌',
    imagePaths: createFoodImagePaths('banana'),
  },
  {
    id: 'cherry',
    label: '樱桃',
    satietyGain: 40,
    price: 62,
    fallbackEmoji: '🍒',
    imagePaths: createFoodImagePaths('cherry'),
  },
] as const;

export const DEFAULT_FOOD_ID: FoodId = 'carrot';

export const FOOD_ITEM_MAP: Record<FoodId, FoodItem> = FOOD_ITEMS.reduce((accumulator, item) => {
  accumulator[item.id] = item;
  return accumulator;
}, {} as Record<FoodId, FoodItem>);

export function getFoodItemById(foodId: FoodId) {
  return FOOD_ITEM_MAP[foodId];
}

export function createInitialFoodInventory(): FoodInventory {
  return {
    carrot: 6,
    tomato: 2,
    eggplant: 0,
    pumpkin: 0,
    grape: 0,
    apple: 0,
    banana: 0,
    cherry: 0,
  };
}

export function normalizeFoodInventory(input?: Partial<Record<FoodId, number>>): FoodInventory {
  const defaults = createInitialFoodInventory();
  FOOD_ITEMS.forEach((item) => {
    defaults[item.id] = Math.max(0, Math.floor(input?.[item.id] ?? defaults[item.id]));
  });
  return defaults;
}
