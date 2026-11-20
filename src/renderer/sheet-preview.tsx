import type { Ref } from 'react';
import type { Instance } from '../domain/definitions/document-models';

interface SheetPreviewProps {
  id: string;
  sheet: Instance;
  headingRef: Ref<HTMLHeadingElement>;
}

// Render the snapshot's own labels and values without evaluating formulas again.
function renderValues(sheet: Instance, values: Record<string, number>) {
  return Object.entries(values).map(([id, value]) => {
    const field = sheet.presentation.fields[id];
    return (
      <div key={id}>
        <dt>{field.label}</dt>
        <dd>{field.unit ? `${value} ${field.unit}` : value}</dd>
      </div>
    );
  });
}

/**
 * Show a sheet's identity and recorded values in the interim desktop preview.
 * @param props Validated snapshot and heading identity and focus target.
 * @returns Semantic preview shared by creation and opening.
 */
export function SheetPreview({ id, sheet, headingRef }: SheetPreviewProps) {
  return (
    <section aria-labelledby={id}>
      <h3 id={id} ref={headingRef} tabIndex={-1}>
        {sheet.displayName}
      </h3>
      <dl>
        <dt>Role</dt>
        <dd>{sheet.role}</dd>
        <dt>Sheet ID</dt>
        <dd>{sheet.id}</dd>
      </dl>
      <h4>Source values</h4>
      <dl>{renderValues(sheet, sheet.values)}</dl>
      <h4>Final statistics</h4>
      <dl>{renderValues(sheet, sheet.derived)}</dl>
    </section>
  );
}
