import { Fragment } from "react";

/** Renders text where `**word**` is emphasised; the only markup the network copy uses. */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split("**").map((part, index) => (
        <Fragment key={index}>{index % 2 === 1 ? <strong>{part}</strong> : part}</Fragment>
      ))}
    </>
  );
}
