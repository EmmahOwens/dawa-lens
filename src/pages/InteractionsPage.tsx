import { useEffect, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { checkInteractions } from "@/services/interactionChecker";
import { ParsedInteraction } from "@/types/interactions";
import { CopyPlus, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function InteractionsPage() {
  const { medicines } = useApp();
  const [interactions, setInteractions] = useState<ParsedInteraction[]>([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const fetchInteractions = async () => {
      // Filter out medicines that don't have an rxcui yet
      const rxcuis = medicines.map(m => m.rxcui).filter((id): id is string => !!id);
      
      if (rxcuis.length < 2) {
        setInteractions([]);
        return;
      }
      
      setLoading(true);
      try {
        const results = await checkInteractions(rxcuis);
        setInteractions(results);
      } catch (error) {
        console.error("Failed to load interactions", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchInteractions();
  }, [medicines]);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <CopyPlus className="w-8 h-8 text-indigo-500" />
          My Interactions
        </h1>
        <p className="text-muted-foreground mt-2">
          A dynamic check of how your saved medications might interact with each other.
        </p>
      </header>

      <Alert className="bg-muted/50 border-muted">
        <Info className="h-4 w-4 text-muted-foreground" />
        <AlertTitle className="text-muted-foreground font-semibold">Important Medical Disclaimer</AlertTitle>
        <AlertDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
          The information provided here is for educational purposes only. It is sourced from the NIH NLM REST API. 
          <strong> Do not alter your medications or dosages without consulting a physician or qualified healthcare provider.</strong>
        </AlertDescription>
      </Alert>

      {medicines.length < 2 && (
        <Card className="bg-card/50 backdrop-blur-sm mt-8 border-dashed">
          <CardContent className="flex flex-col items-center p-8 text-center text-muted-foreground space-y-4">
            <CopyPlus className="w-12 h-12 opacity-20" />
            <p className="max-w-[200px] text-sm">
              Add at least two medications to your profile to check for interactions.
            </p>
          </CardContent>
        </Card>
      )}

      {medicines.length >= 2 && loading && (
        <div className="space-y-4">
          <Skeleton className="h-[120px] w-full rounded-xl" />
          <Skeleton className="h-[120px] w-full rounded-xl" />
        </div>
      )}

      {medicines.length >= 2 && !loading && interactions.length === 0 && (
        <Alert className="bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          <AlertTitle>No Known Interactions Found</AlertTitle>
          <AlertDescription>
            We didn't find any documented major interactions between your saved medications.
          </AlertDescription>
        </Alert>
      )}

      {medicines.length >= 2 && !loading && interactions.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Detected Interactions ({interactions.length})
          </h3>
          {interactions.map((interaction, idx) => (
            <Card key={idx} className="border-l-4 border-l-amber-500 shadow-sm hover:shadow-md transition-all">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className="font-bold">{interaction.drug1}</span>
                    <span className="text-muted-foreground text-sm font-normal">and</span>
                    <span className="font-bold">{interaction.drug2}</span>
                  </CardTitle>
                  {interaction.severity === 'high' ? (
                    <Badge variant="destructive" className="ml-2 shadow-sm shadow-destructive/20">High Severity</Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 ml-2">Warning</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {interaction.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
