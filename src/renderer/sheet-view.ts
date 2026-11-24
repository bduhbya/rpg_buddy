import type { Instance } from '../domain/definitions/document-models';

export interface SheetView {
  sheet: Instance;
  readOnlyDetails?: string[];
}

export type ViewSheet = (view: SheetView, trigger: HTMLButtonElement) => void;
