// Runs against a throwaway in-memory SQLite database with the same migrations
// D1 gets, so no server and no network are involved.
import { Database as Sqlite } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { createNote, listNotes } from "./notes.ts";
import type { Database } from "./schema.ts";
import { NOTE_TEXT_MAX_LENGTH } from "./shared.ts";

// Relative to this file, not the working directory: `bun test` from the repo
// root would otherwise look for migrations there.
const MIGRATIONS_FOLDER = resolve(import.meta.dir, "../migrations");

let db: Database;

beforeEach(() => {
  const sqlite = drizzle(new Sqlite(":memory:"));
  migrate(sqlite, { migrationsFolder: MIGRATIONS_FOLDER });
  db = sqlite;
});

describe("notes", () => {
  test("createNote trims text and returns plain JSON", async () => {
    const note = await createNote(db, { text: "  hello  " });

    expect(note.text).toBe("hello");
    expect(typeof note.id).toBe("string");
    expect(new Date(note.createdAt).toISOString()).toBe(note.createdAt);
  });

  test("createNote rejects empty and over-long text", async () => {
    await expect(createNote(db, { text: "   " })).rejects.toThrow(
      "must not be empty"
    );
    await expect(
      createNote(db, { text: "x".repeat(NOTE_TEXT_MAX_LENGTH + 1) })
    ).rejects.toThrow("at most");
  });

  test("listNotes returns newest first and honours the limit", async () => {
    await createNote(db, { text: "first" });
    await createNote(db, { text: "second" });
    await createNote(db, { text: "third" });

    const notes = await listNotes(db, 2);

    expect(notes.map((n) => n.text)).toEqual(["third", "second"]);
  });
});
