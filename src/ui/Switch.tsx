/**
 * The settings switch (P:260, P:1057-1064), keyboard-operable for free: a real <button> handles
 * Space and Enter natively, role="switch" + aria-checked give it the semantics, and the label
 * that names it sits beside it in the same .row (aria-labelledby; `id` lets that label's
 * htmlFor make a tap on the text flip it too).
 */
export interface SwitchProps {
  on: boolean;
  onChange: (v: boolean) => void;
  /** The id of the <label> element naming this switch. */
  labelId: string;
  id?: string;
}

export function Switch({ on, onChange, labelId, id }: SwitchProps) {
  return <button type="button" id={id} role="switch" className="sw" aria-checked={on} aria-labelledby={labelId} onClick={() => onChange(!on)} />;
}
