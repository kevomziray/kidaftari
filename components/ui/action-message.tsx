import type { ActionState } from "@/lib/validation";

export function ActionMessage({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p
      className={
        state.errors ? "form-message form-message-error" : "form-message form-message-success"
      }
      role="status"
    >
      {state.message}
    </p>
  );
}

export function FieldError({ state, name }: { state: ActionState; name: string }) {
  const message = state.errors?.[name]?.[0];
  return message ? <p className="field-error">{message}</p> : null;
}
