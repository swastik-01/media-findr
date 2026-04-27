import { useState } from "react";
import { Camera, X, MessageCircle, Send } from "lucide-react";
import { Input } from "@/components/ui/input";

const LeadChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [chatStep, setChatStep] = useState<"greeting" | "name" | "contact" | "message" | "done">("greeting");
  const [leadData, setLeadData] = useState({ name: "", contact: "", message: "" });
  const [inputValue, setInputValue] = useState("");

  const messages: { from: "bot" | "user"; text: string }[] = [];

  // Build conversation based on step
  if (chatStep === "greeting" || chatStep !== "greeting") {
    messages.push({ from: "bot", text: "Hey! 👋 I'm the Media Findr assistant. How can I help you today?" });
  }
  if (leadData.name) {
    messages.push({ from: "user", text: leadData.name });
    messages.push({ from: "bot", text: `Nice to meet you, ${leadData.name}! Can I get your phone number or email so our team can reach out?` });
  }
  if (leadData.contact) {
    messages.push({ from: "user", text: leadData.contact });
    messages.push({ from: "bot", text: "Got it! Any specific message or query for our team? (or type 'skip')" });
  }
  if (leadData.message) {
    messages.push({ from: "user", text: leadData.message });
    messages.push({ from: "bot", text: "Thank you! 🎉 Our team will reach out to you shortly. In the meantime, feel free to explore our platform!" });
  }

  const handleSend = () => {
    if (!inputValue.trim()) return;
    const val = inputValue.trim();
    setInputValue("");

    if (chatStep === "greeting") {
      setLeadData((p) => ({ ...p, name: val }));
      setChatStep("contact");
    } else if (chatStep === "contact") {
      setLeadData((p) => ({ ...p, contact: val }));
      setChatStep("message");
    } else if (chatStep === "message") {
      setLeadData((p) => ({ ...p, message: val === "skip" ? "No message" : val }));
      setChatStep("done");
      console.log("Lead captured:", { ...leadData, message: val });
    }
  };

  const getPlaceholder = () => {
    if (chatStep === "greeting") return "Enter your name...";
    if (chatStep === "contact") return "Phone or email...";
    if (chatStep === "message") return "Your message (or 'skip')...";
    return "";
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-elevated flex items-center justify-center transition-all hover:scale-105 ${
          isOpen ? "bg-destructive text-destructive-foreground rotate-0" : "gradient-primary text-primary-foreground"
        }`}
      >
        {isOpen ? <X className="w-5 h-5" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[350px] max-h-[460px] rounded-2xl border border-border bg-card shadow-elevated flex flex-col overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="gradient-primary px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <Camera className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-primary-foreground">Media Findr</p>
              <p className="text-[11px] text-primary-foreground/70">We typically reply instantly</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[280px]">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.from === "user"
                      ? "gradient-primary text-primary-foreground rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          {chatStep !== "done" && (
            <div className="border-t border-border p-3 flex items-center gap-2">
              <div className="flex-1 relative">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder={getPlaceholder()}
                  className="h-10 pr-10 text-sm"
                  autoFocus
                />
              </div>
              <button
                onClick={handleSend}
                className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground hover:opacity-90 transition-opacity flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default LeadChatbot;
