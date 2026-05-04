import React from "react";
import { motion } from "framer-motion";
import { Patient, useApp } from "@/contexts/AppContext";
import { User } from "lucide-react";

interface FamilyStatusDotsProps {
  patients: Patient[];
  onSelect: (id: string | null) => void;
  selectedId: string | null;
}

export function FamilyStatusDots({ patients, onSelect, selectedId }: FamilyStatusDotsProps) {
  return (
    <div className="mb-6">
      <h2 className="section-title text-[10px] opacity-70 flex items-center gap-2 mb-3">
         Circle of Care
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {/* Self */}
        <button
          onClick={() => onSelect(null)}
          className="flex flex-col items-center gap-1.5 flex-shrink-0"
        >
          <div className={`relative w-12 h-12 rounded-full border-2 p-0.5 transition-all ${
            selectedId === null ? "border-primary scale-110" : "border-transparent"
          }`}>
             <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center text-primary overflow-hidden">
                <User size={20} />
             </div>
             <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-success border-2 border-white" />
          </div>
          <span className={`text-[9px] font-bold uppercase tracking-wider ${
            selectedId === null ? "text-primary" : "text-muted-foreground"
          }`}>Me</span>
        </button>

        {patients.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className="flex flex-col items-center gap-1.5 flex-shrink-0"
          >
            <div className={`relative w-12 h-12 rounded-full border-2 p-0.5 transition-all ${
              selectedId === p.id ? "border-primary scale-110" : "border-transparent"
            }`}>
               <div className="w-full h-full rounded-full bg-accent flex items-center justify-center text-accent-foreground font-black text-xs">
                  {p.name.charAt(0)}
               </div>
               {/* Random status for demo - in real app would check adherence */}
               <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-warning border-2 border-white animate-pulse" />
            </div>
            <span className={`text-[9px] font-bold uppercase tracking-wider ${
              selectedId === p.id ? "text-primary" : "text-muted-foreground"
            }`}>{p.name.split(" ")[0]}</span>
          </button>
        ))}
        
        {/* Add new shortcut */}
        <button className="flex flex-col items-center gap-1.5 flex-shrink-0 opacity-50">
          <div className="w-12 h-12 rounded-full border-2 border-dashed border-border flex items-center justify-center text-muted-foreground">
             <span className="text-xl">+</span>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Add</span>
        </button>
      </div>
    </div>
  );
}
