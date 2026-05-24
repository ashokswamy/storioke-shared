// src/lib/types/collection.ts

import type { Story } from './story';

export type Collection = {
  id: string;           // URL slug (e.g., 'wisdom')
  title: string;        // Display name
  image: string;        // Collection cover
  description?: string; // Optional tagline
  stories: Story[];     // Stories belonging to this collection
};
