import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Zap, Star, Crown, ArrowLeft, Rocket, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import BrandLogo from "@/components/BrandLogo";
import LeadChatbot from "@/components/LeadChatbot";
import { useToast } from "@/components/ui/use-toast";
import { createPaymentOrder, verifyPayment } from "@/integrations/aws/api";

const CREDIT_PLANS = [
  {
    name: "Starter",
    credits: 3,
    images: "300",
    price: "₹399",
    pricePerCredit: "₹133",
    icon: Zap,
    accent: false,
    features: [
      "AI face matching",
      "Original quality downloads",
      "15-day access to results",
      "Email support",
      "1 Credit = 100 Images",
    ],
  },
  {
    name: "Growth",
    credits: 10,
    images: "1,000",
    price: "₹999",
    pricePerCredit: "₹99",
    icon: Star,
    accent: false,
    features: [
      "AI face matching",
      "HD downloads",
      "15-day access to results",
      "Priority email support",
      "Event analytics",
      "1 Credit = 100 Images",
    ],
  },
  {
    name: "Pro",
    credits: 25,
    images: "2,500",
    price: "₹2399",
    pricePerCredit: "₹96",
    icon: Crown,
    accent: true,
    badge: "Most Popular",
    features: [
      "AI face matching",
      "HD downloads",
      "15-day access to results (Upgradable)",
      "Priority support",
      "Custom branding",
      "Event analytics",
      "1 Credit = 100 Images",
    ],
  },
  {
    name: "Business",
    credits: 100,
    images: "10,000",
    price: "₹8999",
    pricePerCredit: "₹89",
    icon: Rocket,
    accent: false,
    features: [
      "AI face matching",
      "4K downloads",
      "30-day default access (Up to 1 year)",
      "Dedicated support",
      "Custom branding",
      "API access",
      "1 Credit = 100 Images",
    ],
  },
];

const FAQS = [
  {
    q: "What exactly is a credit?",
    a: "1 credit allows you to upload and index up to 100 event images. For example, if your event has 250 photos, you'll use 2.5 credits. Credits are consumed as images are processed — you're only charged for what you use.",
  },
  {
    q: "Do credits expire?",
    a: "No! Credits never expire. Buy them once and use them whenever you need — whether it's today or months from now.",
  },
  {
    q: "How does the face matching work?",
    a: "After uploading event images, attendees simply take a selfie. Our AI powered by AWS Rekognition matches their face against every photo in the gallery and returns all matches in seconds.",
  },
  {
    q: "Can I use remaining credits for a different event?",
    a: "Absolutely. Credits are tied to your account, not to a specific event. Any unused credits carry over to your next event automatically.",
  },
  {
    q: "What happens if I run out of credits mid-event?",
    a: "You can purchase additional credits anytime from this page. New credits are added to your account instantly — no interruption to your event.",
  },
  {
    q: "Is there a free trial?",
    a: "Every new account gets 1 free credit (100 images) to try the platform. No credit card required — just sign up and start your first event.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We use Razorpay, which supports UPI, credit/debit cards, net banking, and popular wallets like Paytm and PhonePe.",
  },
  {
    q: "Can I get a refund?",
    a: "Unused credits are non-refundable but never expire. If you have any issues, reach out via the chat widget and our team will help.",
  },
];

