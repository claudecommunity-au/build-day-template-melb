import { desc } from "drizzle-orm";
import { type Database, notes } from "./schema.ts";
import { NOTE_TEXT_MAX_LENGTH, type Note } from "./shared.ts";

/** How a note is stored. Only this module sees the numeric id. */
type NoteRow = typeof notes.$inferSelect;

const DEFAULT_LIST_LIMIT = 20;

function toNote(row: NoteRow): Note {
  return {
    createdAt: row.createdAt,
    id: String(row.id),
    text: row.text,
  };
}

/** Newest notes first. */
export async function listNotes(
  db: Database,
  limit = DEFAULT_LIST_LIMIT
): Promise<Note[]> {
  const rows = await db
    .select()
    .from(notes)
    .orderBy(desc(notes.id))
    .limit(limit);
  return rows.map(toNote);
}

/** Validates and stores a note. Throws on empty or over-long text. */
export async function createNote(
  db: Database,
  input: { text: string }
): Promise<Note> {
  const text = input.text.trim();
  if (text.length === 0) {
    throw new Error("Note text must not be empty.");
  }
  if (text.length > NOTE_TEXT_MAX_LENGTH) {
    throw new Error(
      `Note text must be at most ${NOTE_TEXT_MAX_LENGTH} characters.`
    );
  }

  const [row] = await db
    .insert(notes)
    .values({ createdAt: new Date().toISOString(), text })
    .returning();
  if (!row) {
    throw new Error("Note was inserted but could not be read back.");
  }
  return toNote(row);
}
