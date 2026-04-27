import { useState, useEffect } from "react";
import { Camera, Sparkles, Image, Video, Search, Shield, Zap, ArrowRight, Users, Globe, Mail, Phone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import BrandLogo from "@/components/BrandLogo";
import LeadChatbot from "@/components/LeadChatbot";

const FEATURES = [
  {
    icon: Search,
    title: "AI Face Matching",
    description: "Upload a selfie and our AI finds every photo of you across the entire event gallery.",
  },
  {
    icon: Video,
    title: "Video Moments",
    description: "Find your appearances in event videos with AI-powered visual indexing.",
  },
  {
    icon: Zap,
    title: "Instant Results",
    description: "Get matched photos in seconds, not hours. Download individually with one tap.",
  },
  {
    icon: Shield,
    title: "Secure & Private",
    description: "Your photos are processed securely. Face data is never stored after matching.",
  },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Sign in & select event", description: "Choose your event type and provide event details." },
  { step: "02", title: "Upload or search", description: "Upload a selfie or search by name/company to find your photos." },
  { step: "03", title: "Download your photos", description: "Preview matches and download in original quality." },
];

// ─── Main Page ────────────────────────────────────────────
const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <BrandLogo className="w-10 h-10" />
          <span className="font-display text-xl font-bold tracking-tight text-foreground">Media Findr</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={() => navigate("/pricing")} className="font-medium text-muted-foreground hover:text-foreground">
            Pricing
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/register")} className="font-medium">
            Sign In
          </Button>
          <Button size="sm" onClick={() => navigate("/register")} className="font-medium gradient-primary text-primary-foreground">
            Get Started
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative max-w-5xl mx-auto px-6 pt-24 pb-32 text-center overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 blur-[100px] rounded-full pointer-events-none opacity-50 dark:opacity-20 animate-pulse"></div>
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-400/20 blur-[80px] rounded-full pointer-events-none opacity-60"></div>
        <div className="absolute bottom-10 right-10 w-72 h-72 bg-purple-400/20 blur-[80px] rounded-full pointer-events-none opacity-60"></div>

        <div className="relative z-10 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            AI-Powered Photo & Video Search
          </div>
          <h1 className="text-4xl md:text-6xl font-display font-bold text-foreground leading-tight mb-6">
            Find Your Event
            <br />
            <span className="text-primary">Photos & Videos</span>
            <br />
            In Seconds
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Whether it's a corporate gala, college fest, or awards ceremony — upload a selfie or search by name to instantly find every photo and video of you from any event.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button
              onClick={() => navigate("/register")}
              size="lg"
              className="h-14 px-8 text-base font-semibold rounded-xl gradient-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate("/pricing")}
              className="h-14 px-8 text-base font-semibold rounded-xl"
            >
              View Pricing
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-3 gap-8 max-w-xl mx-auto animate-slide-up" style={{ animationDelay: "0.2s" }}>
          {[
            { icon: Image, label: "Photos Indexed", value: "12,450+" },
            { icon: Video, label: "Video Moments", value: "850+" },
            { icon: Camera, label: "Events Covered", value: "8" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="space-y-1">
              <Icon className="w-5 h-5 text-primary mx-auto mb-2" />
              <div className="text-2xl font-display font-bold text-foreground">{value}</div>
              <div className="text-sm text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works - Premium Animated */}
      <section className="relative bg-muted/30 border-y border-border py-24 overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/10 blur-[100px] rounded-[100%] pointer-events-none"></div>
        
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 text-primary text-sm font-semibold tracking-wider uppercase mb-4 border border-primary/20">
              Workflow
            </span>
            <h2 className="text-4xl font-display font-bold text-foreground mt-2">How it works</h2>
          </div>
          
          <div className="relative">
            {/* Connecting Line (Desktop) */}
            <div className="hidden md:block absolute top-12 left-[10%] right-[10%] h-0.5 bg-border">
              <div className="absolute top-0 left-0 h-full w-full bg-gradient-to-r from-transparent via-primary to-transparent opacity-50 animate-pulse"></div>
            </div>

            <div className="grid md:grid-cols-3 gap-10">
              {HOW_IT_WORKS.map((item, idx) => (
                <div key={item.step} className="relative z-10 text-center group">
                  {/* Step Number Badge */}
                  <div className="relative w-24 h-24 mx-auto mb-8">
                    {/* Glowing outer ring */}
                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse-glow group-hover:bg-primary/30 transition-colors"></div>
                    <div className="absolute inset-2 rounded-full gradient-primary text-primary-foreground flex items-center justify-center text-2xl font-bold font-display shadow-glow">
                      {item.step}
                    </div>
                  </div>
                  
                  {/* Card */}
                  <div className="rounded-2xl border border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-xl p-8 shadow-soft transition-transform group-hover:-translate-y-2 group-hover:shadow-elevated">
                    <h3 className="font-display text-xl font-bold text-foreground mb-3">{item.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Features</span>
            <h2 className="text-3xl font-display font-bold text-foreground mt-2">Everything you need</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="rounded-2xl border border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-xl p-8 shadow-soft hover:shadow-elevated transition-all hover:-translate-y-1 group">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 transition-transform group-hover:scale-110">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-foreground mb-3">{f.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{f.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Event Types */}
      <section className="bg-muted/50 border-y border-border py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Use Cases</span>
            <h2 className="text-3xl font-display font-bold text-foreground mt-2">For every kind of event</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Users, label: "Corporate Events" },
              { icon: Sparkles, label: "Awards & Galas" },
              { icon: Globe, label: "College Fests" },
              { icon: Camera, label: "Weddings & Ceremonies" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/50 dark:bg-black/50 backdrop-blur-md p-6 text-center shadow-soft hover:shadow-elevated transition-all hover:-translate-y-1">
                <Icon className="w-8 h-8 text-primary mx-auto mb-4" />
                <p className="font-semibold text-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-display font-bold text-foreground mb-4">
            Ready to find your photos?
          </h2>
          <p className="text-muted-foreground mb-8">
            Sign up in seconds and start finding your event photos with AI-powered search.
          </p>
          <Button
            onClick={() => navigate("/register")}
            size="lg"
            className="h-14 px-10 text-base font-semibold rounded-xl gradient-primary text-primary-foreground"
          >
            Get Started Free
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-6 bg-muted/30">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8 items-center md:items-start text-center md:text-left">
          
          {/* Brand */}
          <div className="space-y-3">
            <div className="flex items-center justify-center md:justify-start gap-3">
              <BrandLogo className="w-8 h-8" />
              <span className="text-lg font-display font-bold text-foreground">Media Findr</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-[250px] mx-auto md:mx-0">
              The smartest way to find and deliver event photos using AI.
            </p>
          </div>

          {/* Contact */}
          <div className="space-y-3">
            <h4 className="font-semibold text-foreground">Contact Us</h4>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <a href="mailto:hello@theaiproductfactory.com" className="flex items-center justify-center md:justify-start gap-2 hover:text-primary transition-colors">
                <Mail className="w-4 h-4" />
                hello@theaiproductfactory.com
              </a>
              <a href="tel:+917456854201" className="flex items-center justify-center md:justify-start gap-2 hover:text-primary transition-colors">
                <Phone className="w-4 h-4" />
                +91 74568 54201
              </a>
            </div>
          </div>

          {/* Copyright */}
          <div className="md:text-right space-y-3">
            <p className="text-sm text-muted-foreground">
              © 2026 Media Findr. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground">
              Powered by <span className="font-semibold text-foreground">The AI Product Factory</span>
            </p>
          </div>

        </div>
      </footer>

      {/* Lead Capture Chatbot */}
      <LeadChatbot />
    </div>
  );
};

export default Index;
