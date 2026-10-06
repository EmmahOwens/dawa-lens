import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/contexts/AppContext";
import { 
  Plane, Globe, MapPin, Loader2, Sparkles, AlertCircle, 
  ShieldAlert, Pill, Phone, Activity, Search,
  ArrowRight, Info, Clock, CheckCircle2, Navigation
} from "@/lib/icons";
import { aiApi } from "@/services/api";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import { TravelMap } from "@/components/travel/TravelMap";
import { lookupDRA } from "@/services/draDatabase";
import { ShieldCheck, Siren } from "@/lib/icons";
import { useGeolocation } from "@/hooks/useGeolocation";
import PermissionRequest from "@/components/PermissionRequest";
import { useToast } from "@/hooks/use-toast";
import MessageRenderer from "@/components/MessageRenderer";

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

  // Load cached advice if available
  useEffect(() => {
    try {
      const cachedAdvice = sessionStorage.getItem("dawa_travel_advice");
      const cachedDest = sessionStorage.getItem("dawa_travel_destination");
      if (cachedAdvice && !advice) {
        setAdvice(JSON.parse(cachedAdvice));
        if (cachedDest && !destination) {
          setDestination(cachedDest);
        }
      }
    } catch (_) {}
  }, []);

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

      // Normalize equivalents to ensure consistent { original, equivalent } shape and 100% coverage of user's medicines
      if (res) {
        const rawEquivalents = Array.isArray((res as any).equivalents) ? (res as any).equivalents : [];
        const parsedEquivalents = rawEquivalents.map((eq: any) => {
          if (typeof eq === 'string') return { original: eq, equivalent: eq };
          return {
            original: eq?.original || eq?.medicine || eq?.name || eq?.drug || 'Unknown',
            equivalent: eq?.equivalent || eq?.local_name || eq?.localEquivalent || eq?.brand || eq?.alternative || 'Ask local pharmacist',
          };
        });

        // Map every medication in user's medication list to an equivalent
        const allEquivalents = medicines.map((med) => {
          const medName = med.name.trim();
          const medGeneric = (med.genericName || '').trim();
          const medNameLower = medName.toLowerCase();
          const medGenericLower = medGeneric.toLowerCase();

          const match = parsedEquivalents.find((eq: any) => {
            const origLower = (eq.original || '').toLowerCase().trim();
            if (!origLower) return false;
            return (
              origLower === medNameLower ||
              origLower.includes(medNameLower) ||
              medNameLower.includes(origLower) ||
              (medGenericLower && (origLower === medGenericLower || origLower.includes(medGenericLower) || medGenericLower.includes(origLower)))
            );
          });

          if (match) {
            return {
              original: medName,
              equivalent: match.equivalent,
            };
          }

          return {
            original: medName,
            equivalent: medGeneric ? `${medGeneric} (Ask local pharmacist)` : `${medName} (Ask local pharmacist)`,
          };
        });

        (res as any).equivalents = allEquivalents.length > 0 ? allEquivalents : parsedEquivalents;
      }

      // Small delay to let animation breathe
      setTimeout(() => {
        setAdvice(res);
        try {
          sessionStorage.setItem("dawa_travel_advice", JSON.stringify(res));
          sessionStorage.setItem("dawa_travel_destination", destination);
        } catch (_) {}
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
    <div className="w-full min-w-0 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-[16px] bg-[#f5f5f7] dark:bg-[#272729] border border-border flex items-center justify-center text-primary shrink-0">
            <Plane size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-[-0.022em] text-foreground">
              Travel Companion
            </h1>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider opacity-80 mt-1">
              Global Health Intelligence
            </p>
          </div>
        </div>
      </motion.div>

      {/* Main Map & Input Card */}
      <div className="space-y-4 mb-8">
        <TravelMap isAnimating={isAnimating} destination={destination} userCoords={userCoords} userCountry={userCountry} />

        <div className="p-6 rounded-[18px] border border-border bg-card overflow-hidden">
          <div className="flex flex-col gap-4">
            <div className="w-full space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Where are you heading?
              </label>
              <div className="relative group">
                <Globe size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                  value={destination}
                  onChange={(e) => {
                    setDestination(e.target.value);
                    if (!e.target.value) setIsAnimating(false);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                  placeholder="Enter country (e.g. Kenya, France...)"
                  className="w-full h-11 pl-11 pr-4 rounded-full bg-background border border-border outline-none focus:border-primary transition-colors text-sm font-medium"
                />
              </div>

              {/* Quick corridor preset selector */}
              <div className="pt-1">
                <Select
                  value={destination}
                  onValueChange={(val) => {
                    if (val) {
                      setDestination(val);
                      setIsAnimating(false);
                    }
                  }}
                >
                  <SelectTrigger className="w-full h-11 rounded-full text-xs bg-muted/20 border-border text-muted-foreground font-medium px-4">
                    <SelectValue placeholder="Or select common travel corridor..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-border bg-card">
                    <SelectGroup>
                      <SelectLabel className="text-[10px] font-bold uppercase tracking-wider text-primary">
                        East Africa Corridor
                      </SelectLabel>
                      {["Kenya", "Tanzania", "Rwanda", "South Sudan", "DR Congo", "Burundi"].map((c) => (
                        <SelectItem key={c} value={c} className="text-xs">
                          {c}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Popular Global Destinations
                      </SelectLabel>
                      {["United Kingdom", "United Arab Emirates", "United States", "India", "South Africa", "Canada"].map((c) => (
                        <SelectItem key={c} value={c} className="text-xs">
                          {c}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Button 
              onClick={handleAnalyze}
              disabled={loading || !destination || medicines.length === 0}
              className="w-full h-11 rounded-full text-sm font-semibold active:scale-95 transition-transform"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin mr-2" />
              ) : (
                <Sparkles size={18} className="mr-2" />
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
            <motion.div variants={item}>
              <div className="rounded-[18px] overflow-hidden border border-border bg-[#f5f5f7] dark:bg-[#272729]">
                {/* Main pass body */}
                <div className="p-6">
                  {/* Passenger / Status row */}
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Passenger</p>
                      <h4 className="text-xl font-bold tracking-tight text-foreground">{userProfile?.name || "Member"}</h4>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Status</p>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-semibold uppercase">Verified</span>
                    </div>
                  </div>

                  {/* Route row */}
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">From</p>
                      <h3 className="text-2xl sm:text-3xl font-bold tracking-[-0.022em] text-foreground truncate">{originLabel}</h3>
                    </div>
                    <div className="flex flex-col items-center gap-1 px-2 sm:px-6 shrink-0">
                      <div className="w-16 sm:w-24 h-[1px] bg-border relative">
                        <Plane size={14} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" />
                      </div>
                      <span className="text-[9px] font-semibold text-muted-foreground uppercase whitespace-nowrap">Direct</span>
                    </div>
                    <div className="flex-1 text-right min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">To</p>
                      <h3 className="text-2xl sm:text-3xl font-bold tracking-[-0.022em] text-primary uppercase truncate">{destination}</h3>
                    </div>
                  </div>
                </div>

                {/* Stub (date + boarding) */}
                <div className="border-t border-dashed border-border bg-background/50 px-6 py-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Date</p>
                    <p className="text-sm font-semibold text-foreground">{new Date().toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })}</p>
                  </div>
                  <div className="flex-1 max-w-[180px]">
                    <div className="w-full h-9 bg-muted/40 rounded-full border border-dashed border-border flex items-center justify-center">
                      <span className="text-[9px] font-semibold text-muted-foreground tracking-[0.3em] uppercase">BOARDING PASS</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Equivalents */}
              {Array.isArray(advice.equivalents) && advice.equivalents.length > 0 && (
                <motion.div variants={item} className="md:col-span-2 space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 flex items-center gap-2">
                    <Pill size={14} className="text-primary" /> Local Pharmacy Equivalents
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {advice.equivalents.map((eq: any, idx: number) => (
                      <div key={idx} className="p-5 rounded-[18px] bg-card border border-border flex flex-col justify-between transition-colors">
                        <div className="mb-4">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">Your Med:</span>
                            <span className="text-xs font-medium text-muted-foreground truncate">{eq.original}</span>
                          </div>
                          <p className="text-lg font-bold text-foreground tracking-tight">{eq.equivalent}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                           <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                             <CheckCircle2 size={14} />
                           </div>
                           <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Ask in {destination}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Timezone Advice */}
              {advice.timezoneAdvice && (
                <motion.div variants={item} className="p-6 rounded-[18px] bg-card border border-border relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-6 opacity-5 dark:opacity-10 pointer-events-none">
                     <Clock size={80} />
                   </div>
                   <div className="relative z-10">
                     <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                       <Globe size={20} />
                     </div>
                     <h3 className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">
                       Timezone Dosing Strategy
                     </h3>
                     <MessageRenderer 
                       text={advice.timezoneAdvice} 
                       className="text-xs text-foreground/90 leading-relaxed font-normal [&_p]:font-normal [&_li]:font-normal [&_strong]:font-semibold [&_strong]:text-foreground" 
                     />
                   </div>
                </motion.div>
              )}

              {/* Customs Notes */}
              {advice.customsNotes && (
                <motion.div variants={item} className="p-6 rounded-[18px] bg-card border border-border relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-6 opacity-5 dark:opacity-10 pointer-events-none">
                     <ShieldAlert size={80} />
                   </div>
                   <div className="relative z-10">
                     <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4">
                       <ShieldAlert size={20} />
                     </div>
                     <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-3">
                       Customs & Legal Notes
                     </h3>
                     <MessageRenderer 
                       text={advice.customsNotes} 
                       className="text-xs text-foreground/90 leading-relaxed font-normal [&_p]:font-normal [&_li]:font-normal [&_strong]:font-semibold [&_strong]:text-amber-600 dark:[&_strong]:text-amber-400" 
                     />
                   </div>
                </motion.div>
              )}

              {/* Health Risks */}
              {advice.healthRisks && (
                <motion.div variants={item} className="md:col-span-2 p-6 rounded-[18px] bg-card border border-border">
                   <div className="flex items-center gap-3 mb-6">
                     <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive">
                       <Activity size={20} />
                     </div>
                     <div>
                       <h3 className="text-xs font-semibold uppercase tracking-wider text-destructive">
                         Destination Health Risks
                       </h3>
                       <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5">Stay Vigilant</p>
                     </div>
                   </div>
                   <div>
                      {typeof advice.healthRisks === 'string' ? (
                        <MessageRenderer 
                          text={advice.healthRisks} 
                          className="text-xs text-foreground/90 leading-relaxed font-normal [&_p]:font-normal [&_li]:font-normal [&_strong]:font-semibold [&_strong]:text-destructive" 
                        />
                      ) : Array.isArray(advice.healthRisks) ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {advice.healthRisks.map((risk: string, i: number) => (
                            <div key={i} className="flex gap-3 p-4 rounded-[14px] bg-muted/30 border border-border">
                              <AlertCircle size={16} className="text-destructive shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <MessageRenderer text={risk} className="text-xs font-medium leading-relaxed" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                   </div>
                </motion.div>
              )}

              {/* Emergency Contacts */}
              {(advice.emergencyContacts?.length > 0 || destination) && (() => {
                // Drug authority & verified ambulance: static DB first (most accurate), fall back to AI
                const staticDRA = lookupDRA(destination);
                const aiAmbulance = advice.emergencyContacts?.find(
                  (c: any) => c.type === 'ambulance' || /ambulance|emergency|ems/i.test(c.service)
                );
                const ambulance = (staticDRA?.ambulance
                  ? { service: staticDRA.ambulanceService || 'Ambulance / EMS', number: staticDRA.ambulance }
                  : null) || aiAmbulance || advice.emergencyContacts?.[0];

                const aiDRA = advice.emergencyContacts?.find(
                  (c: any) => c.type === 'drug_authority'
                );
                const draEntry = staticDRA || (aiDRA ? { authority: aiDRA.service, number: aiDRA.number } : null);

                return (
                  <motion.div variants={item} className="md:col-span-2 rounded-[18px] overflow-hidden border border-border bg-card">
                    {/* Section header */}
                    <div className="px-6 py-4 border-b border-border flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Phone size={18} className="text-primary" />
                      </div>
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Important Contacts</h3>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5">Save before you travel</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
                      {/* Ambulance */}
                      {ambulance && (
                        <div className="p-6 flex flex-col gap-2 bg-destructive/[0.02]">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-destructive/15 flex items-center justify-center">
                              <Siren size={14} className="text-destructive" />
                            </div>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-destructive">Ambulance / EMS</span>
                          </div>
                          <p className="text-2xl font-bold text-foreground tracking-tight">{ambulance.number}</p>
                          <p className="text-xs font-medium text-muted-foreground">{ambulance.service}</p>
                        </div>
                      )}

                      {/* Drug Regulatory Authority */}
                      {draEntry && (
                        <div className="p-6 flex flex-col gap-2 bg-primary/[0.02]">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                              <ShieldCheck size={14} className="text-primary" />
                            </div>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">Drug Regulatory Authority</span>
                          </div>
                          <p className="text-xl font-bold text-foreground tracking-tight leading-tight break-words">{draEntry.number}</p>
                          <p className="text-xs font-medium text-muted-foreground leading-relaxed">{draEntry.authority}</p>
                          {'website' in draEntry && draEntry.website && (
                            <a
                              href={draEntry.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-semibold text-primary underline underline-offset-2 hover:opacity-70 transition-opacity truncate mt-1"
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
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
              <Plane size={32} className="text-muted-foreground" />
            </div>
            <p className="text-center text-muted-foreground font-semibold max-w-sm leading-relaxed uppercase tracking-wider text-[11px]">
              Ready for your next adventure?<br/>
              <span className="text-foreground/70">Enter a destination to generate your health pass.</span>
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
