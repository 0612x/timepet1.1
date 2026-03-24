export type EggTierId = 'pasture' | 'wonder' | 'myth';

export interface EggTier {
  id: EggTierId;
  label: string;
  shortLabel: string;
  description: string;
  price: number;
  totalHours: number;
  previewHours: number;
  qualityRates: {
    common: number;
    rare: number;
    epic: number;
  };
  speciesKeys: string[];
}

export type EggInventory = Record<EggTierId, number>;

export const EGG_TIERS: EggTier[] = [
  {
    id: 'pasture',
    label: '田园蛋',
    shortLabel: '田园',
    description: '适合日常陪伴，常见农场动物更多。',
    price: 90,
    totalHours: 24,
    previewHours: 8,
    qualityRates: {
      common: 94,
      rare: 5,
      epic: 1,
    },
    speciesKeys: [
      'farm_fox',
      'farm_ferret',
      'farm_frog',
      'farm_deer',
      'farm_bunny',
      'farm_boar',
      'farm_pidgeon',
      'farm_goose',
      'farm_cow',
      'farm_squirrel',
      'farm_littlefox',
      'farm_chicken',
      'farm_goldie',
      'farm_cat',
    ],
  },
  {
    id: 'wonder',
    label: '奇遇蛋',
    shortLabel: '奇遇',
    description: '更少见的森林伙伴和特别访客。',
    price: 190,
    totalHours: 18,
    previewHours: 6,
    qualityRates: {
      common: 89,
      rare: 9,
      epic: 2,
    },
    speciesKeys: [
      'farm_redpanda',
      'farm_wolf',
      'farm_deer1',
      'farm_bear',
      'farm_otter',
      'farm_koala',
      'farm_hedgehog',
      'farm_armadillo',
      'farm_crab',
      'farm_porcupine',
      'farm_vita',
      'farm_miniyellowcat',
      'farm_miniblackwcat',
      'farm_minisiamese',
      'farm_miniTabbycat',
      'farm_miniragdollcat',
      'farm_minicivetcat',
      'farm_littlewhite',
      'farm_littleblue',
      'farm_littlegray',
      'farm_Alaska',
      'farm_Akita',
    ],
  },
  {
    id: 'myth',
    label: '幻兽蛋',
    shortLabel: '幻兽',
    description: '幻想系、机械系与异想伙伴更容易出现。',
    price: 300,
    totalHours: 12,
    previewHours: 4,
    qualityRates: {
      common: 82,
      rare: 15,
      epic: 3,
    },
    speciesKeys: [
      'farm_robotbird',
      'farm_robotsheep',
      'farm_robotfrog',
      'farm_robotpig',
      'farm_phoenixling',
      'farm_slime',
      'farm_minigolem',
      'farm_cobra',
      'farm_iceelemental',
      'farm_imp',
      'farm_burger',
    ],
  },
];

export const EGG_TIER_MAP: Record<EggTierId, EggTier> = EGG_TIERS.reduce((accumulator, item) => {
  accumulator[item.id] = item;
  return accumulator;
}, {} as Record<EggTierId, EggTier>);

export function getEggTierById(tierId: EggTierId) {
  return EGG_TIER_MAP[tierId];
}

export function getEggTierQualityEntries(tierId: EggTierId) {
  const tier = getEggTierById(tierId);
  return [
    {quality: 'common' as const, label: '普通', chance: tier.qualityRates.common},
    {quality: 'rare' as const, label: '优秀', chance: tier.qualityRates.rare},
    {quality: 'epic' as const, label: '完美', chance: tier.qualityRates.epic},
  ];
}

export function createInitialEggInventory(): EggInventory {
  return {
    pasture: 0,
    wonder: 0,
    myth: 0,
  };
}

export function normalizeEggInventory(input?: Partial<Record<EggTierId, number>>): EggInventory {
  const defaults = createInitialEggInventory();
  EGG_TIERS.forEach((tier) => {
    defaults[tier.id] = Math.max(0, Math.floor(input?.[tier.id] ?? defaults[tier.id]));
  });
  return defaults;
}
