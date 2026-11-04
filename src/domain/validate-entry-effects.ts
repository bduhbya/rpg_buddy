import type { EntryEffect, Template } from './documents';
import { validateEffectOperation } from './effect-operations';
import type { LocatedDefinition } from './in-memory-definition-catalog';
import { childPointer, DefinitionChecks } from './validation';
import type { ValidationResult } from './validation';

export interface LocatedEntryEffect {
  effect: EntryEffect;
  document: string;
  pointer: string;
}

/**
 * Validate entry snapshots and their effects, then index validated effects by target.
 * Internal calculation helper; the caller must first validate template structure.
 */
export function validateEntryEffects(
  template: Template,
  entries: LocatedDefinition<unknown>,
): ValidationResult<Map<string, LocatedEntryEffect>> {
  const checks = new DefinitionChecks(entries.document);
  const effectsByTarget = new Map<string, LocatedEntryEffect>();
  const ids = new Map<string, string>();
  const targets = new Set(template.modifierTargets);
  if (checks.array(entries.value, '')) {
    for (let index = 0; index < entries.value.length; index++) {
      const entry = entries.value[index];
      const pointer = childPointer('', index);
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
          checks.diagnostics.at(-1)!.related = [{ document: entries.document, pointer: previous }];
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
            'Expected a template-declared derived modifier target.',
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
            document: entries.document,
            pointer: effectPointer,
          });
        }
      }
    }
  }
  return checks.result(effectsByTarget);
}
