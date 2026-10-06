import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Loader2, ArrowRight } from "@/lib/icons";
import { Button } from "@/components/ui/button";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token found in the link.");
      return;
    }

    const verify = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/v1/auth/verify/${token}`);
        const data = await res.json();
        if (res.ok) {
          setStatus("success");
          setMessage(data.message || "Email verified successfully!");
        } else {
          setStatus("error");
          setMessage(data.error || "Verification failed. The link may have expired.");
        }
      } catch {
        setStatus("error");
        setMessage("Could not connect to the server. Please try again.");
      }
    };

    verify();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm rounded-[18px] border border-border bg-card p-8 text-center"
      >
        {status === "loading" && (
          <div className="flex flex-col items-center gap-4 py-4">
            <Loader2 size={40} className="animate-spin text-[#0066cc] dark:text-[#2997ff]" />
            <p className="text-muted-foreground text-sm font-normal">Verifying your email...</p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-[16px] bg-success/10 flex items-center justify-center">
              <CheckCircle2 size={32} className="text-success" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-[-0.022em] text-foreground">Email Verified!</h1>
              <p className="text-muted-foreground text-sm mt-1.5 leading-relaxed">{message}</p>
            </div>
            <button 
              className="w-full h-11 rounded-full text-sm font-semibold bg-[#0066cc] dark:bg-[#0071e3] text-white hover:opacity-95 transition-transform active:scale-95 flex items-center justify-center gap-2" 
              onClick={() => navigate("/auth")}
            >
              Sign In <ArrowRight size={16} />
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-[16px] bg-destructive/10 flex items-center justify-center">
              <XCircle size={32} className="text-destructive" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-[-0.022em] text-foreground">Verification Failed</h1>
              <p className="text-muted-foreground text-sm mt-1.5 leading-relaxed">{message}</p>
            </div>
            <button 
              className="w-full h-11 rounded-full text-sm font-semibold border border-border bg-card hover:bg-secondary text-foreground transition-transform active:scale-95" 
              onClick={() => navigate("/auth")}
            >
              Back to Sign In
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
