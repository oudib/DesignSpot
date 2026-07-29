"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import Spinner from "./Spinner";

type Props = Omit<React.ComponentProps<"button">, "type"> & {
  /** Label swapped in while the form is submitting, e.g. "Saving…". */
  pendingLabel?: string;
  /** Rendered in the spinner's slot when idle (an icon, a glyph…). */
  icon?: React.ReactNode;
  /**
   * Only spin when *this* button started the submit. Use it on forms with more
   * than one submit target (a `formAction` button next to the main one) so a
   * delete doesn't make Save spin too. Off by default, because a submit from
   * the Enter key has no clicked button to attribute the spinner to.
   */
  spinOnlyWhenClicked?: boolean;
};

/**
 * Submit button that shows a spinner while its form's action is running. Reads
 * the surrounding form's pending state, so it works inside plain
 * `<form action={serverAction}>` markup as well as client-wrapped actions.
 */
export default function SubmitButton({
  children,
  pendingLabel,
  icon,
  spinOnlyWhenClicked = false,
  className = "btn-primary",
  disabled,
  onClick,
  ...rest
}: Props) {
  const { pending } = useFormStatus();
  const [clicked, setClicked] = useState(false);

  useEffect(() => {
    if (!pending && clicked) setClicked(false);
  }, [pending, clicked]);

  const busy = pending && (!spinOnlyWhenClicked || clicked);

  return (
    <button
      {...rest}
      type="submit"
      className={className}
      disabled={disabled || pending}
      aria-busy={busy}
      onClick={(e) => {
        setClicked(true);
        onClick?.(e);
      }}
    >
      {busy ? <Spinner /> : icon}
      {busy && pendingLabel ? pendingLabel : children}
    </button>
  );
}
