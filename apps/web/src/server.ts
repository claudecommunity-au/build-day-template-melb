import handler from "@tanstack/react-start/server-entry";
import { Hono } from "hono";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ status: "ok" }));

// Everything else is handled by TanStack Start (SSR pages, server functions, assets).
app.all("*", (c) => handler.fetch(c.req.raw));

export default app;
