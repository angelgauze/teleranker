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
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-fg hover:text-white md:min-h-9 md:text-[13px] md:text-fg-2">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="size-[18px] accent-fg md:size-4"
      />
      {label}
    </label>
  );
}
