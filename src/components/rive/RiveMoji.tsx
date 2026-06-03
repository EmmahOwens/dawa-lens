import React, { useState } from 'react';
import { RiveAnimation } from './RiveAnimation';
import { Fit, Alignment } from '@rive-app/react-canvas';

interface RiveMojiProps {
  emoji: string;
  className?: string;
  size?: number;
  /** If true, triggers the "Pressed" or active state in the Rive state machine */
  active?: boolean;
}

// Local Rive asset for emojis
const EMOJI_RIVE_URL = "/assets/rive/animated-emoji-pack.riv";

/**
 * RiveMoji
 * 
 * Maps standard emojis to animated Rive equivalents.
 * Uses public Rive assets for common expressions.
 */
export const RiveMoji: React.FC<RiveMojiProps> = ({ emoji, className, size = 48, active = false }) => {
  const [isHovered, setIsHovered] = useState(false);

  // Map emoji to Rive Artboard
  const getArtboard = (e: string) => {
    switch (e) {
      // Crying (Sadness / Failure / Danger)
      case "😔": // Sad
      case "❌": // Error/Fail
      case "📉": // Graph Down
      case "💉": // Syringe
      case "⚡": // High side effect/danger
      case "🪫": // Battery Low
        return "Crying";

      // Smiling (Neutral / Information / Static Objects)
      case "😕": // Meh
      case "😐": // Neutral
      case "👤": // User
      case "👥": // Users
      case "🏥": // Hospital
      case "💊": // Pill
      case "🛡️": // Shield
      case "📊": // Analytics
      case "📄": // Doc
      case "📦": // Box
      case "🛰️": // Satellite
        return "Smiling";

      // Happy (Joy / Success / Validation)
      case "🙂": // Good
      case "😊": // Positive
      case "🏆": // Perfect Day / Trophy
      case "🆕": // Plus / New
      case "✅": // Check
      case "✔": // Check mark
      case "✈️": // Plane
      case "🎯": // Target
      case "🔋": // Battery Full
      case "📈": // Graph Up
        return "Happy";

      // Laughing (High Energy Joy / Great)
      case "💎": // Great / Diamond
      case "Great":
        return "Laughing";

      // Wow (Insights / High Energy)
      case "💡": // Idea
      case "🧠": // Brain
        return "Wow";

      // Surprise (Alerts / Warnings)
      case "⚠️": // Warning
      case "🚨": // Alert
        return "Surprise";

      // Winking (Interactions / Actions / Dynamic items)
      case "✨": // Sparkles
      case "📍": // Map Pin
      case "📷": // Camera
      case "🤖": // Bot
      case "🔍": // Search / Zoom
      case "⏰": // Timer / Clock
      case "🔔": // Bell
        return "Winking";

      default:
        return "Smiling";
    }
  };

  const artboard = getArtboard(emoji);

  return (
    <div 
      className={`flex items-center justify-center transition-transform duration-300 ${isHovered ? 'scale-110' : 'scale-100'} ${className}`} 
      style={{ width: size, height: size }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <RiveAnimation
        src={EMOJI_RIVE_URL}
        artboard={artboard}
        autoplay={true}
        fit={Fit.Contain}
        alignment={Alignment.Center}
        fallback={<span style={{ fontSize: size * 0.7 }}>{emoji}</span>}
      />
    </div>
  );
};
