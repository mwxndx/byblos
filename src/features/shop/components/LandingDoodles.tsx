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

// Seeded PRNG for deterministic icon selection & rotations
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

// Exactly 90 items spread out uniformly across a 9x10 staggered hexagonal grid
const rand = createDeterministicRandom(20261021);
const COLS = 9;
const ROWS = 10; // 9 * 10 = 90 items

const LANDING_DOODLES: DoodleSpec[] = Array.from({ length: COLS * ROWS }, (_, i) => {
  const r = Math.floor(i / COLS);
  const c = i % COLS;

  // Evenly distributed staggered lattice from top (2%) to bottom (98%)
  const xOffset = r % 2 === 0 ? 0.3 : 0.7;
  const x = Number((((c + xOffset) / COLS) * 100).toFixed(1));
  const y = Number((2 + (r / (ROWS - 1)) * 96).toFixed(1));

  const rot = Math.round((rand() - 0.5) * 50); // Balanced subtle doodle tilt (-25deg to +25deg)
  const size = 22; // Uniform balanced glyph size across all screen sizes

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
 * 90 ambient doodles spread out evenly across the landing page background.
 * Opacity is 60%.
 * Pointer-events-none and z-0 ensure all buttons and controls remain interactable above.
 */
export const LandingDoodles: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      data-testid="landing-doodles"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
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
