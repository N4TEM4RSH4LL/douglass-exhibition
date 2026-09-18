import { FIELD_BY_ID } from "./exhibition-schema.js";
export const API_BASE =
  location.hostname === "n4tem4rsh4ll.github.io"
    ? "https://douglass-exhibition.vercel.app"
    : "";
const BACKUP_KEY = "douglass-class-exhibition-drafts-v2";
export class SharedExhibition {
  constructor({ editor = false } = {}) {
    this.editor = editor;
    this.fields = {};
    this.pending = {};
    this.listeners = new Set();
    this.online = false;
    this.loaded = false;
    this.saving = false;
    this.error = "";
    this.localError = "";
    this.lastSaved = null;
    this.streamLive = false;
    this.token = "";
    this.writer = "Class contributor";
    if (editor) {
      try {
        const b = JSON.parse(localStorage.getItem(BACKUP_KEY) || "{}");
        this.fields = b.fields || {};
        this.pending = b.pending || {};
        this.writer = b.writer || this.writer;
      } catch {
        this.localError = "Your browser could not open its local backup.";
      }
      try {
        this.token = sessionStorage.getItem("douglass-editor-key") || "";
      } catch {}
    }
  }
  values() {
    const out = Object.fromEntries(
      Object.entries(this.fields).map(([k, v]) => [k, v.value]),
    );
    for (const [k, p] of Object.entries(this.pending)) out[k] = p.value;
    return out;
  }
  subscribe(fn) {
    this.listeners.add(fn);
    fn(this);
    return () => this.listeners.delete(fn);
  }
  notify() {
    this.listeners.forEach((fn) => fn(this));
  }
  persist() {
    if (!this.editor) return;
    try {
      localStorage.setItem(
        BACKUP_KEY,
        JSON.stringify({
          version: 2,
          fields: this.fields,
          pending: this.pending,
          writer: this.writer,
          backedUpAt: new Date().toISOString(),
        }),
      );
      this.localError = "";
    } catch {
      this.localError =
        "Local backup is unavailable. Keep this page open until shared saving succeeds, or download a backup.";
    }
  }
  async request(path = "", options = {}) {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 12000);
    try {
      const r = await fetch(`${API_BASE}/api/exhibition${path}`, {
        ...options,
        cache: "no-store",
        signal: controller.signal,
        headers: {
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
          ...options.headers,
        },
      });
      let body;
      try {
        body = await r.json();
      } catch {
        body = { error: "The shared server is unavailable." };
      }
      return { status: r.status, body };
    } finally {
      clearTimeout(timer);
    }
  }
  async connect() {
    await this.refresh();
    this.startLive();
    if (this.token) this.authenticate(this.token);
    this.timer = setInterval(() => {
      if (!document.hidden && !this.streamLive) this.refresh();
    }, 3000);
    window.addEventListener("online", () => {
      this.refresh();
      this.startLive();
    });
    window.addEventListener("beforeunload", (e) => {
      if (Object.keys(this.pending).length) {
        this.persist();
        e.preventDefault();
        e.returnValue = "";
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.persist();
        this.stopLive();
      } else {
        this.refresh();
        this.startLive();
      }
    });
  }
  startLive() {
    if (this.events || typeof EventSource === "undefined" || document.hidden)
      return;
    this.events = new EventSource(`${API_BASE}/api/exhibition?action=events`);
    this.events.addEventListener("exhibition", (event) => {
      try {
        this.streamLive = true;
        this.applySnapshot(JSON.parse(event.data));
      } catch {
        this.streamLive = false;
        this.refresh();
      }
    });
    this.events.addEventListener("unavailable", () => {
      this.streamLive = false;
      this.refresh();
    });
    this.events.onerror = () => {
      this.streamLive = false;
      this.notify();
    };
  }
  stopLive() {
    this.events?.close();
    this.events = null;
    this.streamLive = false;
  }
  applySnapshot(body) {
    this.online = true;
    this.loaded = true;
    this.error = "";
    if (body.updatedAt && (!this.lastSaved || body.updatedAt > this.lastSaved))
      this.lastSaved = body.updatedAt;
    for (const [id, row] of Object.entries(body.fields || {})) {
      if (!FIELD_BY_ID[id]) continue;
      const old = this.fields[id];
      if (old && row.revision < old.revision) continue;
      this.fields[id] = row;
      const p = this.pending[id];
      if (p && !this.inflight?.has(id)) {
        if (p.value === row.value) delete this.pending[id];
        else if (p.baseRevision !== row.revision) p.conflict = row;
      }
    }
    this.persist();
    this.notify();
    if (this.editor) this.flush();
  }
  async refresh() {
    if (this.refreshing) return;
    this.refreshing = true;
    try {
      const { status, body } = await this.request();
      if (status !== 200)
        throw new Error(body.error || "Shared saving is unavailable.");
      this.applySnapshot(body);
    } catch (e) {
      this.online = false;
      this.error =
        e.name === "AbortError"
          ? "The shared server is taking too long. Local drafts are retained."
          : e.message;
      this.notify();
    } finally {
      this.refreshing = false;
    }
  }
  async authenticate(key) {
    const previous = this.token;
    this.token = key.trim();
    try {
      const { status, body } = await this.request("?action=auth");
      if (status !== 200)
        throw new Error(body.error || "The class access key was not accepted.");
      this.authorized = true;
      try {
        sessionStorage.setItem("douglass-editor-key", this.token);
      } catch {}
      this.error = "";
      this.notify();
      await this.refresh();
      return true;
    } catch (e) {
      this.token = previous;
      this.authorized = false;
      this.error = e.message;
      this.notify();
      return false;
    }
  }
  logout() {
    this.token = "";
    this.authorized = false;
    try {
      sessionStorage.removeItem("douglass-editor-key");
    } catch {}
    this.notify();
  }
  edit(id, value, displayedRevision) {
    if (!FIELD_BY_ID[id]) throw new Error("Unknown exhibition field");
    const previous = this.pending[id];
    const base =
      previous?.baseRevision ??
      displayedRevision ??
      this.fields[id]?.revision ??
      0;
    const conflict =
      previous?.conflict ||
      ((this.fields[id]?.revision ?? 0) !== base ? this.fields[id] : null);
    this.pending[id] = {
      value,
      baseRevision: base,
      mutationId: crypto.randomUUID(),
      editedAt: new Date().toISOString(),
      ...(conflict ? { conflict } : {}),
    };
    this.persist();
    this.notify();
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.flush(), 350);
  }
  async flush() {
    if (
      this.saving ||
      !this.online ||
      !this.editor ||
      !this.authorized ||
      !this.token
    )
      return;
    const queue = Object.keys(this.pending).filter(
      (id) => !this.pending[id].conflict,
    );
    if (!queue.length) return;
    this.saving = true;
    this.inflight = new Set();
    this.notify();
    for (const id of queue) {
      const sent = this.pending[id];
      if (!sent || sent.conflict) continue;
      this.inflight.add(id);
      try {
        const { status, body } = await this.request("", {
          method: "PATCH",
          body: JSON.stringify({
            field: id,
            value: sent.value,
            expectedRevision: sent.baseRevision,
            mutationId: sent.mutationId,
            writer: this.writer,
          }),
        });
        if (status === 409) {
          const pending = this.pending[id];
          if (pending) pending.conflict = body.current;
          this.fields[id] = body.current;
        } else if (status === 401) {
          this.authorized = false;
          throw new Error(
            "Your class key was not accepted. Unlock the editor again; your draft is retained.",
          );
        } else if (status !== 200)
          throw new Error(body.error || "The shared save did not finish.");
        else {
          const row = body.field;
          if (!this.fields[id] || row.revision >= this.fields[id].revision)
            this.fields[id] = row;
          if (this.pending[id] === sent) delete this.pending[id];
          else if (this.pending[id])
            this.pending[id].baseRevision = row.revision;
          this.lastSaved = row.updatedAt;
          this.error = "";
        }
      } catch (e) {
        this.error =
          e.name === "AbortError"
            ? "Save timed out. Your draft is retained and will be retried safely."
            : e.message;
        this.online = false;
        break;
      } finally {
        this.inflight.delete(id);
        this.persist();
        this.notify();
      }
    }
    this.saving = false;
    this.notify();
    if (
      this.online &&
      this.authorized &&
      Object.values(this.pending).some((p) => !p.conflict)
    )
      setTimeout(() => this.flush(), 150);
  }
  resolve(id, choice) {
    const p = this.pending[id];
    if (!p?.conflict) return;
    if (choice === "shared") {
      this.fields[id] = p.conflict;
      delete this.pending[id];
    } else {
      this.pending[id] = {
        ...p,
        baseRevision: p.conflict.revision,
        mutationId: crypto.randomUUID(),
      };
      delete this.pending[id].conflict;
    }
    this.persist();
    this.notify();
    this.flush();
  }
  async history(field, before) {
    const { status, body } = await this.request(
      `?action=history&field=${encodeURIComponent(field)}${before ? "&before=" + before : ""}`,
    );
    if (status !== 200)
      throw new Error(body.error || "Version history is unavailable.");
    return body;
  }
  export() {
    return {
      format: "douglass-exhibition-backup",
      version: 2,
      exportedAt: new Date().toISOString(),
      values: this.values(),
      fields: this.fields,
      pending: this.pending,
    };
  }
  destroy() {
    this.stopLive();
    clearInterval(this.timer);
    clearTimeout(this.debounce);
  }
}
