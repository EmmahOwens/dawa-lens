import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/contexts/AppContext";
import { 
  Plane, Globe, MapPin, Loader2, Sparkles, AlertCircle, 
  ShieldAlert, Pill, Phone, Activity, Search,
  ArrowRight, Info, Clock, CheckCircle2, Navigation
} from "lucide-react";
import { aiApi } from "@/services/api";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { TravelMap } from "@/components/travel/TravelMap";
import { lookupDRA } from "@/services/draDatabase";
import { ShieldCheck, Siren } from "lucide-react";
import { useGeolocation } from "@/hooks/useGeolocation";
import PermissionRequest from "@/components/PermissionRequest";
import { useToast } from "@/hooks/use-toast";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
const item = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } };

export default function TravelCompanionPage() {
  const { medicines, userProfile } = useApp();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { location: userLocation, status: geoStatus, requestLocation } = useGeolocation();
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState<any>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showLocationPermission, setShowLocationPermission] = useState(false);

  // Show permission dialog if location was denied
  useEffect(() => {
    if (geoStatus === 'denied') {
      setShowLocationPermission(true);
    }
  }, [geoStatus]);

  // Derive display values from geolocation
  const userCountry = userLocation?.country ?? null;
  const userCoords: [number, number] | null = userLocation
    ? [userLocation.longitude, userLocation.latitude]
    : null;
  const originLabel = userCountry?.toUpperCase() || (geoStatus === 'requesting' ? '...' : 'HOME');

  const handleAnalyze = async () => {
    if (!destination || medicines.length === 0) return;
    setLoading(true);
    setAdvice(null);
    setIsAnimating(true);
    
    try {
      const homeTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await aiApi.getTravelAdvice({
        medicines,
        destination,
        currentCity: userCountry || "Home",
        homeTimezone,
      });

      // Normalize equivalents to ensure consistent { original, equivalent } shape
      if (res && Array.isArray((res as any).equivalents)) {
        (res as any).equivalents = (res as any).equivalents.map((eq: any) => {
          if (typeof eq === 'string') return { original: eq, equivalent: eq };
          return {
            original: eq.original || eq.medicine || eq.name || eq.drug || 'Unknown',
            equivalent: eq.equivalent || eq.local_name || eq.localEquivalent || eq.brand || eq.alternative || 'Ask local pharmacist',
          };
        });
      }

      // Small delay to let animation breathe
      setTimeout(() => {
        setAdvice(res);
        setLoading(false);
        setIsAnimating(false);
      }, 1500);
    } catch (err: any) {
      console.error("Travel advice failed", err);
      toast({
        title: "Analysis Failed",
        description: err.message || "Failed to retrieve travel intelligence. Please check your connection and try again.",
        variant: "destructive",
      });
      setLoading(false);
      setIsAnimating(false);
    }
  };

  return (
    <div className="pt-6 pb-28 w-full min-w-0 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
              <Plane size={28} />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-foreground">
                Travel Companion
              </h1>
              <p className="text-[11px] md:text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-80 mt-0.5">
                Global Health Intelligence
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Map & Input Card */}
      <div className="space-y-4 mb-8">
        <TravelMap isAnimating={isAnimating} destination={destination} userCoords={userCoords} userCountry={userCountry} />

        <div className="glass-card p-4 md:p-8 rounded-3xl shadow-xl border-primary/10 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16" />
          
          <div className="flex flex-col gap-4 relative z-10">
            <div className="w-full">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2 block opacity-80">
                Where are you heading?
              </label>
              <div className="relative group">
                <Globe size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <input 
                  value={destination}
                  onChange={(e) => {
                    setDestination(e.target.value);
                    if (!e.target.value) setIsAnimating(false);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                  placeholder="Enter country (e.g. Kenya, France...)"
                  className="w-full h-14 pl-12 pr-4 rounded-2xl bg-background border border-border outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/30 transition-all text-base font-bold shadow-sm"
                />
              </div>
            </div>
            
            <Button 
              onClick={handleAnalyze}
              disabled={loading || !destination || medicines.length === 0}
              className="w-full h-14 rounded-2xl text-[15px] font-black shadow-lg shadow-primary/20 active:scale-95 transition-all"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin mr-2" />
              ) : (
                <Sparkles size={20} className="mr-2" />
              )}
              Analyze Trip
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        {medicines.length === 0 ? (
          <motion.div 
            key="empty-meds"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="p-12 md:p-20 rounded-[3rem] border-2 border-dashed border-border flex flex-col items-center text-center opacity-60"
          >
             <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
                <Pill size={40} className="text-muted-foreground" />
             </div>
             <h3 className="text-xl font-bold mb-2">No Medications Found</h3>
             <p className="text-sm font-medium text-muted-foreground max-w-sm">Please add medications to your profile before generating a travel intelligence report.</p>
          </motion.div>
        ) : loading ? (
          <motion.div 
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center p-20"
          >
            <div className="relative w-24 h-24 flex items-center justify-center">
              <Globe size={40} className="text-primary/50 absolute animate-pulse" />
              <div className="absolute inset-0 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
            <p className="mt-6 text-[10px] font-black uppercase tracking-[0.3em] text-primary animate-pulse">Consulting World Databases</p>
          </motion.div>
        ) : advice ? (
          <motion.div 
            key="results"
            variants={container} 
            initial="hidden" 
            animate="show" 
            className="space-y-8"
          >
            {/* Boarding Pass Header */}
            <motion.div variants={item} className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/50 to-blue-500/50 rounded-[2rem] blur opacity-30 group-hover:opacity-50 transition duration-1000" />
              <div className="relative bg-card rounded-[2rem] overflow-hidden border border-border shadow-2xl">
                {/* Main pass body */}
                <div className="p-5 sm:p-8">
                  {/* Passenger / Status row */}
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-0.5">Passenger</p>
                      <h4 className="text-lg sm:text-2xl font-black">{userProfile?.name || "Member"}</h4>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-0.5">Status</p>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[9px] font-black uppercase">Verified</span>
                    </div>
                  </div>

                  {/* Route row */}
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">From</p>
                      <h3 className="text-xl sm:text-3xl font-black tracking-tighter truncate">{originLabel}</h3>
                    </div>
                    <div className="flex flex-col items-center gap-1 px-2 sm:px-6 shrink-0">
                      <div className="w-16 sm:w-24 h-[1px] bg-border relative">
                        <Plane size={14} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" />
                      </div>
                      <span className="text-[7px] font-bold text-muted-foreground uppercase whitespace-nowrap">Direct</span>
                    </div>
                    <div className="flex-1 text-right min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">To</p>
                      <h3 className="text-xl sm:text-3xl font-black tracking-tighter text-primary uppercase truncate">{destination}</h3>
                    </div>
                  </div>
                </div>

                {/* Stub (date + boarding) */}
                <div className="border-t border-dashed border-border/50 bg-primary/[0.02] px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-0.5">Date</p>
                    <p className="text-sm font-black">{new Date().toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })}</p>
                  </div>
                  <div className="flex-1 max-w-[180px]">
                    <div className="w-full h-10 bg-muted/30 rounded-lg border border-dashed border-border flex items-center justify-center">
                      <span className="text-[9px] font-bold text-muted-foreground tracking-[0.4em] uppercase">BOARDING</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Equivalents */}
              {advice.equivalents && advice.equivalents.length > 0 && (
                <motion.div variants={item} className="md:col-span-2 space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground px-2 flex items-center gap-2">
                    <Pill size={14} className="text-primary" /> Local Pharmacy Equivalents
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {advice.equivalents.map((eq: any, idx: number) => (
                      <div key={idx} className="p-6 rounded-[2rem] bg-card border border-border shadow-sm flex flex-col justify-between group hover:border-primary/30 transition-all hover:shadow-md">
                        <div className="mb-4">
                          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest line-through opacity-60 mb-1">{eq.original}</p>
                          <p className="text-xl font-black text-foreground">{eq.equivalent}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                           <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                             <CheckCircle2 size={16} />
                           </div>
                           <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ask in {destination}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Timezone Advice */}
              {advice.timezoneAdvice && (
                <motion.div variants={item} className="p-8 rounded-[2.5rem] bg-blue-500/5 border border-blue-500/10 backdrop-blur-xl relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                     <Clock size={80} />
                   </div>
                   <div className="relative z-10">
                     <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-6 shadow-inner">
                       <Globe size={24} />
                     </div>
                     <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400 mb-4">
                       Timezone Dosing Strategy
                     </h3>
                     <p className="text-lg text-foreground/90 leading-relaxed font-bold tracking-tight">{advice.timezoneAdvice}</p>
                   </div>
                </motion.div>
              )}

              {/* Customs Notes */}
              {advice.customsNotes && (
                <motion.div variants={item} className="p-8 rounded-[2.5rem] bg-amber-500/5 border border-amber-500/10 backdrop-blur-xl relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                     <ShieldAlert size={80} />
                   </div>
                   <div className="relative z-10">
                     <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-600 mb-6 shadow-inner">
                       <ShieldAlert size={24} />
                     </div>
                     <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-600 mb-4">
                       Customs & Legal Notes
                     </h3>
                     <p className="text-lg text-foreground/90 leading-relaxed font-bold tracking-tight">{advice.customsNotes}</p>
                   </div>
                </motion.div>
              )}

              {/* Health Risks */}
              {advice.healthRisks && advice.healthRisks.length > 0 && (
                <motion.div variants={item} className="md:col-span-2 p-8 rounded-[2.5rem] bg-destructive/5 border border-destructive/10">
                   <div className="flex items-center gap-4 mb-8">
                     <div className="w-12 h-12 rounded-2xl bg-destructive/20 flex items-center justify-center text-destructive shadow-inner">
                       <Activity size={24} />
                     </div>
                     <div>
                       <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-destructive">
                         Destination Health Risks
                       </h3>
                       <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Stay Vigilant</p>
                     </div>
                   </div>
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {advice.healthRisks.map((risk: string, i: number) => (
                        <div key={i} className="flex gap-4 p-4 rounded-2xl bg-background/40 border border-border/50">
                          <AlertCircle size={18} className="text-destructive shrink-0 mt-0.5" />
                          <p className="text-sm font-bold leading-tight">{risk}</p>
                        </div>
                      ))}
                   </div>
                </motion.div>
              )}

              {/* Emergency Contacts */}
              {(advice.emergencyContacts?.length > 0 || destination) && (() => {
                // Pull ambulance from AI response
                const ambulance = advice.emergencyContacts?.find(
                  (c: any) => c.type === 'ambulance' || /ambulance|emergency|ems/i.test(c.service)
                ) || advice.emergencyContacts?.[0];

                // Drug authority: static DB first (most accurate), fall back to AI
                const staticDRA = lookupDRA(destination);
                const aiDRA = advice.emergencyContacts?.find(
                  (c: any) => c.type === 'drug_authority'
                );
                const draEntry = staticDRA || (aiDRA ? { authority: aiDRA.service, number: aiDRA.number } : null);

                return (
                  <motion.div variants={item} className="md:col-span-2 rounded-[2.5rem] overflow-hidden border border-border shadow-sm">
                    {/* Section header */}
                    <div className="px-6 pt-6 pb-4 border-b border-border/50 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Phone size={20} className="text-primary" />
                      </div>
                      <div>
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground">Important Contacts</h3>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">Save before you travel</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border/50">
                      {/* Ambulance */}
                      {ambulance && (
                        <div className="p-6 flex flex-col gap-3 bg-destructive/[0.03]">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-destructive/15 flex items-center justify-center">
                              <Siren size={16} className="text-destructive" />
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-destructive">Ambulance / EMS</span>
                          </div>
                          <p className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">{ambulance.number}</p>
                          <p className="text-[10px] font-bold text-muted-foreground">{ambulance.service}</p>
                        </div>
                      )}

                      {/* Drug Regulatory Authority */}
                      {draEntry && (
                        <div className="p-6 flex flex-col gap-3 bg-primary/[0.02]">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
                              <ShieldCheck size={16} className="text-primary" />
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-primary">Drug Regulatory Authority</span>
                          </div>
                          <p className="text-lg sm:text-xl font-black text-foreground tracking-tight leading-tight break-words">{draEntry.number}</p>
                          <p className="text-[10px] font-bold text-muted-foreground leading-snug">{draEntry.authority}</p>
                          {'website' in draEntry && draEntry.website && (
                            <a
                              href={draEntry.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-black text-primary underline underline-offset-2 hover:opacity-70 transition-opacity truncate"
                            >
                              {draEntry.website.replace(/^https?:\/\/www\./, '')}
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })()}
            </div>
          </motion.div>
        ) : (
           <motion.div 
            key="empty-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center p-12"
          >
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-8 relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
              <Plane size={40} className="text-primary relative z-10" />
            </div>
            <p className="text-center text-muted-foreground font-bold max-w-sm leading-relaxed uppercase tracking-widest text-[10px]">
              Ready for your next adventure?<br/>
              <span className="text-foreground/60">Enter a destination to generate your health pass.</span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Location Permission Modal */}
      <PermissionRequest
        isOpen={showLocationPermission}
        onClose={() => setShowLocationPermission(false)}
        onConfirm={() => {
          setShowLocationPermission(false);
          requestLocation();
        }}
        title="Enable Location"
        description="Allow DawaLens to detect your current country for accurate travel health intelligence and flight-path visualization."
        icon={Navigation}
        permissionName="Location"
      />
    </div>
  );
}
