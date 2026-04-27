import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, FolderOpen, RefreshCw, Trash2, CheckCircle2,
  AlertCircle, Clock, Camera, Settings, Users, BarChart3, Loader2,
  Download, XCircle, ShieldAlert, Zap, Timer, Database, Globe, Lock,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ThemeToggle from "@/components/ThemeToggle";
import BrandLogo from "@/components/BrandLogo";
import { useToast } from "@/hooks/use-toast";
import { cognitoGetCurrentUser } from "@/integrations/aws/auth";
import {
  getUserProfile,
  getAllEvents,
  deleteEvent,
  reindexEvent,
  getAdminStats,
  getAllUsers,
  cleanupExpiredEvents,
  type EventInfo,
  type AdminStats,
  type AdminUser,
} from "@/integrations/aws/api";

// ─── Helpers ────────────────────────────────────────────────────────────────

function isExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function getCountdown(expiresAt?: string | null): { text: string, color: string } {
  if (!expiresAt) return { text: "No expiry", color: "text-muted-foreground" };
  const diff = new Date(expiresAt).getTime() - new Date().getTime();
  if (diff <= 0) return { text: "Expired", color: "text-destructive" };
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  
  let color = "text-emerald-500";
  if (days < 1) color = "text-destructive font-bold animate-pulse";
  else if (days < 3) color = "text-amber-500 font-medium";

  if (days > 0) return { text: `${days}d ${hours}h left`, color };
  return { text: `${hours}h left`, color };
}

