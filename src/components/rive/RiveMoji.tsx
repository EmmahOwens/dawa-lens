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
      case "😔":
        return "Sad";
      case "😕":
      case "😐":
        return "Neutral";
      case "🙂":
      case "😊":
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
      case "🛡️":
        return "Shield";
      case "✨":
        return "Sparkles";
      case "💡":
        return "Idea";
      case "🪫":
        return "BatteryLow";
      case "🔋":
        return "BatteryFull";
      case "🛰️":
        return "Satellite";
      case "🧠":
        return "Brain";
      case "❌":
        return "Error";
      case "📍":
        return "MapPin";
      case "✈️":
        return "Plane";
      case "✔":
        return "Check";
      default:
        return "Smile";
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
        stateMachine="State Machine 1"
        inputs={{ "Pressed": active, "Hover": isHovered || active }}
        fit={Fit.Contain}
        alignment={Alignment.Center}
        fallback={<span style={{ fontSize: size * 0.7 }}>{emoji}</span>}
      />
    </div>
  );
};
