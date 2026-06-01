import React from 'react';
import { RiveAnimation } from './RiveAnimation';
import { Fit, Alignment } from '@rive-app/react-canvas';

interface RiveMojiProps {
  emoji: string;
  className?: string;
  size?: number;
}

// Public Rive asset URL for emojis
const EMOJI_RIVE_URL = "https://public.rive.app/community/runtime-files/2191-4327-sticker-pack.riv";

/**
 * RiveMoji
 * 
 * Maps standard emojis to animated Rive equivalents.
 * Uses public Rive assets for common expressions.
 */
export const RiveMoji: React.FC<RiveMojiProps> = ({ emoji, className, size = 48 }) => {
  // Map emoji to Rive Artboard
  const getArtboard = (e: string) => {
    switch (e) {
      case "😔":
        return "Sad";
      case "😕":
      case "😐":
        return "Neutral";
      case "🙂":
        return "Smile";
      case "💎":
      case "Great":
      case "🏆":
        return "Love";
      case "🔍":
        return "Check";
      case "🔔":
        return "Bell";
      case "💊":
        return "Pill";
      case "🏥":
        return "Hospital";
      case "⏰":
        return "Timer";
      case "⚡":
        return "Zap";
      case "📦":
        return "Box";
      case "📉":
        return "GraphDown";
      case "📄":
        return "Doc";
      case "🆕":
        return "Plus";
      case "🚨":
        return "Alert";
      case "⚠️":
        return "Warning";
      case "✅":
        return "Check";
      case "📈":
        return "Graph";
      case "👤":
      case "👥":
        return "User";
      case "💉":
        return "Syringe";
      case "🤖":
        return "Bot";
      case "🎯":
        return "Target";
      case "📷":
        return "Camera";
      case "📊":
        return "Analytics";
      default:
        return "Smile";
    }
  };

  const artboard = getArtboard(emoji);

  return (
    <div 
      className={`flex items-center justify-center ${className}`} 
      style={{ width: size, height: size }}
    >
      <RiveAnimation
        src={EMOJI_RIVE_URL}
        artboard={artboard}
        fit={Fit.Contain}
        alignment={Alignment.Center}
        fallback={<span style={{ fontSize: size * 0.7 }}>{emoji}</span>}
      />
    </div>
  );
};
