export type StoryConnection = {
  targetId: string;                         // ID of the connected story
  label?: string;                           // Optional display label (e.g., "prequel", "parallel")
  type?: "prequel" | "sequel" | "contrast" | "reference" | "parallel" | "inspiredBy";
  direction?: "outbound" | "inbound" | "both"; // Optional, for visual graph logic
};

export type Story = {
  id: string;
  title: string;
  description: string;
  image?: string;
  duration?: number;
  tags?: string[];
  // units: NarrativeUnit[]; // REMOVED: Legacy field
  connections?: StoryConnection[]; // <-- graph edges
};

