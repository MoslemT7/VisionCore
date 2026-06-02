import { Film, Clock, Eye, BarChart2, MessageSquare } from "lucide-react";

export const getAnalyserTabs = (t) => [
  { id: "summary",  label: t("tabs.summary"), icon: BarChart2 },
  { id: "video",    label: t("tabs.video"), icon: Film },
  { id: "objects",  label: t("tabs.objects"), icon: Eye },
  { id: "chat",     label: t("tabs.chat"), icon: MessageSquare },
  { id: "captions", label: t("tabs.captions"), icon: MessageSquare },
  { id: "timeline", label: t("tabs.timeline"), icon: Clock },
];