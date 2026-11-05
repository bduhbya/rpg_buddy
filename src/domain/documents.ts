import type { DefinitionReference, Metadata } from './common';
import type { Expression } from './expressions';

/**
 * Shapes mirror data_contracts/v1/*.schema.json and data_contracts/contracts.md.
 * These declarations do not validate untrusted JSON, reject extra properties at
 * runtime, or enforce string formats, finite/safe integers or semantic invariants.
 */
export interface SystemManifest {
  schemaVersion: 1;
  id: string;
  version: string;
  label: string;
  source: {
    designation: string;
    isbn: string;
    sha256: string;
  };
  templates: DefinitionReference[];
}

export interface InputField {
  id: string;
  label: string;
  type: 'integer';
  sourceRefs: string[];
  default: number;
  minimum: number;
  maximum: number;
  metadata?: Metadata;
}

export interface DerivedField {
  id: string;
  label: string;
  type: 'number';
  sourceRefs: string[];
  expression: Expression;
  unit?: string;
  metadata?: Metadata;
}

export interface Section {
  id: string;
  label: string;
  fields: string[];
}

export interface Template {
  schemaVersion: 1;
  id: string;
  version: string;
  system: DefinitionReference;
  entityType: string;
  label: string;
  defaultDisplayName: string;
  sections: Section[];
  inputs: InputField[];
  derived: DerivedField[];
  modifierTargets: string[];
  metadata?: Metadata;
}

/** Effect-aware calculation validates factor as a positive safe integer. */
export interface MultiplyEffect {
  op: 'multiply';
  target: string;
  factor: number;
}

/** Extend this union when the versioned contract gains another effect operation. */
export type EntryEffect = MultiplyEffect;

export interface Entry {
  id: string;
  category: string;
  label: string;
  description: string;
  effects: EntryEffect[];
  source?: string;
  metadata?: Metadata;
}

/** Keep the v1 role list in sync with data_contracts/v1/instance.schema.json. */
export const INSTANCE_ROLES = ['character', 'monster'] as const;
export type InstanceRole = (typeof INSTANCE_ROLES)[number];

/** Editable source data only; derived results are not persisted here. */
export interface Instance {
  schemaVersion: 1;
  id: string;
  entityType: string;
  role: InstanceRole;
  system: DefinitionReference;
  template: DefinitionReference;
  displayName: string;
  values: Record<string, number>;
  entries: Entry[];
  createdAt: string;
  modifiedAt: string;
  career?: string;
  metadata?: Metadata;
}
