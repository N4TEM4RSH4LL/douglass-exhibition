import { FIELD_BY_ID } from "./exhibition-schema.js";
import { extractAccessKey } from "./class-access.js";
export const API_BASE =
  location.hostname === "n4tem4rsh4ll.github.io"
    ? "https://douglass-exhibition.vercel.app"
    : "";
const BACKUP_KEY = "douglass-class-exhibition-drafts-v2";
const DRAFT_PREFIX = "douglass-editor-draft-v3:";
export class SharedExhibition {
  constructor({ editor = false } = {}) {
    this.editor = editor;
    this.fields = {};
    this.pending = {};
    this.ownMutations = new Set();
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
        this.clientId =
          sessionStorage.getItem("douglass-editor-session") ||
          crypto.randomUUID();
        sessionStorage.setItem("douglass-editor-session", this.clientId);
      } catch {
        this.clientId = crypto.randomUUID();
      }
      try {
        this.backupKey = DRAFT_PREFIX + this.clientId;
        const saved = localStorage.getItem(this.backupKey);
        const legacy = localStorage.getItem(BACKUP_KEY);
        const migrate =
          !saved && legacy && !localStorage.getItem(BACKUP_KEY + "-migrated");
        const b = JSON.parse(saved || (migrate ? legacy : "{}"));
        if (migrate) {
          localStorage.setItem(
            this.backupKey,
            JSON.stringify({ ...b, editorSession: this.clientId }),
          );
          localStorage.setItem(BACKUP_KEY + "-migrated", this.clientId);
        }
        this.fields = b.fields || {};
        this.pending = b.pending || {};
        this.ownMutations = new Set(
          [
            ...(b.editorSession === this.clientId ? b.ownMutations || [] : []),
            ...Object.values(this.pending).map((p) => p.mutationId),
          ].filter(Boolean),
        );
        this.writer = b.writer || this.writer;
      } catch {
        this.localError = "Your browser could not open its local backup.";
      }
      try {
        this.token = sessionStorage.getItem("douglass-editor-key") || "";
      } catch {}
    }
  }
  recoverableDrafts() {
    const drafts = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith(DRAFT_PREFIX) || key === this.backupKey) continue;
        const draft = JSON.parse(localStorage.getItem(key));
        const pending = Object.entries(draft.pending || {}).filter(
          ([id, p]) => FIELD_BY_ID[id] && typeof p.value === "string",
        );
        if (pending.length)
          drafts.push({
            key,
            writer: draft.writer || "Class contributor",
            backedUpAt: draft.backedUpAt,
            pending,
          });
      }
    } catch {}
    return drafts.sort((a, b) =>
      String(b.backedUpAt).localeCompare(String(a.backedUpAt)),
    );
  }
  recoverDraft(key) {
    const draft = this.recoverableDrafts().find((d) => d.key === key);
    if (!draft) return;
    for (const [id, p] of draft.pending) {
      if (this.pending[id] || p.value === this.fields[id]?.value) continue;
      this.edit(id, p.value, p.baseRevision);
    }
    this.flush();
  }
  isOwnSave(row) {
    return !!row?.mutationId && this.ownMutations.has(row.mutationId);
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
        this.backupKey || DRAFT_PREFIX + this.clientId,
        JSON.stringify({
          version: 2,
          fields: this.fields,
          pending: this.pending,
          ownMutations: [...this.ownMutations].slice(-500),
          editorSession: this.clientId,
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
  async connect({ accessKey } = {}) {
    await this.refresh();
    this.startLive();
    if (accessKey || this.token)
      await this.authenticate(accessKey || this.token);
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
        else if (this.isOwnSave(row)) {
          p.baseRevision = row.revision;
          delete p.conflict;
        } else if (p.baseRevision !== row.revision) p.conflict = row;
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
    const candidate = extractAccessKey(key);
    const attempt = (this.authAttempt = (this.authAttempt || 0) + 1);
    this.authorized = false;
    try {
      if (!candidate)
        throw new Error(
          "Enter the class key or paste your class invitation link.",
        );
      const { status, body } = await this.request("?action=auth", {
        headers: { Authorization: `Bearer ${candidate}` },
      });
      if (attempt !== this.authAttempt) return false;
      if (status !== 200)
        throw new Error(body.error || "The class access key was not accepted.");
      this.token = candidate;
      this.authorized = true;
      try {
        sessionStorage.setItem("douglass-editor-key", this.token);
      } catch {}
      this.error = "";
      this.notify();
      await this.refresh();
      return true;
    } catch (e) {
      if (attempt !== this.authAttempt) return false;
      this.authorized = false;
      this.error = e.message;
      this.notify();
      return false;
    }
  }
  logout() {
    this.authAttempt = (this.authAttempt || 0) + 1;
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
    let base =
      previous?.baseRevision ??
      displayedRevision ??
      this.fields[id]?.revision ??
      0;
    if (
      !previous?.conflict &&
      this.isOwnSave(this.fields[id]) &&
      this.fields[id].revision > base
    )
      base = this.fields[id].revision;
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
    this.ownMutations.add(this.pending[id].mutationId);
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
          if (pending) {
            if (this.isOwnSave(body.current)) {
              pending.baseRevision = body.current.revision;
              delete pending.conflict;
            } else pending.conflict = body.current;
          }
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
      this.ownMutations.add(this.pending[id].mutationId);
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
