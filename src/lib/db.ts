import { promises as fs } from "fs";
import path from "path";
import { Database, MaskedApi, UsageLog, ClientKey, RateLimitType } from "./types";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

const DB_PATH = path.join(process.cwd(), "data", "db.json");

// Default empty database
const defaultDb: Database = {
  adminPasswordHash: "",
  apis: [],
  logs: [],
  settings: {
    panelName: "API Masking Panel",
    createdAt: new Date().toISOString(),
  },
};

// Simple in-memory lock to reduce race conditions
let writeLock = Promise.resolve();

async function ensureDbFile(): Promise<void> {
  const dir = path.dirname(DB_PATH);
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }

  try {
    await fs.access(DB_PATH);
  } catch {
    // First run – create with default password "admin123" (user must change)
    const hash = await bcrypt.hash("admin123", 12);
    const initial: Database = {
      ...defaultDb,
      adminPasswordHash: hash,
    };
    await fs.writeFile(DB_PATH, JSON.stringify(initial, null, 2), "utf-8");
  }
}

export async function readDb(): Promise<Database> {
  await ensureDbFile();
  const raw = await fs.readFile(DB_PATH, "utf-8");
  return JSON.parse(raw) as Database;
}

export async function writeDb(db: Database): Promise<void> {
  // Serialize writes
  writeLock = writeLock.then(async () => {
    await ensureDbFile();
    await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
  });
  await writeLock;
}

// ========== AUTH ==========
export async function verifyAdminPassword(password: string): Promise<boolean> {
  const db = await readDb();
  if (!db.adminPasswordHash) return false;
  return bcrypt.compare(password, db.adminPasswordHash);
}

export async function changeAdminPassword(newPassword: string): Promise<void> {
  const db = await readDb();
  db.adminPasswordHash = await bcrypt.hash(newPassword, 12);
  await writeDb(db);
}

// ========== APIs ==========
export async function getAllApis(): Promise<MaskedApi[]> {
  const db = await readDb();
  return db.apis;
}

export async function getApiById(id: string): Promise<MaskedApi | null> {
  const db = await readDb();
  return db.apis.find((a) => a.id === id) || null;
}

export async function getApiBySlug(slug: string): Promise<MaskedApi | null> {
  const db = await readDb();
  return db.apis.find((a) => a.slug === slug) || null;
}

export async function createApi(
  data: Omit<MaskedApi, "id" | "createdAt" | "updatedAt" | "totalRequests" | "clientKeys" | "slug" | "expiresAt">
): Promise<MaskedApi> {
  const db = await readDb();

  // Generate unique slug from name
  let baseSlug = data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  let slug = baseSlug;
  let counter = 1;
  while (db.apis.some((a) => a.slug === slug)) {
    slug = `\( {baseSlug}- \){counter}`;
    counter++;
  }

  const now = new Date().toISOString();
  let expiresAt: string | null = null;
  if (data.validityType === "days" && data.validityDays) {
    const d = new Date();
    d.setDate(d.getDate() + data.validityDays);
    expiresAt = d.toISOString();
  }

  const newApi: MaskedApi = {
    ...data,
    id: uuidv4(),
    slug,
    expiresAt,
    createdAt: now,
    updatedAt: now,
    totalRequests: 0,
    clientKeys: [],
    isActive: true,
  };

  db.apis.push(newApi);
  await writeDb(db);
  return newApi;
}

