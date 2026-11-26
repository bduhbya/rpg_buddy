import type { Instance } from '../domain/definitions/document-models';
import type { SheetEditHandle, SheetEditResult } from '../shared/sheet-editing-contract';

export interface SheetView {
  sheet: Instance;
  readOnlyDetails?: string[];
  startEditing?: boolean;
  editHandle?: SheetEditHandle;
  modifierTargets?: string[];
  onEdit?(result: Extract<SheetEditResult, { ok: true }>): void;
}

export type ViewSheet = (view: SheetView, trigger: HTMLButtonElement) => void;
