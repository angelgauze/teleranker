"use client";

/**
 * A checkbox that submits its form as soon as it changes. Without JavaScript
 * the form's own submit button (in a <noscript>) does the same job.
 */
export function AutoSubmitCheckbox({
  name,
  value,
  defaultChecked,
  label,
}: {
  name: string;
  value: string;
  defaultChecked: boolean;
  label: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm font-medium">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="size-4 accent-zinc-900 dark:accent-zinc-100"
      />
      {label}
    </label>
  );
}
