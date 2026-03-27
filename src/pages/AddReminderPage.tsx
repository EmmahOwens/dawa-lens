import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";

export default function AddReminderPage() {
  const navigate = useNavigate();
  const { addReminder } = useApp();
  const { toast } = useToast();

  const [medicineName, setMedicineName] = useState("");
  const [dose, setDose] = useState("");
  const [time, setTime] = useState("08:00");
  const [repeat, setRepeat] = useState<"daily" | "weekly" | "once" | "custom">("daily");
  const [notes, setNotes] = useState("");

  const handleSave = () => {
    if (!medicineName.trim() || !dose.trim()) {
      toast({ title: "Missing fields", description: "Please fill in medicine name and dose.", variant: "destructive" });
      return;
    }
    addReminder({
      medicineName: medicineName.trim(),
      dose: dose.trim(),
      time,
      repeatSchedule: repeat,
      notes: notes.trim() || undefined,
      enabled: true,
    });
    toast({ title: "Reminder created!", description: `${medicineName} at ${time}` });
    navigate("/");
  };

  return (
    <div className="px-4 pt-6 pb-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <ArrowLeft size={16} /> Back
      </button>

      <motion.h1
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xl font-bold text-foreground mb-6"
      >
        Add Reminder
      </motion.h1>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="space-y-5"
      >
        <div>
          <Label htmlFor="medName">Medicine Name</Label>
          <Input
            id="medName"
            value={medicineName}
            onChange={(e) => setMedicineName(e.target.value)}
            placeholder="e.g. Ibuprofen 200mg"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="dose">Dose Amount</Label>
          <Input
            id="dose"
            value={dose}
            onChange={(e) => setDose(e.target.value)}
            placeholder="e.g. 1 tablet, 5ml"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="time">Time</Label>
          <Input
            id="time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label>Repeat Schedule</Label>
          <Select value={repeat} onValueChange={(v) => setRepeat(v as any)}>
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="once">Once</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Take with food, etc."
            className="mt-1.5"
            rows={3}
          />
        </div>

        <Button onClick={handleSave} className="w-full" size="lg">
          <Save size={16} className="mr-2" /> Save Reminder
        </Button>
      </motion.div>
    </div>
  );
}
