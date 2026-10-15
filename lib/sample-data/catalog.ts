import type { SampleCategory, SampleClient } from './types';

// Every name here is invented. Emails use example.com only.

export const CATEGORIES: SampleCategory[] = [
  { key: 'client-payments', kind: 'income', name: 'Client payments' },
  { key: 'workshops', kind: 'income', name: 'Workshops' },
  { key: 'interest', kind: 'income', name: 'Interest' },
  { key: 'payroll', kind: 'expense', name: 'Payroll' },
  { key: 'rent', kind: 'expense', name: 'Rent' },
  { key: 'software', kind: 'expense', name: 'Software' },
  { key: 'insurance', kind: 'expense', name: 'Insurance' },
  { key: 'utilities', kind: 'expense', name: 'Utilities' },
  { key: 'contractors', kind: 'expense', name: 'Contractors' },
  { key: 'marketing', kind: 'expense', name: 'Marketing' },
  { key: 'equipment', kind: 'expense', name: 'Equipment' },
  { key: 'travel-fees', kind: 'expense', name: 'Travel and fees' },
];

const CLIENT_NAMES = [
  'Northwind Cafe', 'Lakeside Dental', 'Grove Fitness', 'Harbor Books', 'Maple Street Bakery',
  'Pinecrest Realty', 'Riverbend Vet Clinic', 'Sunset Yoga Studio', 'Copperleaf Brewing', 'Bluebird Florist',
  'Oakridge Law Office', 'Elm City Plumbing', 'Brightside Pediatrics', 'Cedar Hill Hotel',
];

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export const CLIENTS: SampleClient[] = CLIENT_NAMES.map((name) => ({
  key: slug(name),
  name,
  email: `billing.${slug(name)}@example.com`,
}));

export const SERVICES = [
  'Brand strategy', 'Logo and identity design', 'Website design', 'Website maintenance', 'Social media management',
  'Photography session', 'Ad campaign setup', 'Copywriting', 'Print design', 'Email newsletter design',
] as const;

export const SOFTWARE = [
  { vendor: 'Pixelboard', day: 3, cents: 32_000, note: 'Design suite, team plan' },
  { vendor: 'LedgerLeaf', day: 5, cents: 6_000, note: 'Accounting software' },
  { vendor: 'Cloudnest', day: 8, cents: 4_500, note: 'File storage' },
  { vendor: 'Taskgrove', day: 12, cents: 9_000, note: 'Project management' },
  { vendor: 'Meetloop', day: 15, cents: 7_500, note: 'Video calls' },
  { vendor: 'Fontshelf', day: 20, cents: 9_000, note: 'Font library' },
] as const;

export const CONTRACTORS = [
  'Alex Rivera, freelance developer', 'Sam Okafor, copywriter', 'Jordan Lee, photographer', 'Priya Nair, motion designer',
] as const;

export const MARKETING = [
  { vendor: 'Adwave', note: 'Social ads' },
  { vendor: 'Inkhouse Printing', note: 'Brochures and cards' },
  { vendor: 'Downtown Business Expo', note: 'Event booth' },
] as const;

export const TRAVEL = [
  { vendor: 'Coastline Rail', note: 'Client visit' },
  { vendor: 'Corner Table Bistro', note: 'Client lunch' },
  { vendor: 'Skyport Parking', note: 'Airport parking' },
] as const;

export const EQUIPMENT_NOTES = ['Laptop', 'Monitor', 'Camera lens', 'Studio lights'] as const;

export const WORKSHOP_PAYERS = ['Northfield Public Library', 'Downtown Business Association'] as const;
