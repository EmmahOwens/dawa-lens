import { toast } from "sonner";
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Info, 
  ShieldAlert 
} from "lucide-react";
import React from "react";

export const notify = {
  success: (title: string, description?: string) => {
    toast.success(title, {
      description,
      icon: React.createElement(CheckCircle2, { className: "h-5 w-5 text-success" }),
      className: "rounded-[1.5rem] border-success/20 bg-success/5 backdrop-blur-xl shadow-lg",
    });
  },
  error: (title: string, description?: string) => {
    toast.error(title, {
      description,
      icon: React.createElement(XCircle, { className: "h-5 w-5 text-destructive" }),
      className: "rounded-[1.5rem] border-destructive/20 bg-destructive/5 backdrop-blur-xl shadow-lg",
    });
  },
  warning: (title: string, description?: string) => {
    toast.warning(title, {
      description,
      icon: React.createElement(AlertCircle, { className: "h-5 w-5 text-warning" }),
      className: "rounded-[1.5rem] border-warning/20 bg-warning/5 backdrop-blur-xl shadow-lg",
    });
  },
  info: (title: string, description?: string) => {
    toast.info(title, {
      description,
      icon: React.createElement(Info, { className: "h-5 w-5 text-blue-500" }),
      className: "rounded-[1.5rem] border-blue-500/20 bg-blue-500/5 backdrop-blur-xl shadow-lg",
    });
  },
  secure: (title: string, description?: string) => {
    toast.message(title, {
      description,
      icon: React.createElement(ShieldAlert, { className: "h-5 w-5 text-primary" }),
      className: "rounded-[1.5rem] border-primary/20 bg-primary/5 backdrop-blur-xl shadow-lg",
    });
  },
};
