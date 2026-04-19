import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/contexts/AppContext";
import { 
  Plane, Globe, MapPin, Loader2, Sparkles, AlertCircle, 
  ShieldAlert, Pill, Phone, Activity, Search
} from "lucide-react";
import { aiApi } from "@/services/api";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
const item = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } };

export default function TravelCompanionPage() {
  const { medicines } = useApp();
  const { t } = useTranslation();
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState<any>(null);

  const handleAnalyze = async () => {
    if (!destination || medicines.length === 0) return;
    setLoading(true);
    setAdvice(null); // Clear previous
    try {
      const homeTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await aiApi.getTravelAdvice({
        medicines,
        destination,
        currentCity: "Home",
        homeTimezone,
      });
      setAdvice(res);
    } catch (err) {
      console.error("Travel advice failed", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 pt-8 pb-32 max-w-4xl mx-auto w-full">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-14 h-14 rounded-[1.25rem] bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary shadow-inner border border-primary/20">
            <Plane size={28} />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-foreground">
              Travel Shield
            </h1>
            <p className="text-[11px] md:text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-80 mt-1">
              Global Health Intelligence
            </p>
          </div>
        </div>
      </motion.div>

      {/* Input Section (Boarding Pass Style) */}
      <div className="mb-10 relative overflow-hidden rounded-[2rem] bg-card border border-border shadow-xl">
        {/* Background Accents */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[80px] pointer-events-none" />
        
        <div className="p-6 md:p-8 relative z-10 flex flex-col md:flex-row gap-6 items-end">
          <div className="w-full">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-3 block opacity-80">
              Destination Country
            </label>
            <div className="relative group">
              <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <input 
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                placeholder="e.g. Japan, Kenya, United Kingdom..."
                className="w-full h-16 pl-14 pr-6 rounded-[1.5rem] bg-background border border-border outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/30 transition-all text-lg font-bold shadow-sm"
              />
            </div>
          </div>
          
          <Button 
            onClick={handleAnalyze}
            disabled={loading || !destination || medicines.length === 0}
            className="w-full md:w-auto h-16 px-8 rounded-[1.5rem] text-[15px] font-black shadow-lg shadow-primary/20 active:scale-95 transition-all"
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
             <Pill size={48} className="mb-6 text-muted-foreground" />
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
              <Globe size={40} className="text-primary/50 absolute" />
              <div className="absolute inset-0 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
            <p className="mt-6 text-sm font-bold uppercase tracking-widest text-primary animate-pulse">Scanning Global Database...</p>
          </motion.div>
        ) : advice ? (
          <motion.div 
            key="results"
            variants={container} 
            initial="hidden" 
            animate="show" 
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {/* Equivalents */}
            {advice.equivalents && advice.equivalents.length > 0 && (
              <motion.div variants={item} className="md:col-span-2 space-y-4">
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground px-2 flex items-center gap-2">
                  <Pill size={14} className="text-primary" /> Local Pharmacy Equivalents
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {advice.equivalents.map((eq: any, idx: number) => (
                    <div key={idx} className="p-5 rounded-[1.5rem] bg-card/60 backdrop-blur-xl border border-border/60 shadow-sm flex flex-col justify-between group hover:border-primary/30 transition-colors">
                      <div className="mb-4">
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest line-through opacity-60 mb-1">{eq.original}</p>
                        <p className="text-lg font-black text-foreground">{eq.equivalent}</p>
                      </div>
                      <div className="inline-flex self-start px-3 py-1.5 rounded-full bg-primary/10 text-[10px] font-black text-primary uppercase tracking-widest">
                         Ask for this in {eq.country || destination}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Timezone Advice */}
            {advice.timezoneAdvice && (
              <motion.div variants={item} className="p-6 md:p-8 rounded-[2rem] bg-blue-500/5 border border-blue-500/20 backdrop-blur-xl h-full">
                 <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4">
                   <Globe size={20} />
                 </div>
                 <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400 mb-3">
                   Timezone Dosing
                 </h3>
                 <p className="text-[15px] text-foreground/90 leading-relaxed font-medium">{advice.timezoneAdvice}</p>
              </motion.div>
            )}

            {/* Customs Notes */}
            {advice.customsNotes && (
              <motion.div variants={item} className="p-6 md:p-8 rounded-[2rem] bg-warning/5 border border-warning/20 backdrop-blur-xl h-full">
                 <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center text-warning mb-4">
                   <ShieldAlert size={20} />
                 </div>
                 <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-warning mb-3">
                   Customs & Borders
                 </h3>
                 <p className="text-[15px] text-foreground/90 leading-relaxed font-medium">{advice.customsNotes}</p>
              </motion.div>
            )}

            {/* Health Risks */}
            {advice.healthRisks && advice.healthRisks.length > 0 && (
              <motion.div variants={item} className="md:col-span-2 p-6 md:p-8 rounded-[2rem] bg-destructive/5 border border-destructive/20 backdrop-blur-xl">
                 <div className="flex items-center gap-3 mb-6">
                   <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center text-destructive">
                     <Activity size={20} />
                   </div>
                   <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-destructive">
                     General Health Risks
                   </h3>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {advice.healthRisks.map((risk: string, i: number) => (
                      <div key={i} className="flex gap-3">
                        <AlertCircle size={16} className="text-destructive shrink-0 mt-0.5 opacity-70" />
                        <p className="text-sm font-medium leading-relaxed">{risk}</p>
                      </div>
                    ))}
                 </div>
              </motion.div>
            )}

            {/* Emergency Contacts */}
            {advice.emergencyContacts && advice.emergencyContacts.length > 0 && (
              <motion.div variants={item} className="md:col-span-2 p-6 md:p-8 rounded-[2rem] bg-emerald-500/5 border border-emerald-500/20 backdrop-blur-xl">
                 <div className="flex items-center gap-3 mb-6">
                   <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                     <Phone size={20} />
                   </div>
                   <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
                     Emergency Contacts
                   </h3>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {advice.emergencyContacts.map((contact: any, i: number) => (
                      <div key={i} className="p-4 rounded-2xl bg-background/50 border border-border/50">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{contact.service}</p>
                        <p className="text-xl font-black text-foreground tracking-tight">{contact.number}</p>
                      </div>
                    ))}
                 </div>
              </motion.div>
            )}

          </motion.div>
        ) : (
           <motion.div 
            key="empty-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center p-12 mt-4"
          >
            <div className="relative w-32 h-32 mb-8 group">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl group-hover:bg-primary/30 transition-colors duration-1000" />
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                className="w-full h-full text-primary opacity-20"
              >
                <Globe size={128} strokeWidth={1} />
              </motion.div>
              <div className="absolute inset-0 flex items-center justify-center">
                 <Plane size={48} className="text-primary drop-shadow-xl" />
              </div>
            </div>
            <p className="text-center text-muted-foreground font-medium max-w-sm leading-relaxed">
              Enter your destination above to generate a personalized health and medication intelligence report for your trip.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