export async function updateApi(
  id: string,
  updates: Partial<MaskedApi>
): Promise<MaskedApi | null> {
  const db = await readDb();
  const index = db.apis.findIndex((a) => a.id === id);
  if (index === -1) return null;

  db.apis[index] = {
    ...db.apis[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await writeDb(db);
  return db.apis[index];
}

export async function deleteApi(id: string): Promise<boolean> {
  const db = await readDb();
  const before = db.apis.length;
  db.apis = db.apis.filter((a) => a.id !== id);
  // also clean logs
  db.logs = db.logs.filter((l) => l.apiId !== id);
  await writeDb(db);
  return db.apis.length < before;
}

// ========== CLIENT KEYS ==========
export async function addClientKey(
  apiId: string,
  name: string,
  rateLimitType?: RateLimitType,
  rateLimitValue?: number | null
): Promise<ClientKey | null> {
  const db = await readDb();
  const api = db.apis.find((a) => a.id === apiId);
  if (!api) return null;

  const key = `mk_${uuidv4().replace(/-/g, "")}`;
  const newKey: ClientKey = {
    id: uuidv4(),
    key,
    name,
    createdAt: new Date().toISOString(),
    isActive: true,
    requestCount: 0,
    lastResetAt: new Date().toISOString(),
    rateLimitType: rateLimitType || api.rateLimitType,
    rateLimitValue: rateLimitValue !== undefined ? rateLimitValue : api.rateLimitValue,
  };

  api.clientKeys.push(newKey);
  await writeDb(db);
  return newKey;
}

export async function toggleClientKey(
  apiId: string,
  keyId: string,
  isActive: boolean
): Promise<boolean> {
  const db = await readDb();
  const api = db.apis.find((a) => a.id === apiId);
  if (!api) return false;
  const key = api.clientKeys.find((k) => k.id === keyId);
  if (!key) return false;
  key.isActive = isActive;
  await writeDb(db);
  return true;
}

// ========== USAGE & LOGS ==========
export async function recordUsage(
  apiId: string,
  clientKeyId: string | undefined,
  log: Omit<UsageLog, "id" | "apiId" | "clientKeyId" | "createdAt">
): Promise<void> {
  const db = await readDb();
  const api = db.apis.find((a) => a.id === apiId);
  if (!api) return;

  api.totalRequests += 1;

  if (clientKeyId) {
    const key = api.clientKeys.find((k) => k.id === clientKeyId);
    if (key) {
      // Reset counter if needed
      const now = new Date();
      const lastReset = new Date(key.lastResetAt);
      if (key.rateLimitType === "daily") {
        if (
          now.getUTCFullYear() !== lastReset.getUTCFullYear() ||
          now.getUTCMonth() !== lastReset.getUTCMonth() ||
          now.getUTCDate() !== lastReset.getUTCDate()
        ) {
          key.requestCount = 0;
          key.lastResetAt = now.toISOString();
        }
      } else if (key.rateLimitType === "monthly") {
        if (
          now.getUTCFullYear() !== lastReset.getUTCFullYear() ||
          now.getUTCMonth() !== lastReset.getUTCMonth()
        ) {
          key.requestCount = 0;
          key.lastResetAt = now.toISOString();
        }
      }
      key.requestCount += 1;
    }
  }

  const newLog: UsageLog = {
    id: uuidv4(),
    apiId,
    clientKeyId,
    createdAt: new Date().toISOString(),
    ...log,
  };

  db.logs.unshift(newLog);
  // Keep only last 500 logs
  if (db.logs.length > 500) {
    db.logs = db.logs.slice(0, 500);
  }

  await writeDb(db);
}

export async function getLogs(limit = 100): Promise<UsageLog[]> {
  const db = await readDb();
  return db.logs.slice(0, limit);
}

export async function checkRateLimit(
  api: MaskedApi,
  clientKey?: ClientKey
): Promise<{ allowed: boolean; reason?: string }> {
  // Check API level expiry
  if (api.expiresAt && new Date(api.expiresAt) < new Date()) {
    return { allowed: false, reason: "API has expired" };
  }
  if (!api.isActive) {
    return { allowed: false, reason: "API is disabled" };
  }

  if (!clientKey) {
    // If no client key required, still check global if needed
    return { allowed: true };
  }

  if (!clientKey.isActive) {
    return { allowed: false, reason: "Client key is disabled" };
  }

  // Reset logic is done in recordUsage, here we just check current count
  if (clientKey.rateLimitType === "unlimited" || clientKey.rateLimitValue === null) {
    return { allowed: true };
  }

  if (clientKey.requestCount >= clientKey.rateLimitValue) {
    return {
      allowed: false,
      reason: `Rate limit exceeded (${clientKey.rateLimitType})`,
    };
  }

  return { allowed: true };
}