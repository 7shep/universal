import type { Identifiable } from '@design-studio/shared';

/** A page-level spatial idea, deliberately independent from rendering technology. */
export interface Composition extends Identifiable {
  name: string;
  intent: string;
  rhythm: 'dense' | 'balanced' | 'spacious';
  sections: readonly CompositionSection[];
}

export interface CompositionSection extends Identifiable {
  kind: SectionKind;
  purpose: string;
  emphasis: 'primary' | 'supporting' | 'quiet';
  slots: readonly ContentSlot[];
}

export type SectionKind = 'hero' | 'narrative' | 'gallery' | 'proof' | 'cta' | 'footer';
export type ContentSlot = 'headline' | 'body' | 'media' | 'actions' | 'metadata' | 'navigation';

/** TODO: Populate from curated, licensed composition definitions—not generated markup. */
export const compositionCatalog: readonly Composition[] = [];
