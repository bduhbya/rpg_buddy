import { useEffect, useRef, useState } from 'react';
import type { SubmitEvent } from 'react';
import { INSTANCE_ROLES } from '../domain/definitions/document-models';
import type { InstanceRole } from '../domain/definitions/document-models';
import type { LibraryView } from '../shared/library-selection';
import type {
  SheetCreationOptions,
  SheetCreationRequest,
  SheetCreationResult,
} from '../shared/sheet-creation-contract';

import type { ViewSheet } from './sheet-view';

const DIACRITICS = /\p{Mark}+/gu;
const ASCII_WORDS = /[a-z0-9]+/g;
const TRAILING_HYPHEN = /-$/;
const DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/;

interface SheetCreationPanelProps {
  activeSystem: NonNullable<LibraryView['activeSystem']>;
  busy: boolean;
  creating: boolean;
  viewSheet: ViewSheet;
  createSheet(request: SheetCreationRequest): Promise<SheetCreationResult | undefined>;
}

// Translate a display name into a portable suggestion where possible.
function suggestId(name: string): string {
  const words = name.normalize('NFKD').replace(DIACRITICS, '').toLowerCase().match(ASCII_WORDS);
  const id = words?.join('-').slice(0, 64).replace(TRAILING_HYPHEN, '') ?? '';
  return DEVICE_NAME.test(id) ? '' : id;
}

/**
 * Display creation controls and the most recent successful snapshot.
 * @param props Active selection, shared action state and the guarded creation callback.
 * @returns The sheet creation form and the action for its latest successful result.
 */
export function SheetCreationPanel({
  activeSystem,
  busy,
  creating,
  createSheet,
  viewSheet,
}: SheetCreationPanelProps) {
  const [options, setOptions] = useState<SheetCreationOptions>();
  const [templateIndex, setTemplateIndex] = useState(0);
  const [role, setRole] = useState<InstanceRole>(INSTANCE_ROLES[0]);
  const [name, setName] = useState('');
  const [manualId, setManualId] = useState<string>();
  const [failure, setFailure] = useState<Extract<SheetCreationResult, { ok: false }>>();
  const [optionsIssue, setOptionsIssue] = useState('');
  const [created, setCreated] = useState<Extract<SheetCreationResult, { ok: true }>>();
  const sheet = created?.sheet;
  const [successMessage, setSuccessMessage] = useState('');
  const form = useRef<HTMLFormElement>(null);
  const viewButton = useRef<HTMLButtonElement>(null);

  // Main invalidates edit handles when the active selection revision changes.
  useEffect(() => {
    setCreated(undefined);
  }, [activeSystem.selectionRevision]);

  // Restore keyboard context after the pending submission temporarily disables the form.
  useEffect(() => {
    if (failure) {
      const targetId =
        failure.field === 'id'
          ? 'creation-id'
          : failure.field === 'displayName'
            ? 'creation-name'
            : 'creation-submit';
      form.current?.querySelector<HTMLElement>('#' + targetId)?.focus();
    }
  }, [failure]);

  // Make the next action clear after a successful creation.
  useEffect(() => {
    if (sheet) viewButton.current?.focus();
  }, [sheet]);

  useEffect(() => {
    let current = true;
    setOptions(undefined);
    setOptionsIssue('');
    setFailure(undefined);
    setSuccessMessage('');
    void window.rpgBuddy.getSheetCreationOptions().then(
      (result) => {
        if (!current) return;
        if (result.ok && result.options?.templates.length) {
          setOptions(result.options);
          setTemplateIndex(0);
        } else {
          setOptionsIssue('No templates are available. Reload the system to try again.');
        }
      },
      () => {
        if (current)
          setOptionsIssue('Template choices are unavailable. Reload the system to try again.');
      },
    );
    return () => {
      current = false;
    };
  }, [activeSystem]);

  const id = manualId ?? suggestId(name);
  const template = options?.templates[templateIndex]?.reference;

  // Submit through the same action gate that protects library and system selection.
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !options || !template) return;
    setFailure(undefined);
    setSuccessMessage('');
    const result = await createSheet({
      selectionRevision: options.selectionRevision,
      template,
      role,
      displayName: name,
      id,
    });
    if (!result) return;
    if (result.ok) {
      setCreated(result);
      setSuccessMessage(`Created ${result.sheet.displayName}.`);
    } else {
      setFailure(result);
    }
  }

  return (
    <section aria-labelledby="sheet-creation-heading">
      <h2 id="sheet-creation-heading">Create a sheet</h2>
      {options && (
        <form ref={form} onSubmit={(event) => void submit(event)}>
          <fieldset disabled={busy}>
            <legend>Sheet details</legend>
            <label htmlFor="creation-template">Template</label>
            <select
              id="creation-template"
              value={templateIndex}
              onChange={(event) => setTemplateIndex(Number(event.currentTarget.value))}
            >
              {options.templates.map(({ reference, label }, index) => (
                <option key={`${reference.id}@${reference.version}`} value={index}>
                  {label} ({reference.id}, {reference.version})
                </option>
              ))}
            </select>
            <label htmlFor="creation-role">Role</label>
            <select
              id="creation-role"
              value={role}
              onChange={(event) =>
                setRole(
                  INSTANCE_ROLES.find((choice) => choice === event.currentTarget.value) ?? role,
                )
              }
            >
              {INSTANCE_ROLES.map((choice) => (
                <option key={choice} value={choice}>
                  {choice.charAt(0).toUpperCase() + choice.slice(1)}
                </option>
              ))}
            </select>
            <label htmlFor="creation-name">Display name</label>
            <input
              id="creation-name"
              required
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
              aria-invalid={failure?.field === 'displayName'}
              aria-describedby={failure?.field === 'displayName' ? 'creation-error' : undefined}
            />
            <label htmlFor="creation-id">Sheet ID</label>
            <input
              id="creation-id"
              required
              value={id}
              onChange={(event) => setManualId(event.currentTarget.value)}
              aria-invalid={failure?.field === 'id'}
              aria-describedby={failure?.field === 'id' ? 'creation-error' : undefined}
            />
            <button id="creation-submit" type="submit">
              Create sheet
            </button>
            {sheet && (
              <button
                ref={viewButton}
                type="button"
                onClick={(event) => {
                  if (!created) return;
                  viewSheet(
                    {
                      ...created,
                      onEdit: (result) => setCreated({ ...created, ...result }),
                    },
                    event.currentTarget,
                  );
                }}
              >
                View sheet
              </button>
            )}
          </fieldset>
        </form>
      )}
      <p role="alert" id="creation-error">
        {failure?.message ?? optionsIssue}
      </p>
      <p role="status">{creating ? 'Creating sheet…' : successMessage}</p>
    </section>
  );
}