const Pricing = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleBuy = async (plan: typeof CREDIT_PLANS[0]) => {
    setLoadingPlan(plan.name);
    try {
      const amount = parseInt(plan.price.replace("₹", "").replace(",", ""));
      const order = await createPaymentOrder(amount, plan.credits);

      const options = {
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "Media Findr",
        description: `Purchase ${plan.credits} Credits`,
        order_id: order.id,
        handler: async function (response: any) {
          try {
            await verifyPayment(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature,
              amount,
              plan.credits
            );
            toast({ title: "Payment Successful", description: `Added ${plan.credits} credits to your account.` });
            navigate("/dashboard");
          } catch (err: any) {
            toast({ title: "Payment Verification Failed", description: err.message, variant: "destructive" });
          }
        },
        theme: {
          color: "#4f46e5",
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", function (response: any) {
        toast({ title: "Payment Failed", description: response.error.description, variant: "destructive" });
      });
      rzp.open();
    } catch (err: any) {
      toast({ title: "Checkout Error", description: err.message, variant: "destructive" });
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate("/")}>
          <BrandLogo className="w-8 h-8" />
          <span className="font-display text-lg font-bold text-foreground">Media Findr</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <ThemeToggle />
        </div>
      </nav>

      {/* Hero */}
      <div className="text-center pt-12 pb-8 px-6">
        <span className="inline-block text-xs font-semibold uppercase tracking-wider text-primary mb-3">
          Credits & Pricing
        </span>
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-3">
          Pay only for what you use
        </h1>
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest border border-primary/20">
            1 Credit = 100 Images
          </div>
        </div>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Simple, transparent pricing. Buy credits in bulk and save more. Credits never expire and can be used across multiple events.
        </p>
      </div>

      {/* Plans */}
      <div className="px-6 pb-10">
        <div className="max-w-6xl mx-auto grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {CREDIT_PLANS.map((plan) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.name}
                className={`relative rounded-2xl border p-6 flex flex-col transition-all ${
                  plan.accent
                    ? "border-primary bg-primary/5 shadow-glow ring-1 ring-primary/20 scale-[1.02]"
                    : "border-border bg-card shadow-soft"
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-bold uppercase tracking-wider gradient-primary text-primary-foreground px-3 py-1 rounded-full">
                    {plan.badge}
                  </span>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${plan.accent ? "gradient-primary" : "bg-muted"}`}>
                    <Icon className={`w-5 h-5 ${plan.accent ? "text-primary-foreground" : "text-foreground"}`} />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-foreground text-lg">{plan.name}</h3>
                    <p className="text-xs text-muted-foreground">{plan.credits} credits · {plan.images} images</p>
                  </div>
                </div>

                <div className="mb-5">
                  <span className="text-3xl font-display font-bold text-foreground">{plan.price}</span>
                  <span className="text-sm text-muted-foreground ml-2">({plan.pricePerCredit}/credit)</span>
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full h-11 font-semibold ${
                    plan.accent
                      ? "gradient-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                  onClick={() => handleBuy(plan)}
                  disabled={loadingPlan !== null}
                >
                  {loadingPlan === plan.name ? "Processing..." : `Buy ${plan.credits} Credits`}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Custom / Enterprise */}
        <div className="max-w-3xl mx-auto mt-10">
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-soft flex flex-col sm:flex-row items-center gap-6">
            <div className="flex-1">
              <h3 className="text-xl font-display font-bold text-foreground mb-2">Need more? Custom plans available</h3>
              <p className="text-sm text-muted-foreground">
                Hosting a large conference, festival, or multi-day event? We offer custom volume pricing for 100+ credits with dedicated support, custom branding, and SLA guarantees.
              </p>
            </div>
            <Button
              variant="outline"
              className="h-12 px-6 font-semibold gap-2 flex-shrink-0"
              onClick={() => {
                // Scroll to bottom and the chatbot will be visible
                window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
                // Simulate a click on the chatbot floating button after a short delay
                setTimeout(() => {
                  const chatBtn = document.querySelector<HTMLButtonElement>(".fixed.bottom-6.right-6");
                  if (chatBtn) chatBtn.click();
                }, 400);
              }}
            >
              💬 Chat with us
            </Button>
          </div>
        </div>

        {/* How credits work */}
        <div className="max-w-2xl mx-auto mt-12 text-center space-y-4">
          <h2 className="text-xl font-display font-bold text-foreground">How credits work</h2>
          <div className="grid sm:grid-cols-3 gap-4 text-sm">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="font-bold text-primary mb-1">1 Credit = 100 Images</p>
              <p className="text-muted-foreground text-xs">Upload & search up to 100 event images per credit</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="font-semibold text-foreground mb-1">Unused credits</p>
              <p className="text-muted-foreground">Credits never expire — use them anytime</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="font-semibold text-foreground mb-1">Cross-event</p>
              <p className="text-muted-foreground">Use remaining credits across any future event</p>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-2xl mx-auto mt-16">
          <div className="text-center mb-8">
            <span className="inline-block text-xs font-semibold uppercase tracking-wider text-primary mb-2">
              Support
            </span>
            <h2 className="text-2xl font-display font-bold text-foreground">Frequently asked questions</h2>
            <p className="text-sm text-muted-foreground mt-2">Everything you need to know about credits and pricing</p>
          </div>

          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-card overflow-hidden transition-all shadow-soft"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                >
                  <span className="font-medium text-foreground text-sm pr-4">{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${
                      openFaq === i ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-200 ${
                    openFaq === i ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <p className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-6 px-6 mt-auto">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BrandLogo className="w-6 h-6" />
            <span className="text-sm font-semibold text-muted-foreground">Media Findr</span>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            © 2026 Media Findr. All rights reserved. Powered by{" "}
            <span className="font-semibold text-foreground">The AI Product Factory</span>
          </p>
        </div>
      </footer>

      {/* Chatbot */}
      <LeadChatbot />
    </div>
  );
};

export default Pricing;
