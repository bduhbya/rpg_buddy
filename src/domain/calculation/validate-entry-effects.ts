import type { EntryEffect, Template } from '../definitions/document-models';
import { validateEffectOperation } from './effect-operations';
import type { LocatedDefinition } from '../definition-processing/in-memory-definition-catalog';
import { childPointer, DefinitionChecks } from '../instances/structural-validation';
import type { ValidationResult } from '../instances/structural-validation';

export interface LocatedEntryEffect {
  effect: EntryEffect;
  document: string;
  pointer: string;
}

/**
 * Validate entry snapshots and index their effects by declared target. Each target accepts at most one effect.
 * @param template Structurally validated template that declares the allowed modifier targets.
 * @param entries Located entry array. The document label and array-relative pointers locate diagnostics.
 * @returns Validated effects indexed by target field ID, or diagnostics.
 */
export function validateEntryEffects(
  template: Template,
  entries: LocatedDefinition<unknown>,
): ValidationResult<Map<string, LocatedEntryEffect>> {
  const checks = new DefinitionChecks(entries.document);
  const effects = checkEntriesAndCollectEffects(
    entries.value,
    '',
    new Set(template.modifierTargets),
    'a template-declared derived modifier target',
    checks,
  );
  return checks.result(effects);
}

/**
 * Validate entry shape and index unique effects against the caller's allowed target set.
 * @param value Parsed entries array.
 * @param entriesPointer Pointer to the array within the diagnostic document.
 * @param targets Allowed target IDs from the template or stored derived fields.
 * @param targetDescription Expected target description for diagnostics.
 * @param checks Call-local collector for entry and effect diagnostics.
 * @returns Effects indexed by target. Use only after confirming there are no diagnostics.
 */
export function checkEntriesAndCollectEffects(
  value: unknown,
  entriesPointer: string,
  targets: ReadonlySet<string>,
  targetDescription: string,
  checks: DefinitionChecks,
): Map<string, LocatedEntryEffect> {
  const effectsByTarget = new Map<string, LocatedEntryEffect>();
  const ids = new Map<string, string>();
  if (checks.array(value, entriesPointer)) {
    for (let index = 0; index < value.length; index++) {
      const entry = value[index];
      const pointer = childPointer(entriesPointer, index);
      if (
        !checks.object(
          entry,
          pointer,
          ['id', 'category', 'label', 'description', 'effects'],
          ['source', 'metadata'],
        )
      )
        continue;
      checks.slug(entry.id, `${pointer}/id`);
      checks.slug(entry.category, `${pointer}/category`);
      checks.text(entry.label, `${pointer}/label`);
      if (typeof entry.description !== 'string')
        checks.issue(`${pointer}/description`, 'Expected a description string (empty is allowed).');
      if (Object.hasOwn(entry, 'source')) checks.text(entry.source, `${pointer}/source`);
      if (Object.hasOwn(entry, 'metadata')) checks.metadata(entry.metadata, `${pointer}/metadata`);
      if (typeof entry.id === 'string') {
        const previous = ids.get(entry.id);
        if (previous !== undefined) {
          checks.issue(`${pointer}/id`, `Entry ID "${entry.id}" is repeated.`, 'DUPLICATE_ID');
          checks.diagnostics.at(-1)!.related = [{ document: checks.document, pointer: previous }];
        } else ids.set(entry.id, `${pointer}/id`);
      }
      if (!checks.array(entry.effects, `${pointer}/effects`)) continue;
      for (let effectIndex = 0; effectIndex < entry.effects.length; effectIndex++) {
        const effectPointer = `${pointer}/effects/${effectIndex}`;
        const effect = validateEffectOperation(entry.effects[effectIndex], effectPointer, checks);
        if (!effect) continue;
        if (typeof effect.target !== 'string' || !targets.has(effect.target)) {
          checks.issue(
            `${effectPointer}/target`,
            `Expected ${targetDescription}.`,
            'INVALID_MODIFIER',
          );
        }
        if (typeof effect.target !== 'string') continue;
        const previous = effectsByTarget.get(effect.target);
        if (previous) {
          checks.issue(
            `${effectPointer}/target`,
            `More than one effect targets "${effect.target}".`,
            'MODIFIER_CONFLICT',
          );
          checks.diagnostics.at(-1)!.related = [
            { document: previous.document, pointer: `${previous.pointer}/target` },
          ];
        } else {
          effectsByTarget.set(effect.target, {
            effect,
            document: checks.document,
            pointer: effectPointer,
          });
        }
      }
    }
  }
  return effectsByTarget;
}
