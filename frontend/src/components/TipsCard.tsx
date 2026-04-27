import { Lightbulb } from "lucide-react";

const tips = [
  "Use a clear, well-lit photo with your face visible",
  "Front-facing photos work better than side profiles",
  "Upload 2–3 different photos for best results",
  "Searching by name works if you registered for the event",
];

const TipsCard = () => (
  <div className="bg-card/80 backdrop-blur rounded-xl border border-border p-5">
    <div className="flex items-center gap-2 mb-3">
      <Lightbulb className="w-4 h-4 text-warning" />
      <span className="text-sm font-semibold text-foreground">Tips for best results</span>
    </div>
    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {tips.map((tip) => (
        <li key={tip} className="flex items-start gap-2 text-sm text-muted-foreground">
          <span className="w-1 h-1 rounded-full bg-primary mt-2 shrink-0" />
          {tip}
        </li>
      ))}
    </ul>
  </div>
);

export default TipsCard;
