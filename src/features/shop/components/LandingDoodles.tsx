import React from 'react';
import {
  Laptop,
  DeviceMobile,
  Headphones,
  GameController,
  Camera,
  Watch,
  DeviceTablet,
  Scissors,
  PaintBrush,
  Sparkle,
  Drop,
  Crown,
  Flower,
  MagicWand,
  TShirt,
  Pants,
  Dress,
  Hoodie,
  CoatHanger,
  Sunglasses,
  Tag,
  Bag,
  Tote,
  Sneaker,
  HighHeel,
  Boot,
  Coffee,
  Diamond,
  type Icon,
} from '@phosphor-icons/react';

// Categorized pool of icons representing tech, beauty, clothes, shoes, lifestyle
const DOODLE_ICON_POOL: Icon[] = [
  // Tech
  Laptop,
  DeviceMobile,
  Headphones,
  GameController,
  Camera,
  Watch,
  DeviceTablet,
  // Beauty & Grooming
  Scissors,
  PaintBrush,
  Sparkle,
  Drop,
  Crown,
  Flower,
  MagicWand,
  // Clothes & Accessories
  TShirt,
  Pants,
  Dress,
  Hoodie,
  CoatHanger,
  Sunglasses,
  Tag,
  Bag,
  Tote,
  // Shoes & Footwear
  Sneaker,
  HighHeel,
  Boot,
  // Lifestyle
  Coffee,
  Diamond,
];

// Seeded PRNG for reproducible, non-flashing layout across renders & SSR
function createDeterministicRandom(seed: number) {
  let s = seed;
  return function () {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DoodleSpec {
  id: number;
  IconComponent: Icon;
  x: number;
  y: number;
  rot: number;
  size: number;
}

// Generate exactly 90 evenly scattered doodles across a 9x10 jittered grid
const rand = createDeterministicRandom(20261021);
const COLS = 9;
const ROWS = 10; // 9 * 10 = 90 items

const LANDING_DOODLES: DoodleSpec[] = Array.from({ length: COLS * ROWS }, (_, i) => {
  const r = Math.floor(i / COLS);
  const c = i % COLS;

  const baseX = (c + 0.5) * (100 / COLS);
  const baseY = (r + 0.5) * (100 / ROWS);

  // Organic jitter within each grid cell (+/- 4%)
  const jitterX = (rand() - 0.5) * 8;
  const jitterY = (rand() - 0.5) * 8;

  const x = Math.max(3, Math.min(97, Number((baseX + jitterX).toFixed(1))));
  const y = Math.max(3, Math.min(97, Number((baseY + jitterY).toFixed(1))));
  const rot = Math.round((rand() - 0.5) * 70);
  const size = Math.round(18 + rand() * 14); // 18px to 32px

  const iconIndex = Math.floor(rand() * DOODLE_ICON_POOL.length);
  const IconComponent = DOODLE_ICON_POOL[iconIndex];

  return {
    id: i,
    IconComponent,
    x,
    y,
    rot,
    size,
  };
});

/**
 * 90 ambient doodles peppered across the landing page background.
 * Opacity is strictly 60% per specification.
 * Pointer-events-none and z-0 ensure all buttons and controls remain interactable above.
 */
export const LandingDoodles: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      data-testid="landing-doodles"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none"
    >
      {LANDING_DOODLES.map((doodle) => {
        const { id, IconComponent, x, y, rot, size } = doodle;
        return (
          <div
            key={id}
            data-testid="landing-doodle-item"
            className="absolute text-[var(--byblos-text,#f5f5f5)] opacity-60"
            style={{
              top: `${y}%`,
              left: `${x}%`,
              transform: `translate(-50%, -50%) rotate(${rot}deg)`,
              opacity: 0.6,
            }}
          >
            <IconComponent size={size} weight="regular" />
          </div>
        );
      })}
    </div>
  );
};

export default LandingDoodles;
