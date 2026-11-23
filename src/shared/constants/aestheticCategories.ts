import type { Aesthetic } from '../types';

export const aestheticCategories: {
  id: Aesthetic;
  title: string;
  description: string;
  wornBy: string;
  vibe: string;
  color: string;
  hoverColor: string;
  accent: string;
  featured?: boolean;
}[] = [
  {
    id: 'clothes-style',
    title: 'Clothes & Style',
    description: 'Fashionable clothing and style essentials',
    wornBy: 'Fashion enthusiasts and style-conscious individuals',
    vibe: 'Trendy and fashionable',
    color: 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
    hoverColor: 'hover:bg-indigo-200 dark:hover:bg-indigo-500/25',
    accent: 'border-indigo-300 dark:border-indigo-500/30',
  },
  {
    id: 'food-lifestyle' as Aesthetic,
    title: 'Food & Lifestyle',
    description: 'Delicious culinary experiences and lifestyle products',
    wornBy: 'Food lovers and culinary adventurers',
    vibe: 'Gourmet and enjoyable',
    color: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    hoverColor: 'hover:bg-emerald-200 dark:hover:bg-emerald-500/25',
    accent: 'border-emerald-300 dark:border-emerald-500/30',
  },
  {
    id: 'home-living',
    title: 'Home & Living',
    description: 'Cozy and modern home decor and accessories',
    wornBy: 'Homeowners and design enthusiasts',
    vibe: 'Cozy and elegant',
    color: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300',
    hoverColor: 'hover:bg-amber-200 dark:hover:bg-amber-500/25',
    accent: 'border-amber-300 dark:border-amber-500/30',
  },
  {
    id: 'tech-gadgets' as Aesthetic,
    title: 'Tech & Gadgets',
    description: 'Innovative technology and cool gadgets',
    wornBy: 'Tech enthusiasts and early adopters',
    vibe: 'Sleek and innovative',
    color: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300',
    hoverColor: 'hover:bg-blue-200 dark:hover:bg-blue-500/25',
    accent: 'border-blue-300 dark:border-blue-500/30',
  },
  {
    id: 'outdoor-adventure' as Aesthetic,
    title: 'Outdoor & Adventure',
    description: 'Gear and apparel for outdoor exploration',
    wornBy: 'Hikers, campers, and adventurers',
    vibe: 'Rugged and adventurous',
    color: 'bg-lime-100 dark:bg-lime-500/15 text-lime-700 dark:text-lime-300',
    hoverColor: 'hover:bg-lime-200 dark:hover:bg-lime-500/25',
    accent: 'border-lime-300 dark:border-lime-500/30',
  },
  {
    id: 'beauty-wellness' as Aesthetic,
    title: 'Beauty & Wellness',
    description: 'Self-care products and wellness essentials',
    wornBy: 'Beauty and wellness enthusiasts',
    vibe: 'Relaxing and refreshing',
    color: 'bg-pink-100 dark:bg-pink-500/15 text-pink-700 dark:text-pink-300',
    hoverColor: 'hover:bg-pink-200 dark:hover:bg-pink-500/25',
    accent: 'border-pink-300 dark:border-pink-500/30',
  }
];