function csvDownload(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      headers.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Event Status Badge ──────────────────────────────────────────────────────

function StatusBadge({ event }: { event: EventInfo }) {
  const expired = isExpired(event.expires_at);
  if (expired || event.status === "deleted") {
    return (
      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
        <XCircle className="w-3 h-3" />
        {expired ? "Expired" : "Deleted"}
      </Badge>
    );
  }
  if (event.status === "active") {
    return (
      <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1">
        <CheckCircle2 className="w-3 h-3" />
        Active
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 gap-1">
      <Clock className="w-3 h-3" />
      {event.status}
    </Badge>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [events, setEvents] = useState<EventInfo[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [cleaningUp, setCleaningUp] = useState(false);

  const loadData = useCallback(async () => {
    const [eventsData, statsData, usersData] = await Promise.all([
      getAllEvents(),
      getAdminStats(),
      getAllUsers(),
    ]);
    setEvents(eventsData.events);
    setStats(statsData);
    setUsers(usersData.users);
  }, []);

  // Auto-refresh every 30 seconds for accurate data
  useEffect(() => {
    if (isAdmin) {
      const interval = setInterval(() => {
        loadData();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [isAdmin, loadData]);

  useEffect(() => {
    const init = async () => {
      const user = await cognitoGetCurrentUser();
      if (!user) { navigate("/register"); return; }

      try {
        const profile = await getUserProfile();
        if (!profile.is_admin) {
          toast({ title: "Access denied", description: "Admin only", variant: "destructive" });
          navigate("/dashboard");
          return;
        }
        setIsAdmin(true);
        await loadData();
      } catch (err) {
        console.error("Admin init failed:", err);
        toast({ title: "Error", description: "Failed to load admin data", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [navigate, toast, loadData]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleDeleteEvent = async (event: EventInfo) => {
    if (!confirm(`Delete "${event.event_name}"?\n\nThis will permanently remove the Rekognition collection, all S3 photos, and DynamoDB data.`)) return;
    setActionLoading(event.event_id);
    try {
      await deleteEvent(event.event_id);
      setEvents((prev) => prev.filter((e) => e.event_id !== event.event_id));
      toast({ title: "Event deleted", description: event.event_name });
    } catch (err) {
      toast({ title: "Delete failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReindex = async (event: EventInfo) => {
    setActionLoading(event.event_id);
    try {
      await reindexEvent(event.event_id);
      toast({ title: "Re-indexing started", description: event.event_name });
    } catch (err) {
      toast({ title: "Re-index failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCleanup = async () => {
    if (!confirm("Run cleanup? This will permanently delete S3 photos and Rekognition collections for ALL expired events.")) return;
    setCleaningUp(true);
    try {
      const result = await cleanupExpiredEvents();
      toast({ title: `Cleanup complete`, description: `${result.cleaned} expired event${result.cleaned !== 1 ? "s" : ""} cleaned up` });
      // Refresh the event list
      await loadData();
    } catch (err) {
      toast({ title: "Cleanup failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setCleaningUp(false);
    }
  };

  // ── Derived stats ──────────────────────────────────────────────────────────
  const expiredEvents   = events.filter((e) => isExpired(e.expires_at));
  const activeEvents    = events.filter((e) => e.status === "active" && !isExpired(e.expires_at));
  const totalImages     = events.reduce((a, e) => a + e.image_count, 0);
  const totalFaces      = events.reduce((a, e) => a + e.face_count, 0);

  // Event types derived dynamically from actual data
  const chartData = Array.from(
    events.reduce((map, e) => {
      map.set(e.event_type, (map.get(e.event_type) ?? 0) + 1);
      return map;
    }, new Map<string, number>())
  ).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));

  const COLORS = ["#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#3B82F6", "#EC4899"];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2 border-l border-border pl-4 ml-1">
              <BrandLogo className="w-6 h-6" />
              <div>
                <h1 className="font-display font-bold text-foreground text-lg leading-tight">Admin Dashboard</h1>
                <p className="text-xs text-muted-foreground">
                  {events.length} events · {users.length} users · ₹{(stats?.total_revenue ?? 0).toLocaleString()} total revenue
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Revenue",  value: `₹${(stats?.total_revenue ?? 0).toFixed(0)}`, icon: BarChart3, color: "text-success", bg: "bg-success/10" },
            { label: "Daily Rev",     value: `₹${(stats?.revenue_daily ?? 0).toFixed(0)}`, icon: Zap,      color: "text-amber-500", bg: "bg-amber-500/10" },
            { label: "Monthly Rev",   value: `₹${(stats?.revenue_monthly ?? 0).toFixed(0)}`, icon: Timer,    color: "text-blue-500",  bg: "bg-blue-500/10" },
            { label: "Total Users",    value: users.length,                     icon: Users,        color: "text-purple-500",  bg: "bg-purple-500/10" },
            { label: "Images Indexed", value: totalImages.toLocaleString(),     icon: Camera,       color: "text-primary",     bg: "bg-primary/10" },
            { label: "Faces Indexed",  value: totalFaces.toLocaleString(),      icon: Globe,        color: "text-pink-500",    bg: "bg-pink-500/10" },
            { label: "Yearly Rev",    value: `₹${(stats?.revenue_yearly ?? 0).toFixed(0)}`, icon: Database, color: "text-indigo-500", bg: "bg-indigo-500/10" },
            { label: "Credits Active", value: users.reduce((a, u) => a + Number(u.credits ?? 0), 0).toFixed(0), icon: Lock, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-card rounded-xl border border-border p-4 shadow-soft">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-7 h-7 rounded-lg ${stat.bg} flex items-center justify-center`}>
                    <Icon className={`w-3.5 h-3.5 ${stat.color}`} />
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{stat.label}</span>
                </div>
                <p className="text-2xl font-display font-bold text-foreground">{stat.value}</p>
              </div>
            );
          })}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="events" className="space-y-6">
          <TabsList className="bg-muted">
            <TabsTrigger value="events" className="gap-2">
              <FolderOpen className="w-4 h-4" />
              All Events
              <Badge className="ml-1 bg-primary/20 text-primary text-[10px]">{events.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" /> Users
              <Badge className="ml-1 bg-primary/20 text-primary text-[10px]">{users.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="stats" className="gap-2">
              <BarChart3 className="w-4 h-4" /> System
            </TabsTrigger>
          </TabsList>

          {/* ── Events Tab ─────────────────────────────────────────────────── */}
          <TabsContent value="events" className="space-y-3">
            {events.length === 0 ? (
              <div className="text-center py-16">
                <FolderOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No events yet</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {events.map((event) => {
                  const expired = isExpired(event.expires_at);
                  const busy = actionLoading === event.event_id;
                  return (
                    <div
                      key={event.event_id}
                      className={`bg-card rounded-xl border p-4 shadow-soft transition-all ${
                        expired ? "border-destructive/20 opacity-80" : "border-border hover:shadow-elevated"
                      }`}
                    >
                      {/* Top row */}
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${expired ? "bg-destructive/10" : "bg-primary/10"}`}>
                            <FolderOpen className={`w-5 h-5 ${expired ? "text-destructive" : "text-primary"}`} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-display font-semibold text-foreground truncate">{event.event_name}</h3>
                              <StatusBadge event={event} />
                              <Badge variant="outline" className="text-xs capitalize">{event.event_type}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {event.image_count.toLocaleString()} images · {event.face_count.toLocaleString()} faces
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              By: <span className="text-foreground font-medium">{event.creator_name ?? "—"}</span>
                              {event.creator_email ? <span className="ml-1">({event.creator_email})</span> : null}
                            </p>
                             <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground flex-wrap">
                               <span>Created: {formatDate(event.created_at)}</span>
                               {event.expires_at && (
                                 <div className="flex items-center gap-1">
                                   <Timer className={`w-3 h-3 ${getCountdown(event.expires_at).color}`} />
                                   <span className={getCountdown(event.expires_at).color}>
                                     {getCountdown(event.expires_at).text}
                                   </span>
                                   <span className="opacity-50">({formatDate(event.expires_at)})</span>
                                 </div>
                               )}
                             </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                          {!expired && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 h-8"
                              disabled={busy}
                              onClick={() => handleReindex(event)}
                            >
                              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                              Re-index
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 h-8 text-destructive hover:text-destructive hover:border-destructive/50"
                            disabled={busy}
                            onClick={() => handleDeleteEvent(event)}
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── Users Tab ──────────────────────────────────────────────────── */}
          <TabsContent value="users">
            <div className="bg-card rounded-xl border border-border shadow-soft overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name / Email</th>
                    <th className="px-4 py-3 font-medium text-center">Events</th>
                    <th className="px-4 py-3 font-medium text-center">Credits</th>
                    <th className="px-4 py-3 font-medium text-center">Used</th>
                    <th className="px-4 py-3 font-medium text-right">Spent</th>
                    <th className="px-4 py-3 font-medium text-center">Tier</th>
                    <th className="px-4 py-3 font-medium text-center">Role</th>
                    <th className="px-4 py-3 font-medium text-right">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No users found</td>
                    </tr>
                  )}
                  {users.map((u) => (
                    <tr key={u.user_id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{u.name || u.email.split("@")[0]}</div>
                        <div className="text-muted-foreground text-xs">{u.email}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="secondary" className="font-mono">
                          {events.filter(e => e.creator_email === u.email).length}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center font-mono">{Number(u.credits ?? 0).toFixed(1)}</td>
                      <td className="px-4 py-3 text-center font-mono text-muted-foreground">{Number(u.credits_used ?? 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-mono text-success">₹{Number(u.total_spent ?? 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline" className="text-xs">
                          {(u as any).tier ?? "Starter"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {u.is_admin
                          ? <Badge variant="outline" className="text-primary border-primary">Admin</Badge>
                          : <span className="text-muted-foreground text-xs">User</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">{formatDate(u.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* ── System Stats Tab ───────────────────────────────────────────── */}
          <TabsContent value="stats" className="space-y-4">

            {/* Live AWS Config — from backend env, never hardcoded */}
            <div className="bg-card rounded-xl border border-border p-6 shadow-soft">
              <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" /> AWS Configuration
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                {[
                  { label: "Region",          value: stats?.region ?? "—",        icon: Globe },
                  { label: "S3 Bucket",       value: stats?.bucket ?? "—",        icon: Database },
                  { label: "Auth Provider",   value: stats?.auth_provider ?? "—", icon: Lock },
                  { label: "Collections",     value: events.length.toString(),     icon: FolderOpen },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="rounded-lg bg-muted/60 border border-border p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                    <p className="font-mono text-foreground text-sm truncate">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Event type breakdown — dynamic from actual event data */}
            <div className="bg-card rounded-xl border border-border p-6 shadow-soft">
              <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" /> Events by Category
              </h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          borderColor: 'hsl(var(--border))',
                          borderRadius: '8px',
                          color: 'hsl(var(--foreground))'
                        }} 
                      />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
            </div>

            {/* Expired events needing cleanup */}
            {expiredEvents.length > 0 && (
              <div className="bg-card rounded-xl border border-destructive/20 p-6 shadow-soft">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-destructive" /> Expired Events Pending Cleanup
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive border-destructive/30 hover:bg-destructive/10 gap-2"
                    onClick={handleCleanup}
                    disabled={cleaningUp}
                  >
                    {cleaningUp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Run Cleanup
                  </Button>
                </div>
                <div className="space-y-2">
                  {expiredEvents.map((e) => (
                    <div key={e.event_id} className="flex items-center justify-between text-sm p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                      <div>
                        <span className="font-medium text-foreground">{e.event_name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">({e.creator_name ?? "unknown"})</span>
                      </div>
                      <span className="text-xs text-destructive">Expired {formatDate(e.expires_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
