import React, { useState, useRef, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  Camera,
  Loader2,
  Upload,
  Search,
  AlertCircle,
  CheckCircle2,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import ThemeToggle from "@/components/ThemeToggle";
import BrandLogo from "@/components/BrandLogo";
import ImageLightbox from "@/components/ImageLightbox";
import TipsCard from "@/components/TipsCard";
import { searchByImage, type SearchResult, type SearchResponse, apiRequest } from "@/integrations/aws/api";
import { useToast } from "@/hooks/use-toast";

/** Persist a stable guest device ID in localStorage */
function getOrCreateGuestId(): string {
  const key = "agba_guest_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

const COUNTRY_CODES = [
  { code: "+91", country: "India", length: 10 },
  { code: "+1", country: "USA", length: 10 },
  { code: "+44", country: "UK", length: 10 },
  { code: "+971", country: "UAE", length: 9 },
  { code: "+61", country: "Australia", length: 9 },
  { code: "+65", country: "Singapore", length: 8 },
  { code: "+49", country: "Germany", length: 11 },
  { code: "+33", country: "France", length: 9 },
  { code: "+81", country: "Japan", length: 10 },
  { code: "+86", country: "China", length: 11 },
];

const Results = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const eventId = searchParams.get("event_id") || "";

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [rateLimited, setRateLimited] = useState(false);

  // Identity state
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [name, setName] = useState("");
  const [step, setStep] = useState<"choice" | "onboarding" | "searching" | "upload">("choice");
  const [eventInfo, setEventInfo] = useState<{ event_name: string } | null>(null);

  // Guest details state
  const guestId = getOrCreateGuestId();

  // Fetch Event Info on mount
  useEffect(() => {
    if (eventId) {
      apiRequest<{ event_name: string }>(`/events/${eventId}/info`, { method: "GET" }, false)
        .then(setEventInfo)
        .catch(console.error);
    }
  }, [eventId]);

  // Trim phone if country code changes
  useEffect(() => {
    const config = COUNTRY_CODES.find(c => c.code === countryCode);
    if (config && phone.length > config.length) {
      setPhone(phone.slice(0, config.length));
    }
  }, [countryCode]);


  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelfie(file);
    setSelfiePreview(URL.createObjectURL(file));
    setSearchDone(false);
    setResponse(null);
  };

  const handleCheckGuest = async () => {
    // Clean phone number (remove any spaces or dashes)
    const cleanPhone = phone.replace(/\D/g, "");
    const expectedLength = COUNTRY_CODES.find(c => c.code === countryCode)?.length || 10;

    if (!cleanPhone || cleanPhone.length !== expectedLength) {
      toast({ 
        title: "Invalid phone number", 
        description: `For ${countryCode}, the phone number must be exactly ${expectedLength} digits.`, 
        variant: "destructive" 
      });
      return;
    }

    const fullPhone = `${countryCode}${cleanPhone}`;

    setSearching(true);
    try {
      const formData = new FormData();
      formData.append("phone", fullPhone);
      formData.append("guest_id", guestId);

      const result = await apiRequest<any>(`/events/${eventId}/check-guest`, {
        method: "POST",
        body: formData,
      }, false);

      if (result.found) {
        setResponse(result);
        setSearchDone(true);
        toast({ title: `Welcome back, ${result.name || "Guest"}!`, description: `Found ${result.total_matches} photos.` });
      } else {
        setStep("upload");
        toast({ title: "New around here?", description: "Upload a selfie to find your photos for the first time." });
      }
    } catch (err) {
      toast({ title: "Check failed", description: "Please try uploading a selfie instead.", variant: "destructive" });
      setStep("upload");
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = async () => {
    if (!selfie || !eventId) {
      toast({
        title: "Missing info",
        description: !eventId ? "No event selected" : "Upload a selfie first",
        variant: "destructive",
      });
      return;
    }

    const cleanPhone = phone.replace(/\D/g, "");
    const expectedLength = COUNTRY_CODES.find(c => c.code === countryCode)?.length || 10;

    if (!cleanPhone || cleanPhone.length !== expectedLength) {
      toast({ 
        title: "Invalid phone number", 
        description: `For ${countryCode}, the phone number must be exactly ${expectedLength} digits.`, 
        variant: "destructive" 
      });
      return;
    }

    const fullPhone = `${countryCode}${cleanPhone}`;
    setSearching(true);
    setRateLimited(false);

    try {
      const result = await searchByImage(
        eventId,
        selfie,
        guestId,
        name || "Guest",
        fullPhone,
      );
      setResponse(result);
      setSearchDone(true);

      if (result.total_matches === 0) {
        toast({ title: "No matches", description: "Try a different photo with better lighting" });
      } else {
        toast({ title: `Found ${result.total_matches} matches!` });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Please try again";
      if (msg.includes("429") || msg.toLowerCase().includes("maximum")) {
        setRateLimited(true);
        toast({
          title: "Search limit reached",
          description: "You have used all 3 searches for this event.",
          variant: "destructive",
        });
      } else if (msg.includes("expired")) {
        toast({
          title: "Event expired",
          description: "This event's photo gallery is no longer available.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Search failed",
          description: msg,
          variant: "destructive",
        });
      }
    } finally {
      setSearching(false);
    }
  };

  const handleDownload = (result: SearchResult) => {
    window.open(result.downloadUrl, "_blank");
  };

  const results = response?.results || [];

  const lightboxItems = results.map((r) => ({
    id: r.id,
    fileName: r.fileName,
    similarity: r.similarity,
    type: "image" as const,
    url: r.url,
    downloadUrl: r.downloadUrl,
    date: "",
  }));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="mr-2">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2 border-l border-border pl-4">
              <BrandLogo className="w-6 h-6" />
              <div>
                <h1 className="font-display font-bold text-foreground text-lg leading-tight truncate max-w-[200px] sm:max-w-md">
                  {response?.event_name || eventInfo?.event_name || "Find Your Photos"}
                </h1>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                  {searchDone ? `${results.length} matches found` : "Live Gallery"}
                </p>
              </div>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">

        {/* Rate Limited Banner */}
        {rateLimited && (
          <div className="max-w-md mx-auto mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-destructive text-sm">Search limit reached</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                You've used all 3 searches for this event. Contact the event organiser if you need help.
              </p>
            </div>
          </div>
        )}

        {/* Onboarding / Search Section */}
        {!searchDone && !rateLimited && (
          <div className="max-w-md mx-auto space-y-6 animate-fade-in">
            {step === "choice" ? (
              <div className="space-y-6 bg-card border border-border p-8 rounded-2xl shadow-elevated">
                <div className="text-center">
                  <h2 className="text-2xl font-display font-bold text-foreground mb-2">
                    How would you like to search?
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    Select an option to find your photos in this event.
                  </p>
                </div>
                <div className="grid gap-4">
                  <Button
                    variant="outline"
                    className="h-20 justify-start px-6 rounded-xl hover:border-primary transition-all group"
                    onClick={() => setStep("onboarding")}
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                      <Phone className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-foreground">Phone Number</p>
                      <p className="text-xs text-muted-foreground italic">Fastest for returning users</p>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    className="h-20 justify-start px-6 rounded-xl hover:border-primary transition-all group"
                    onClick={() => setStep("upload")}
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                      <Camera className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-foreground">Upload Selfie</p>
                      <p className="text-xs text-muted-foreground italic">Best for first-time search</p>
                    </div>
                  </Button>
                </div>
              </div>
            ) : step === "onboarding" ? (
              <div className="space-y-6 bg-card border border-border p-8 rounded-2xl shadow-elevated">
                <div className="text-center">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Phone className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-2xl font-display font-bold text-foreground mb-2">
                    Phone Search
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    Enter your phone number to check if we've already found you.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="flex gap-2">
                      <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="flex h-12 w-24 rounded-xl border border-input bg-card px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.code} ({c.country})
                          </option>
                        ))}
                      </select>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="Mobile number"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, COUNTRY_CODES.find(c => c.code === countryCode)?.length || 15))}
                        className="h-12 flex-1 text-lg font-medium tracking-wider"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleCheckGuest}
                    disabled={searching || !phone}
                    className="w-full h-12 text-base font-semibold rounded-xl gradient-primary"
                  >
                    {searching ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Search className="w-5 h-5 mr-2" />}
                    {searching ? "Checking..." : "Continue"}
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full text-xs"
                    onClick={() => setStep("choice")}
                  >
                    Change method
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6 animate-slide-up">
                <div className="text-center">
                  <h2 className="text-2xl font-display font-bold text-foreground mb-2">
                    Upload a Selfie
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    We'll link this photo to your phone number for future searches.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name (Optional)</Label>
                    <Input
                      id="name"
                      placeholder="Enter your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone-link">Phone Number (Required)</Label>
                    <div className="flex gap-2">
                      <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="flex h-10 w-20 rounded-md border border-input bg-card px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.code}
                          </option>
                        ))}
                      </select>
                      <Input
                        id="phone-link"
                        type="tel"
                        placeholder="Mobile number"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, COUNTRY_CODES.find(c => c.code === countryCode)?.length || 15))}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  {/* Selfie Upload */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors bg-muted/20"
                  >
                    {selfiePreview ? (
                      <div className="flex flex-col items-center gap-3">
                        <img
                          src={selfiePreview}
                          alt="Your selfie"
                          className="w-32 h-32 rounded-xl object-cover border border-border"
                        />
                        <p className="text-sm text-muted-foreground">Tap to change photo</p>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm font-medium text-foreground">
                          Tap to upload a selfie
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Clear, front-facing photos work best
                        </p>
                      </>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="user"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </div>

                  <TipsCard />

                  <Button
                    onClick={handleSearch}
                    disabled={!selfie || searching || !phone}
                    className="w-full h-14 text-base font-semibold rounded-xl gradient-primary text-primary-foreground gap-2"
                  >
                    {searching ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Search className="w-5 h-5" />
                    )}
                    {searching ? "Searching..." : "Find My Photos"}
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    className="w-full"
                    onClick={() => setStep("choice")}
                  >
                    Go Back
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results Grid */}
        {searchDone && (
          <>
            {results.length === 0 ? (
              <div className="text-center py-20 animate-fade-in">
                <Camera className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h2 className="font-display text-xl font-semibold text-foreground mb-2">
                  No matches found
                </h2>
                <p className="text-muted-foreground mb-6">
                  Try uploading a different photo with better lighting
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchDone(false);
                    setResponse(null);
                    setSelfie(null);
                    setSelfiePreview(null);
                  }}
                >
                  Try Again
                </Button>
              </div>
            ) : (
              <div className="space-y-6 animate-fade-in">
                {/* Action Bar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-success" />
                    <span className="text-sm font-medium text-foreground">
                      {results.length} photo{results.length !== 1 ? "s" : ""} found
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchDone(false);
                      setResponse(null);
                      setSelfie(null);
                      setSelfiePreview(null);
                      setStep("choice"); // Go back to choice
                    }}
                  >
                    Search Again
                  </Button>
                </div>

                {/* Photo Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {results.map((result, idx) => (
                    <div
                      key={result.id}
                      className="group relative rounded-xl overflow-hidden border border-border bg-card shadow-soft hover:shadow-medium transition-all cursor-pointer animate-fade-in"
                      style={{ animationDelay: `${idx * 0.05}s` }}
                      onClick={() => setLightboxIndex(idx)}
                    >
                      <div className="aspect-[4/3] bg-muted">
                        <img
                          src={result.url}
                          alt={result.fileName}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>

                      <div className="absolute top-2 left-2">
                        <Badge
                          className={`text-xs font-bold ${
                            result.similarity >= 95
                              ? "bg-success text-success-foreground"
                              : result.similarity >= 85
                              ? "bg-primary text-primary-foreground"
                              : "bg-warning text-warning-foreground"
                          }`}
                        >
                          {result.similarity}%
                        </Badge>
                      </div>

                      <button
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-card/80 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(result);
                        }}
                      >
                        <Download className="w-4 h-4 text-foreground" />
                      </button>

                      <div className="p-3">
                        <p className="text-sm font-medium text-foreground truncate">
                          {result.fileName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {result.similarity}% match
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <ImageLightbox
          items={lightboxItems}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  );
};

export default Results;
