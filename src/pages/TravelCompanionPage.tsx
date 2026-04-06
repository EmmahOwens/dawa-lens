import { useState } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/contexts/AppContext";
import { Plane, Globe, MapPin, Loader2, Sparkles, AlertCircle, ShieldAlert, ArrowRight, Pill } from "lucide-react";
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
    try {
      const res = await aiApi.getTravelAdvice({
        medicines,
        destination,
        currentCity: "Home",
      });
      setAdvice(res);
    } catch (err) {
      console.error("Travel advice failed", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 pt-12 pb-20">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-black tracking-tighter text-foreground">
            Travel Companion
          </h1>
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Plane size={24} />
          </div>
        </div>
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest opacity-70">
          Global medication intelligence
        </p>
      </motion.div>

      {/* Input Section */}
      <div className="mb-10 p-6 rounded-[2.5rem] bg-card border-2 border-primary/20 shadow-xl shadow-primary/5">
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2 block">Where are you going?</label>
            <div className="relative">
              <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. United Kingdom"
                className="w-full h-14 pl-12 pr-4 rounded-2xl bg-muted/30 border-none outline-none focus:ring-2 ring-primary/20 transition-all font-bold"
              />
            </div>
          </div>
          
          <Button 
            onClick={handleAnalyze}
            disabled={loading || !destination || medicines.length === 0}
            className="w-full h-14 rounded-2xl text-sm font-black uppercase tracking-widest shadow-lg shadow-primary/20"
          >
            {loading ? <Loader2 size={18} className="animate-spin mr-2" /> : <Sparkles size={18} className="mr-2" />}
            Analyze meds for {destination || "Trip"}
          </Button>
        </div>
      </div>

      {advice && (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
          {/* Equivalents */}
          {advice.equivalents && advice.equivalents.length > 0 && (
            <motion.div variants={item} className="space-y-3">
              <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground px-2 flex items-center gap-2">
                <Globe size={14} /> Local Equivalents
              </h3>
              <div className="space-y-3">
                {advice.equivalents.map((eq: any, idx: number) => (
                  <div key={idx} className="p-4 rounded-[1.5rem] bg-card border border-border flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter line-through opacity-50">{eq.original}</p>
                      <p className="text-sm font-black text-foreground">{eq.equivalent}</p>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-primary/10 text-[10px] font-black text-primary uppercase tracking-widest">
                       {eq.country}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Timezone Advice */}
          {advice.timezoneAdvice && (
            <motion.div variants={item} className="p-6 rounded-[2rem] bg-primary/5 border border-primary/20">
               <h3 className="text-sm font-black uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
                 <AlertCircle size={16} /> Timezone Shifting
               </h3>
               <p className="text-sm text-foreground/80 leading-relaxed italic">{advice.timezoneAdvice}</p>
            </motion.div>
          )}

          {/* Customs Notes */}
          {advice.customsNotes && (
            <motion.div variants={item} className="p-6 rounded-[2rem] bg-warning/5 border border-warning/20">
               <h3 className="text-sm font-black uppercase tracking-widest text-warning mb-3 flex items-center gap-2">
                 <ShieldAlert size={16} /> Customs & Safety
               </h3>
               <p className="text-sm text-foreground/80 leading-relaxed font-medium">{advice.customsNotes}</p>
            </motion.div>
          )}
        </motion.div>
      )}

      {medicines.length === 0 && (
        <div className="p-12 rounded-[3rem] border-2 border-dashed border-border flex flex-col items-center text-center opacity-40">
           <Pill size={40} className="mb-4" />
           <p className="text-sm font-bold uppercase tracking-widest">Add medications first</p>
        </div>
      )}
    </div>
  );
}
