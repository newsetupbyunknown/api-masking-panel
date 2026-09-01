"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MaskedApi, UsageLog } from "@/lib/types";

interface Props {
  initialApis: Omit<MaskedApi, "realApiKey">[];
  initialLogs: UsageLog[];
}

export default function DashboardClient({ initialApis, initialLogs }: Props) {
  const router = useRouter();
  const [apis, setApis] = useState(initialApis);
  const [logs] = useState(initialLogs);
  const [showCreate, setShowCreate] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", newPass: "", confirm: "" });

  const [form, setForm] = useState({
    name: "",
    realUrl: "",
    realApiKey: "",
    realApiKeyHeader: "Authorization",
    validityType: "permanent" as "permanent" | "days",
    validityDays: 30,
    rateLimitType: "unlimited" as "unlimited" | "daily" | "monthly",
    rateLimitValue: 1000,
  });

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/apis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const newApi = await res.json();
        setApis((prev) => [newApi, ...prev]);
        setShowCreate(false);
        setForm({
          name: "",
          realUrl: "",
          realApiKey: "",
          realApiKeyHeader: "Authorization",
          validityType: "permanent",
          validityDays: 30,
          rateLimitType: "unlimited",
          rateLimitValue: 1000,
        });
      } else {
        const err = await res.json();
        alert(err.error || "Failed to create");
      }
    } catch {
      alert("Network error");
    }
    setLoading(false);
  }

  async function toggleActive(id: string, current: boolean) {
    const res = await fetch(`/api/apis/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !current }),
    });
    if (res.ok) {
      const updated = await res.json();
      setApis((prev) => prev.map((a) => (a.id === id ? updated : a)));
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/apis/${id}`, { method: "DELETE" });
    if (res.ok) {
      setApis((prev) => prev.filter((a) => a.id !== id));
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwForm.newPass !== pwForm.confirm) {
      alert("New passwords do not match");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: pwForm.current,
        newPassword: pwForm.newPass,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      alert("Password changed successfully");
      setShowPassword(false);
      setPwForm({ current: "", newPass: "", confirm: "" });
    } else {
      alert(data.error || "Failed");
    }
    setLoading(false);
  }

  const totalRequests = apis.reduce((sum, a) => sum + a.totalRequests, 0);
  const activeCount = apis.filter((a) => a.isActive).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-slate-900">API Masking Panel</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPassword(true)}
              className="text-sm text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition"
            >
              Change Password
            </button>
            <button
              onClick={handleLogout}
              className="text-sm text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">Total APIs</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{apis.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">Active</p>
            <p className="text-3xl font-bold text-green-600 mt-1">{activeCount}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">Total Requests</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">{totalRequests}</p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-slate-900">Your Masked APIs</h2>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition"
          >
            + Create Masked API
          </button>
        </div>

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Create Masked API</h3>
                <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
              </div>
              <form onSubmit={handleCreate} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name (unique)</label>
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="openai-gpt4" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Real Endpoint URL</label>
                  <input required type="url" value={form.realUrl} onChange={(e) => setForm({ ...form, realUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="https://api.openai.com/v1/chat/completions" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Real API Key (kept secret)</label>
                  <input type="password" value={form.realApiKey} onChange={(e) => setForm({ ...form, realApiKey: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="sk-..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">API Key Header Name</label>
                  <input value={form.realApiKeyHeader} onChange={(e) => setForm({ ...form, realApiKeyHeader: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Authorization" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Validity</label>
                    <select value={form.validityType} onChange={(e) => setForm({ ...form, validityType: e.target.value as any })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="permanent">Permanent</option>
                      <option value="days">Days</option>
                    </select>
                  </div>
                  {form.validityType === "days" && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Days</label>
                      <input type="number" min={1} value={form.validityDays} onChange={(e) => setForm({ ...form, validityDays: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Rate Limit</label>
                    <select value={form.rateLimitType} onChange={(e) => setForm({ ...form, rateLimitType: e.target.value as any })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="unlimited">Unlimited</option>
                      <option value="daily">Per Day</option>
                      <option value="monthly">Per Month</option>
                    </select>
                  </div>
                  {form.rateLimitType !== "unlimited" && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Limit</label>
                      <input type="number" min={1} value={form.rateLimitValue} onChange={(e) => setForm({ ...form, rateLimitValue: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                  )}
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50">Cancel</button>
                  <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium disabled:opacity-60">
                    {loading ? "Creating..." : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Change Password Modal */}
        {showPassword && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
              <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Change Password</h3>
                <button onClick={() => setShowPassword(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
              </div>
              <form onSubmit={handleChangePassword} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
                  <input type="password" required value={pwForm.current} onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                  <input type="password" required minLength={6} value={pwForm.newPass} onChange={(e) => setPwForm({ ...pwForm, newPass: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
                  <input type="password" required value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div className="pt-2 flex gap-3">
                  <button type="button" onClick={() => setShowPassword(false)} className="flex-1 py-2.5 border border-slate-300 rounded-lg">Cancel</button>
                  <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-60">
                    {loading ? "Saving..." : "Update Password"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* API List */}
        {apis.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <p className="text-slate-500">No masked APIs yet. Create your first one!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {apis.map((api) => (
              <div key={api.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-slate-900">{api.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${api.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {api.isActive ? "Active" : "Disabled"}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 truncate mb-2">{api.realUrl}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                      <span>Masked: <code className="bg-slate-100 px-1.5 py-0.5 rounded">/api/proxy/{api.slug}</code></span>
                      <span>Requests: {api.totalRequests}</span>
                      <span>Limit: {api.rateLimitType === "unlimited" ? "∞" : `${api.rateLimitValue}/${api.rateLimitType}`}</span>
                      {api.expiresAt && <span>Expires: {new Date(api.expiresAt).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                    <button onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/api/proxy/${api.slug}`);
                      alert("Masked URL copied!");
                    }} className="text-sm px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg">Copy URL</button>
                    <button onClick={() => toggleActive(api.id, api.isActive)}
                      className={`text-sm px-3 py-1.5 rounded-lg ${api.isActive ? "bg-amber-100 text-amber-800 hover:bg-amber-200" : "bg-green-100 text-green-800 hover:bg-green-200"}`}>
                      {api.isActive ? "Disable" : "Enable"}
                    </button>
                    <button onClick={() => handleDelete(api.id, api.name)}
                      className="text-sm px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Logs */}
        <div className="mt-12">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Recent Requests (last 50)</h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Time</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Method</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">ms</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Path</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No requests yet</td></tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                        <td className="px-4 py-3 font-mono text-xs">{log.method}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${log.statusCode < 400 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            {log.statusCode}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{log.responseTimeMs}</td>
                        <td className="px-4 py-3 text-slate-500 truncate max-w-xs">{log.path}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
