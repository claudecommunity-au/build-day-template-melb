// Server functions for the notes example. Only the `.handler()` bodies run on
// the server; the client bundle gets RPC stubs, so importing drizzle and
// `cloudflare:workers` here never reaches the browser.

import { env } from "cloudflare:workers";
import { createNote, listNotes } from "@repo/db/notes";
import { createServerFn } from "@tanstack/react-start";
import { drizzle } from "drizzle-orm/d1";

export const listNotesFn = createServerFn({ method: "GET" }).handler(() =>
  listNotes(drizzle(env.DB))
);

export const createNoteFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const text = (input as { text?: unknown } | null)?.text;
    if (typeof text !== "string") {
      throw new Error("Expected { text: string }.");
    }
    return { text };
  })
  .handler(({ data }) => createNote(drizzle(env.DB), data));
