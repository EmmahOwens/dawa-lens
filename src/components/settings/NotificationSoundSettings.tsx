import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Volume2,
  Volume1,
  VolumeX,
  Play,
  Square,
  RotateCcw,
  Sparkles,
  Droplets,
  Pill,
  CheckCircle2,
  AlertTriangle,
  Package,
  SkipForward,
  Music2,
  Sliders,
  Check,
  LucideIcon,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  soundService,
  AVAILABLE_SOUNDS,
  SOUND_CATEGORIES,
  SoundCategoryKey,
  SoundPreferences,
} from "@/services/soundService";
import { useToast } from "@/hooks/use-toast";

const categoryIconMap: Record<SoundCategoryKey, LucideIcon> = {
  medication: Pill,
  hydration: Droplets,
  quotes: Sparkles,
  taken: CheckCircle2,
  skipped: SkipForward,
  missed: AlertTriangle,
  refill: Package,
};

const categoryColorMap: Record<SoundCategoryKey, { bg: string; text: string; border: string }> = {
  medication: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/20" },
  hydration: { bg: "bg-cyan-500/10", text: "text-cyan-500", border: "border-cyan-500/20" },
  quotes: { bg: "bg-amber-500/10", text: "text-amber-500", border: "border-amber-500/20" },
  taken: { bg: "bg-emerald-500/10", text: "text-emerald-500", border: "border-emerald-500/20" },
  skipped: { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/20" },
  missed: { bg: "bg-rose-500/10", text: "text-rose-500", border: "border-rose-500/20" },
  refill: { bg: "bg-violet-500/10", text: "text-violet-500", border: "border-violet-500/20" },
};

export const NotificationSoundSettings: React.FC = () => {
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<SoundPreferences>(() =>
    soundService.getPreferences()
  );
  const [activePreview, setActivePreview] = useState<{
    category: SoundCategoryKey | "volume_test";
    soundId: string;
  } | null>(null);

  useEffect(() => {
    const unsubscribe = soundService.subscribe((newPrefs) => {
      setPreferences(newPrefs);
      const currentlyPlaying = soundService.getCurrentlyPlayingId();
      if (!currentlyPlaying) {
        setActivePreview(null);
      }
    });

    return () => {
      unsubscribe();
      soundService.stopSound();
    };
  }, []);

  const handleToggleEnabled = (enabled: boolean) => {
    soundService.setEnabled(enabled);
    if (!enabled) {
      soundService.stopSound();
      setActivePreview(null);
    }
    toast({
      title: enabled ? "Notification Sounds Enabled" : "Notification Sounds Muted",
      description: enabled
        ? "Alert chimes will play for reminders, doses, and milestones."
        : "All audio tones are now muted.",
    });
  };

  const handleVolumeChange = (values: number[]) => {
    const vol = values[0];
    soundService.setVolume(vol);
  };

  const handleSoundSelect = (category: SoundCategoryKey, soundId: string) => {
    soundService.setCategorySound(category, soundId);
    if (soundId !== "silent") {
      setActivePreview({ category, soundId });
      soundService.playSound(soundId);
    } else {
      soundService.stopSound();
      setActivePreview(null);
    }
  };

  const handlePreviewToggle = async (
    category: SoundCategoryKey | "volume_test",
    soundId: string
  ) => {
    if (activePreview?.category === category && activePreview?.soundId === soundId) {
      soundService.stopSound();
      setActivePreview(null);
      return;
    }

    setActivePreview({ category, soundId });
    const played = await soundService.playSound(soundId, preferences.volume);
    if (!played) {
      setActivePreview(null);
    }
  };

  const handleResetDefaults = () => {
    soundService.resetToDefaults();
    soundService.stopSound();
    setActivePreview(null);
    toast({
      title: "Audio Defaults Restored",
      description: "All notification chimes have been reset to recommended sounds.",
    });
  };

  const getSoundLabel = (soundId: string) => {
    if (soundId === "silent") return "Silent (No Sound)";
    if (soundId === "default") return "System Default";
    const found = AVAILABLE_SOUNDS.find((s) => s.id === soundId);
    return found ? found.name : "Custom Tone";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Music2 size={18} />
          </div>
          <div>
            <h3 className="font-bold text-foreground">Notification Sounds & Audio Alerts</h3>
            <p className="text-[11px] text-muted-foreground">
              Customize audio chimes for medication doses, hydration, daily quotes, and alerts
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleResetDefaults}
          className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-xl flex items-center gap-1.5"
          title="Reset to recommended sounds"
        >
          <RotateCcw size={12} />
          <span className="hidden sm:inline">Reset Defaults</span>
        </Button>
      </div>

      {/* Master Enable / Disable Banner */}
      <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 flex items-center justify-between gap-3 transition-all hover:bg-muted/50">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`p-2 rounded-xl shrink-0 transition-colors ${
              preferences.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            }`}
          >
            {preferences.enabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-foreground">Audio Notifications</p>
              <span
                className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  preferences.enabled
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-muted text-muted-foreground border border-border"
                }`}
              >
                {preferences.enabled ? "Active" : "Muted"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {preferences.enabled
                ? "Plays distinct audio chimes for scheduled alarms and in-app dose actions"
                : "All reminder and feedback sounds are silenced"}
            </p>
          </div>
        </div>
        <Switch
          checked={preferences.enabled}
          onCheckedChange={handleToggleEnabled}
          aria-label="Toggle notification sounds"
        />
      </div>

      {/* Volume Slider Control */}
      {preferences.enabled && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-3"
        >
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-foreground font-semibold">
              <Sliders size={14} className="text-primary" />
              <span>Notification Volume</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground font-medium">
                {Math.round(preferences.volume * 100)}%
              </span>
              {(() => {
                const primarySoundId =
                  preferences.categories.medication !== "silent" && preferences.categories.medication !== "default"
                    ? preferences.categories.medication
                    : "mixkit-positive-notification-951";
                const isVolumeTesting = activePreview?.category === "volume_test";
                return (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePreviewToggle("volume_test", primarySoundId)}
                    className="h-7 px-2 text-[11px] font-bold rounded-lg"
                  >
                    {isVolumeTesting ? (
                      <Square size={11} className="mr-1 fill-current text-primary" />
                    ) : (
                      <Play size={11} className="mr-1 fill-current text-primary" />
                    )}
                    Test
                  </Button>
                );
              })()}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Volume1 size={16} className="text-muted-foreground shrink-0" />
            <Slider
              value={[preferences.volume]}
              min={0}
              max={1}
              step={0.05}
              onValueChange={handleVolumeChange}
              className="flex-1"
              aria-label="Notification volume"
            />
            <Volume2 size={16} className="text-foreground shrink-0" />
          </div>
        </motion.div>
      )}

      {/* Categories Sound Selectors */}
      <div className="space-y-2.5">
        {SOUND_CATEGORIES.map((cat) => {
          const Icon = categoryIconMap[cat.key];
          const color = categoryColorMap[cat.key];
          const selectedSoundId = preferences.categories[cat.key] || cat.defaultSoundId;
          const isPlaying =
            activePreview?.category === cat.key &&
            activePreview?.soundId === selectedSoundId &&
            selectedSoundId !== "silent";

          return (
            <div
              key={cat.key}
              className={`p-3.5 rounded-2xl border transition-all ${
                isPlaying
                  ? "bg-primary/5 border-primary/40 shadow-sm"
                  : "bg-muted/20 border-border/50 hover:bg-muted/30"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Category Info */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className={`p-2.5 rounded-xl shrink-0 border ${color.bg} ${color.text} ${color.border}`}>
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-foreground tracking-tight">
                        {cat.label}
                      </h4>
                      {selectedSoundId === "silent" && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">
                          Silent
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                      {cat.description}
                    </p>
                  </div>
                </div>

                {/* Sound Dropdown & Play Preview Button */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0 w-full sm:w-auto">
                  <div className="flex-1 sm:w-56">
                    <Select
                      value={selectedSoundId}
                      onValueChange={(val) => handleSoundSelect(cat.key, val)}
                      disabled={!preferences.enabled}
                    >
                      <SelectTrigger className="h-9 rounded-xl text-xs font-semibold bg-background border-border/80">
                        <SelectValue placeholder="Select tone">
                          {getSoundLabel(selectedSoundId)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-h-72 rounded-xl">
                        <SelectGroup>
                          <SelectLabel className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                            Standard Options
                          </SelectLabel>
                          <SelectItem value="default" className="text-xs font-medium">
                            🔔 System Default Tone
                          </SelectItem>
                          <SelectItem value="silent" className="text-xs font-medium text-muted-foreground">
                            🔕 Silent (No Sound)
                          </SelectItem>
                        </SelectGroup>

                        <SelectSeparator />

                        <SelectGroup>
                          <SelectLabel className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                            Custom Tones ({AVAILABLE_SOUNDS.length})
                          </SelectLabel>
                          {AVAILABLE_SOUNDS.map((sound) => (
                            <SelectItem key={sound.id} value={sound.id} className="text-xs">
                              <div className="flex items-center justify-between w-full gap-2">
                                <span className="font-semibold">{sound.name}</span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                                  {sound.categoryTag}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Preview Play/Stop Button */}
                  <Button
                    type="button"
                    variant={isPlaying ? "default" : "outline"}
                    size="icon"
                    disabled={!preferences.enabled || selectedSoundId === "silent"}
                    onClick={() => handlePreviewToggle(cat.key, selectedSoundId)}
                    className={`h-9 w-9 rounded-xl shrink-0 transition-all ${
                      isPlaying
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-105"
                        : "border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                    title={isPlaying ? "Stop audio preview" : "Listen to audio preview"}
                    aria-label={isPlaying ? `Stop ${getSoundLabel(selectedSoundId)}` : `Play ${getSoundLabel(selectedSoundId)}`}
                  >
                    {isPlaying ? (
                      <Square size={13} className="fill-current" />
                    ) : (
                      <Play size={13} className="fill-current ml-0.5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
