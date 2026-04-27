"use client";

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Camera,
  ArrowRight,
  Briefcase,
  Heart,
  GraduationCap,
  PartyPopper,
  LogOut,
  Loader2,
  Gift,
  CreditCard,
  Image,
  Plus,
  Search,
  Sparkles,
  FolderOpen,
  CheckCircle2,
  Clock,
  Share2,
  Download,
  X,
  Link,
  QrCode,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ThemeToggle from "@/components/ThemeToggle";
import BrandLogo from "@/components/BrandLogo";
import ImageUploadZone from "@/components/ImageUploadZone";
import { useToast } from "@/hooks/use-toast";
import {
  cognitoGetCurrentUser,
  cognitoGetUserAttributes,
  cognitoSignOut,
} from "@/integrations/aws/auth";
import {
  getUserProfile,
  createEvent,
  uploadImages,
  getUserEvents,
  getEventGuests,
  type UserProfile,
  type CreateEventResponse,
  type EventInfo,
} from "@/integrations/aws/api";

function isExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
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

const EVENT_TYPES = [
  { id: "corporate", label: "Corporate", icon: Briefcase, color: "from-blue-500 to-indigo-600" },
  { id: "college", label: "College", icon: GraduationCap, color: "from-emerald-500 to-teal-600" },
  { id: "wedding", label: "Wedding", icon: Heart, color: "from-pink-500 to-rose-600" },
  { id: "anniversary", label: "Anniversary", icon: Gift, color: "from-amber-500 to-orange-600" },
  { id: "festive", label: "Festive", icon: PartyPopper, color: "from-purple-500 to-violet-600" },
  { id: "custom", label: "Custom Event", icon: Sparkles, color: "from-slate-600 to-slate-900" },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [dashView, setDashView] = useState<"new" | "events">("events");
  const [step, setStep] = useState<"select" | "details">("select");
  const [eventName, setEventName] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [createdEvent, setCreatedEvent] = useState<CreateEventResponse | null>(null);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [userEvents, setUserEvents] = useState<EventInfo[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  const [shareEvent, setShareEvent] = useState<EventInfo | null>(null);
  const [analyticsEvent, setAnalyticsEvent] = useState<EventInfo | null>(null);
  const [guests, setGuests] = useState<any[]>([]);
  const [loadingGuests, setLoadingGuests] = useState(false);

  const eventLink = shareEvent ? `${window.location.origin}/results?event_id=${shareEvent.event_id}` : "";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(eventLink);
    toast({ title: "Link Copied!", description: "Guest link copied to clipboard." });
  };


  useEffect(() => {
    const checkAuth = async () => {
      const user = await cognitoGetCurrentUser();
      if (!user) {
        navigate("/register");
        return;
      }

      const attrs = await cognitoGetUserAttributes();
      setUserEmail(attrs?.email || "");

      try {
        const p = await getUserProfile();
        setProfile(p);
        const displayName = p.name || attrs?.name || attrs?.email?.split("@")[0] || "User";
        setUserName(displayName);
      } catch (err) {
        console.error("Failed to load profile:", err);
        const displayName = attrs?.name || attrs?.email?.split("@")[0] || "User";
        setUserName(displayName);
      }

      // Load user events
      try {
        const eventsData = await getUserEvents();
        setUserEvents(eventsData.events || []);
      } catch (err) {
        console.error("Failed to load events:", err);
      } finally {
        setLoadingEvents(false);
      }
    };

    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (analyticsEvent) {
      const fetchGuests = async () => {
        setLoadingGuests(true);
        try {
          const data = await getEventGuests(analyticsEvent.event_id);
          setGuests(data.guests || []);
        } catch (err) {
          console.error("Failed to fetch guests:", err);
        } finally {
          setLoadingGuests(false);
        }
      };
      fetchGuests();
    } else {
      setGuests([]);
    }
  }, [analyticsEvent]);

  const handleLogout = async () => {
    try {
      await cognitoSignOut();
      toast({ title: "Signed out", description: "See you soon!" });
      navigate("/");
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Logout failed",
        variant: "destructive",
      });
    }
  };

  const handleCreateEvent = async () => {
    if (!eventName.trim() || !selectedType) {
      toast({
        title: "Missing info",
        description: "Select event type & enter name",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const result = await createEvent(eventName, selectedType);
      setCreatedEvent(result);
      toast({ title: "Event created!", description: `ID: ${result.event_id}` });

      const p = await getUserProfile();
      setProfile(p);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create event",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleUpload = async () => {
    if (!createdEvent || uploadedFiles.length === 0) {
      toast({
        title: "No files",
        description: "Upload at least one photo",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const result = await uploadImages(createdEvent.event_id, uploadedFiles);
      setUploaded(true);
      toast({
        title: "Upload complete!",
        description: `${result.uploaded} images uploaded, ${result.faces_indexed} faces indexed`,
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Upload failed",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const credits = profile?.credits ?? 0;
  const displayCredits = Number(credits).toFixed(2);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate("/")}>
          <BrandLogo className="w-8 h-8" />
          <span className="font-display text-lg font-bold text-foreground">Media Findr</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-destructive"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </nav>

      {/* User header card */}
      <div className="px-6 pt-6">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Avatar */}
            <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-lg flex-shrink-0">
              {userName.charAt(0).toUpperCase()}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-display font-bold text-foreground truncate max-w-[200px] sm:max-w-[300px]">
                  Welcome back, {userName}
                </h2>
                {profile?.is_admin && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">
                    Admin
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-muted-foreground truncate">{userEmail}</p>
              </div>
            </div>
            {/* Credits badge + upgrade + admin link */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 flex-shrink-0 mt-2 sm:mt-0">
              {profile?.is_admin && (
                <Button
                  size="sm"
                  variant="default"
                  className="font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
                  onClick={() => navigate("/admin")}
                >
                  Admin Panel
                </Button>
              )}
              <div className="flex items-center gap-2 px-3 py-2 sm:px-4 rounded-xl bg-primary/10 border border-primary/20">
                <CreditCard className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold text-primary whitespace-nowrap">{displayCredits} credits</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 font-semibold"
                onClick={() => navigate("/pricing")}
              >
                <Plus className="w-3.5 h-3.5" />
                Upgrade
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col p-6 pt-4">
        {/* Tab bar */}
        <div className="max-w-3xl mx-auto w-full mb-6">
          <div className="flex gap-1 bg-muted rounded-xl p-1">
            <button
              onClick={() => setDashView("events")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                dashView === "events"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              My Events
              {userEvents.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-primary/10 text-primary">
                  {userEvents.length}
                </span>
              )}
            </button>
            <button
              onClick={() => { setDashView("new"); setStep("select"); setCreatedEvent(null); setUploaded(false); }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                dashView === "new"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Plus className="w-4 h-4" />
              New Event
            </button>
          </div>
        </div>

        {/* My Events view */}
        {dashView === "events" ? (
          <div className="max-w-3xl mx-auto w-full space-y-4 animate-fade-in">
            {loadingEvents ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : userEvents.length === 0 ? (
              <div className="text-center py-16 space-y-4">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-muted flex items-center justify-center">
                  <FolderOpen className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-lg font-display font-bold text-foreground">No events yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Create your first event to get started</p>
                </div>
                <Button
                  onClick={() => { setDashView("new"); setStep("select"); }}
                  className="gap-2 gradient-primary text-primary-foreground font-semibold"
                >
                  <Plus className="w-4 h-4" />
                  Create Event
                </Button>
              </div>
            ) : (
              <div className="grid gap-3">
                {userEvents.map((event) => {
                  const typeInfo = EVENT_TYPES.find((t) => t.id === event.event_type);
                  const Icon = typeInfo?.icon || Sparkles;
                  const expired = isExpired(event.expires_at);

                  return (
                    <div
                      key={event.event_id}
                      className={`bg-card rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-4 transition-all group ${
                        expired ? "border-destructive/20 opacity-80" : "border-border shadow-soft hover:shadow-elevated"
                      }`}
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 ${
                          expired ? "bg-destructive/10" : `bg-gradient-to-br ${typeInfo?.color || "from-slate-500 to-slate-700"}`
                        }`}>
                          <Icon className={`w-5 h-5 ${expired ? "text-destructive" : "text-white"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display font-semibold text-foreground truncate">{event.event_name}</h3>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                              expired 
                                ? "bg-destructive/10 text-destructive border border-destructive/20"
                                : event.status === "active"
                                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                            }`}>
                              {expired ? "Expired" : event.status}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {event.image_count} images • {event.face_count} faces
                            {event.expires_at && (
                              <span className="ml-1">
                                • Expires: {new Date(event.expires_at).toLocaleDateString()}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-primary"
                          onClick={() => setAnalyticsEvent(event)}
                        >
                          <Users className="w-3.5 h-3.5" />
                          Analytics
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-xs"
                          onClick={() => setShareEvent(event)}
                          disabled={expired}
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          Share
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 gap-1.5 text-xs gradient-primary text-primary-foreground font-semibold"
                          onClick={() => navigate(`/results?event_id=${event.event_id}`)}
                          disabled={expired}
                        >
                          <Search className="w-3.5 h-3.5" />
                          Search
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : step === "select" ? (
          <div className="w-full max-w-3xl mx-auto space-y-8 animate-fade-in">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                New Event
              </span>
              <h1 className="text-3xl font-display font-bold text-foreground">
                What type of event?
              </h1>
              <p className="text-muted-foreground mt-1">Select the event category to get started</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {EVENT_TYPES.map((evt, idx) => {
                const Icon = evt.icon;
                const isSelected = selectedType === evt.id;
                return (
                  <button
                    key={evt.id}
                    onClick={() => setSelectedType(evt.id)}
                    className={`rounded-xl border p-5 text-center transition-all duration-300 hover:shadow-elevated group ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-glow -translate-y-1"
                        : "border-border bg-card shadow-soft hover:border-primary/30 hover:-translate-y-1"
                    }`}
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div
                      className={`w-14 h-14 rounded-xl mx-auto mb-4 flex items-center justify-center bg-gradient-to-br ${evt.color} transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-soft`}
                    >
                      <Icon className={`w-6 h-6 text-white ${isSelected ? 'animate-bounce' : 'group-hover:animate-bounce'}`} />
                    </div>
                    <p
                      className={`font-semibold ${
                        isSelected ? "text-primary" : "text-foreground group-hover:text-primary"
                      }`}
                    >
                      {evt.label}
                    </p>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-center">
              <Button
                disabled={!selectedType}
                onClick={() => setStep("details")}
                className="h-12 px-8 font-semibold gradient-primary text-primary-foreground gap-2"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-2xl mx-auto space-y-6 animate-fade-in">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm">
              <button onClick={() => { setStep("select"); setCreatedEvent(null); setUploaded(false); }} className="text-primary hover:underline font-medium">
                Events
              </button>
              <span className="text-muted-foreground">/</span>
              <span className="text-foreground font-medium capitalize">{selectedType}</span>
            </div>

            <div className="text-center">
              <h1 className="text-2xl font-display font-bold text-foreground">
                Setup & Upload
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Configure your event and upload photos</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase">
                  Event Name
                </Label>
                <Input
                  placeholder="e.g. Annual Summit 2026"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="h-11"
                  disabled={!!createdEvent}
                />
              </div>

              {/* Info bar */}
              <div className="rounded-xl border border-border bg-muted/50 p-4 flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-primary" />
                  <span className="text-foreground font-medium">{displayCredits} credits remaining</span>
                </div>
                <div className="w-px h-4 bg-border hidden sm:block" />
                <div className="flex items-center gap-2">
                  <Image className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">0.01 credits per image</span>
                </div>
                <div className="w-px h-4 bg-border hidden sm:block" />
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{uploadedFiles.length} selected</span>
                </div>
              </div>

              <ImageUploadZone
                files={uploadedFiles}
                onFilesChange={setUploadedFiles}
                max={500}
              />
            </div>

            {!createdEvent ? (
              <Button
                onClick={handleCreateEvent}
                disabled={creating || !eventName.trim()}
                className="w-full h-12 font-semibold gradient-primary text-primary-foreground gap-2"
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Event
              </Button>
            ) : !uploaded ? (
              <Button
                onClick={handleUpload}
                disabled={uploading || uploadedFiles.length === 0}
                className="w-full h-12 font-semibold gradient-primary text-primary-foreground gap-2"
              >
                {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
                Upload {uploadedFiles.length} Images
              </Button>
            ) : (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Search className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-display font-bold text-foreground">Upload complete!</p>
                  <p className="text-sm text-muted-foreground mt-1">Your event is indexed and ready for face search.</p>
                </div>
                <Button
                  onClick={() => navigate(`/results?event_id=${createdEvent.event_id}`)}
                  className="h-12 w-full font-semibold gradient-primary text-primary-foreground gap-2"
                >
                  Go to Search
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-4 px-6">
        <p className="text-center text-xs text-muted-foreground">
          Powered by <span className="font-semibold text-foreground">The AI Product Factory</span>
        </p>
      </footer>

      {/* Share Modal */}
      {shareEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border shadow-elevated rounded-2xl w-full max-w-sm overflow-hidden animate-scale-in">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-display font-bold text-foreground flex items-center gap-2">
                <Share2 className="w-4 h-4 text-primary" />
                Share Event
              </h3>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setShareEvent(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-6 flex flex-col items-center">
              <h4 className="font-semibold text-lg text-center mb-1">{shareEvent.event_name}</h4>
              <p className="text-sm text-muted-foreground text-center mb-6">Scan QR code to access guest search</p>
              
              <div className="bg-white p-3 rounded-xl border-2 border-primary/20 shadow-glow mb-6">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(eventLink)}`}
                  alt="Event QR Code" 
                  className="w-48 h-48"
                />
              </div>

              <div className="w-full">
                <Label className="text-xs text-muted-foreground mb-1 block">Guest Link</Label>
                <div className="flex items-center gap-2">
                  <Input readOnly value={eventLink} className="h-9 text-xs font-mono bg-muted" />
                  <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={handleCopyLink}>
                    <Link className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="p-4 bg-muted/50 border-t border-border flex justify-end">
              <Button onClick={() => setShareEvent(null)}>Done</Button>
            </div>
          </div>
        </div>
      )}
      {/* Share Modal ... */}

      {/* Analytics Modal */}
      {analyticsEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border shadow-elevated rounded-2xl w-full max-w-2xl overflow-hidden animate-scale-in">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-foreground flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Guest Search Analytics
                </h3>
                <p className="text-xs text-muted-foreground">{analyticsEvent.event_name}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-1.5"
                  disabled={guests.length === 0}
                  onClick={() => csvDownload(`${analyticsEvent.event_name}_guests.csv`, guests)}
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setAnalyticsEvent(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="p-0 max-h-[60vh] overflow-y-auto">
              {loadingGuests ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : guests.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No guest searches recorded yet.</p>
                </div>
              ) : (
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-muted-foreground border-b border-border">Guest Name</th>
                      <th className="px-4 py-3 font-semibold text-muted-foreground border-b border-border">Phone Number</th>
                      <th className="px-4 py-3 font-semibold text-muted-foreground border-b border-border text-center">Searches</th>
                      <th className="px-4 py-3 font-semibold text-muted-foreground border-b border-border">Last Search</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {guests.map((guest, idx) => (
                      <tr key={idx} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{guest.name}</td>
                        <td className="px-4 py-3 font-mono text-xs">{guest.phone}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold text-[10px]">
                            {guest.search_count || 0}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {guest.last_search ? new Date(guest.last_search).toLocaleString() : "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            <div className="p-4 bg-muted/50 border-t border-border flex justify-end">
              <Button onClick={() => setAnalyticsEvent(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;