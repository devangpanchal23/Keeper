import React from "react";
import { ContentType } from "@/types";
import {
  Video,
  FileText,
  MessageSquare,
  Image as ImageIcon,
  Globe,
  ShoppingBag,
  FileCode,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ContentTypeBadgeProps {
  type: ContentType;
  className?: string;
  showIconOnly?: boolean;
}

export const ContentTypeBadge: React.FC<ContentTypeBadgeProps> = ({
  type,
  className,
  showIconOnly = false,
}) => {
  const getConfig = () => {
    switch (type) {
      case "video":
        return { label: "Video", icon: <Video className="w-3 h-3" /> };
      case "short":
        return { label: "Short", icon: <Zap className="w-3 h-3 text-amber-400" /> };
      case "reel":
        return { label: "Reel", icon: <Zap className="w-3 h-3 text-pink-400" /> };
      case "article":
        return { label: "Article", icon: <FileText className="w-3 h-3" /> };
      case "post":
        return { label: "Post", icon: <MessageSquare className="w-3 h-3" /> };
      case "image":
        return { label: "Image", icon: <ImageIcon className="w-3 h-3" /> };
      case "product":
        return { label: "Product", icon: <ShoppingBag className="w-3 h-3" /> };
      case "pdf":
        return { label: "PDF", icon: <FileCode className="w-3 h-3" /> };
      case "website":
      default:
        return { label: "Web", icon: <Globe className="w-3 h-3" /> };
    }
  };

  const config = getConfig();

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-500/10 text-neutral-700 dark:text-neutral-400 border border-neutral-500/20",
        className
      )}
      title={config.label}
    >
      {config.icon}
      {!showIconOnly && <span className="capitalize">{config.label}</span>}
    </span>
  );
};
