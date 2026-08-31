import React, { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss";
import { useNearbyPharmacies } from "@/hooks/useNearbyPharmacies";
import { PharmacyRouteMap } from "./PharmacyRouteMap";
import { getDirectionsUrl, NdaPharmacy } from "@/services/pharmacyService";
import { Medicine } from "@/contexts/AppContext";
import {
  Navigation,
  CheckCircle,
  Car,
  Search,
  RefreshCw,
  Info,
  CloseSquare,
  Compass,
  Building,
  ShieldCheck,
  Phone,
  ArrowRight,
  Filter,
  Location,
} from "@/lib/icons";
import PermissionRequest from "@/components/PermissionRequest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PharmacyFinderModalProps {
  medicine?: Medicine | null;
  onClose: () => void;
  onRefillLogged?: (medicine: Medicine) => void;
}

export const PharmacyFinderModal: React.FC<PharmacyFinderModalProps> = ({
  medicine,
  onClose,
  onRefillLogged,
}) => {
  const {
    userCoords,
    geoStatus,
    requestLocation,
    top5Pharmacies,
    filteredPharmacies,
    selectedPharmacy,
    setSelectedPharmacy,
    route,
    isRouteLoading,
    transportMode,
    setTransportMode,
    searchQuery,
    setSearchQuery,
    selectedDistrict,
    setSelectedDistrict,
    allDistricts,
  } = useNearbyPharmacies();

  const [activeTab, setActiveTab] = useState<"top5" | "search">("top5");
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const swipe = useSwipeToDismiss(onClose);

  const handleOpenExternalMaps = (pharmacy: NdaPharmacy) => {
    const url = getDirectionsUrl(pharmacy.latitude, pharmacy.longitude, pharmacy.name);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return createPortal(
    <>
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="w-full max-w-2xl bg-card rounded-t-[2.5rem] shadow-2xl border border-border/50 max-h-[92dvh] flex flex-col overflow-hidden"
        >
          {/* Grab Handle — swipe/drag this area to dismiss */}
          <motion.div
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.3 }}
            onDragEnd={(_e, info) => {
              if (info.offset.y > 80) onClose();
            }}
            className="flex-shrink-0 pt-4 pb-2 px-6 cursor-grab active:cursor-grabbing touch-pan-x select-none"
            {...swipe}
          >
            <div className="w-12 h-1.5 rounded-full bg-muted/80 hover:bg-muted mx-auto transition-colors" />
          </motion.div>

          {/* Modal Header */}
          <div className="px-6 pb-4 border-b border-border/40 shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/10 border border-teal-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-teal-600 dark:text-teal-400">
                    <CheckCircle className="size-3" /> Source: National Drug Authority (NDA)
                  </span>
                  {medicine && (
                    <span className="inline-flex items-center rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-600 dark:text-amber-400">
                      Refill Radar
                    </span>
                  )}
                </div>

                <h2 className="text-2xl font-black tracking-tight text-foreground leading-tight">
                  {medicine ? `Refill ${medicine.name}` : "Nearest Licensed Pharmacies"}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {medicine
                    ? `Showing top NDA-licensed pharmacies near you to refill ${medicine.name} (${medicine.currentQuantity ?? 0} ${medicine.unit || "units"} left).`
                    : "Verified pharmacies licensed by the Uganda National Drug Authority (NDA) with live road routes."}
                </p>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-2xl bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <CloseSquare size={20} />
              </button>
            </div>

            {/* Mode & Tab Switchers */}
            <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
              {/* Tab: Top 5 vs Search all */}
              <div className="flex rounded-xl bg-muted/40 p-1 border border-border/40">
                <button
                  onClick={() => setActiveTab("top5")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    activeTab === "top5"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Top 5 Nearest
                </button>
                <button
                  onClick={() => setActiveTab("search")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    activeTab === "search"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Search & Filter
                </button>
              </div>

              {/* Travel Mode Toggle (Driving / Walking) */}
              <div className="flex rounded-xl bg-muted/40 p-1 border border-border/40">
                <button
                  onClick={() => setTransportMode("driving")}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    transportMode === "driving"
                      ? "bg-teal-600 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Car className="size-3.5" /> Driving
                </button>
                <button
                  onClick={() => setTransportMode("walking")}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    transportMode === "walking"
                      ? "bg-teal-600 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Navigation className="size-3.5" /> Walking
                </button>
              </div>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-5 flex-1 overflow-y-auto no-scrollbar touch-auto overscroll-contain">
            {/* Location Status Warning Banner (if location denied / error) */}
            {(geoStatus === "denied" || geoStatus === "error") && (
              <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Location className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span className="truncate">Location disabled. Showing default Kampala area.</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowLocationDialog(true)}
                  className="h-7 text-[10px] font-bold rounded-xl border-amber-500/30 bg-amber-500/15 hover:bg-amber-500/25 shrink-0 ml-2"
                >
                  Enable Location
                </Button>
              </div>
            )}

            {/* Top 5 Quick Selector Carousel */}
            {activeTab === "top5" && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Compass className="size-3.5 text-teal-600 dark:text-teal-400" />
                    Top 5 Closest Pharmacies
                  </span>
                  <span className="text-[10px] text-muted-foreground font-semibold">
                    Tap to view route
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                  {top5Pharmacies.map((pharmacy, idx) => {
                    const isSelected = selectedPharmacy?.id === pharmacy.id;
                    const rank = idx + 1;
                    return (
                      <button
                        key={pharmacy.id}
                        onClick={() => setSelectedPharmacy(pharmacy)}
                        className={`relative flex flex-col p-3 rounded-2xl border text-left transition-all active:scale-95 ${
                          isSelected
                            ? "bg-teal-500/10 border-teal-500 shadow-md shadow-teal-500/10 ring-2 ring-teal-500/30"
                            : "bg-muted/20 border-border/40 hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                              isSelected
                                ? "bg-teal-600 text-white"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            #{rank}
                          </span>
                          <span className="text-[11px] font-black text-teal-600 dark:text-teal-400">
                            {pharmacy.distanceKm !== undefined
                              ? `${pharmacy.distanceKm} km`
                              : ""}
                          </span>
                        </div>

                        <p className="text-xs font-bold text-foreground line-clamp-1 leading-snug">
                          {pharmacy.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                          {pharmacy.street || pharmacy.district}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Search & Filter Bar (when search tab is active) */}
            {activeTab === "search" && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Search pharmacy name, street, pharmacist..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-11 rounded-2xl font-medium"
                    />
                  </div>
                  <select
                    value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                    className="h-11 px-3 rounded-2xl border border-input bg-background text-xs font-bold text-foreground focus:ring-2 focus:ring-ring"
                  >
                    <option value="ALL">All Districts ({allDistricts.length})</option>
                    {allDistricts.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filtered items list */}
                <div className="max-h-40 overflow-y-auto no-scrollbar space-y-1.5 p-1 rounded-2xl bg-muted/20 border border-border/40">
                  {filteredPharmacies.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4 font-semibold">
                      No matching pharmacies found.
                    </p>
                  ) : (
                    filteredPharmacies.map((p) => {
                      const isSelected = selectedPharmacy?.id === p.id;
                      return (
                        <div
                          key={p.id}
                          onClick={() => setSelectedPharmacy(p)}
                          className={`p-2.5 rounded-xl cursor-pointer flex items-center justify-between transition-all ${
                            isSelected
                              ? "bg-teal-500/15 border border-teal-500/40 text-foreground"
                              : "hover:bg-muted/40 text-muted-foreground"
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <p className="text-xs font-bold text-foreground truncate">
                              {p.name}
                            </p>
                            <p className="text-[10px] truncate">
                              {p.address || p.street || p.district}
                            </p>
                          </div>
                          <span className="text-[11px] font-black text-teal-600 dark:text-teal-400 flex-shrink-0">
                            {p.distanceKm !== undefined ? `${p.distanceKm} km` : ""}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* MapLibre Route Map Component */}
            <div>
              <PharmacyRouteMap
                userCoords={userCoords}
                topPharmacies={activeTab === "top5" ? top5Pharmacies : filteredPharmacies.slice(0, 5)}
                selectedPharmacy={selectedPharmacy}
                route={route}
                isRouteLoading={isRouteLoading}
                onSelectPharmacy={(p) => setSelectedPharmacy(p)}
                className="h-[280px] w-full"
              />
            </div>

            {/* Active Selected Pharmacy Card */}
            {selectedPharmacy && (
              <motion.div
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 rounded-3xl bg-gradient-to-br from-card via-card to-muted/30 border border-teal-500/30 shadow-lg space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                        {selectedPharmacy.premiseType || "Retail Pharmacy"}
                      </span>
                      <span className="text-[9px] font-bold text-muted-foreground">
                        {selectedPharmacy.category}
                      </span>
                    </div>

                    <h3 className="text-lg font-black text-foreground tracking-tight mt-1 leading-snug">
                      {selectedPharmacy.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedPharmacy.address || selectedPharmacy.street},{" "}
                      <span className="font-semibold text-foreground">
                        {selectedPharmacy.district}
                      </span>
                    </p>
                  </div>

                  {/* Distance & ETA badge */}
                  <div className="flex flex-col items-end flex-shrink-0 bg-teal-500/10 border border-teal-500/20 p-2.5 rounded-2xl text-right">
                    <span className="text-base font-black text-teal-600 dark:text-teal-400 leading-none">
                      {route ? `${route.distanceKm} km` : `${selectedPharmacy.distanceKm ?? "—"} km`}
                    </span>
                    <span className="text-[10px] font-bold text-muted-foreground mt-1">
                      {route ? `~${route.durationMinutes} min ${transportMode}` : "Distance"}
                    </span>
                  </div>
                </div>

                {/* Pharmacist & Regulatory Metadata */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40 text-xs">
                  <div className="p-2.5 rounded-xl bg-background/60 border border-border/30">
                    <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                      Supervising Pharmacist
                    </p>
                    <p className="font-bold text-foreground mt-0.5 truncate">
                      {selectedPharmacy.pharmacist || "Registered Pharmacist"}
                    </p>
                    {selectedPharmacy.psuNo && (
                      <p className="text-[10px] text-muted-foreground">
                        PSU Reg: {selectedPharmacy.psuNo}
                      </p>
                    )}
                  </div>

                  <div className="p-2.5 rounded-xl bg-background/60 border border-border/30">
                    <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                      NDA License Number
                    </p>
                    <p className="font-bold text-teal-600 dark:text-teal-400 mt-0.5 truncate">
                      {selectedPharmacy.premiseNo}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Expires: {selectedPharmacy.expiryDate?.split(" ")[0] || "Active"}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-1">
                  <Button
                    onClick={() => handleOpenExternalMaps(selectedPharmacy)}
                    className="flex-1 h-12 rounded-2xl font-black bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
                  >
                    <Navigation className="size-4" />
                    <span>Open in Navigation</span>
                  </Button>

                  {medicine && onRefillLogged && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        onRefillLogged(medicine);
                        onClose();
                      }}
                      className="h-12 rounded-2xl font-bold border-border/60 text-xs"
                    >
                      <RefreshCw className="size-3.5 mr-1" /> Log Refill
                    </Button>
                  )}
                </div>
              </motion.div>
            )}

            {/* NDA Source Attribution Footer */}
            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/40 flex items-center justify-between gap-3 text-xs text-muted-foreground mt-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 shrink-0">
                  <ShieldCheck className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-foreground text-[11px] leading-tight truncate">
                    Source: National Drug Authority (NDA) Uganda
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 truncate">
                    Official Register of Licensed Drug Outlets & Pharmacies
                  </p>
                </div>
              </div>
              <a
                href="https://www.nda.or.ug"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-teal-600 dark:text-teal-400 hover:underline shrink-0 bg-teal-500/10 px-2.5 py-1 rounded-lg border border-teal-500/20"
              >
                nda.or.ug
              </a>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* In-Modal Location Permission Dialog */}
      <PermissionRequest
        isOpen={showLocationDialog}
        onClose={() => setShowLocationDialog(false)}
        onConfirm={async () => {
          setShowLocationDialog(false);
          try {
            await requestLocation();
          } catch (err) {
            console.warn("Location request failed:", err);
          }
        }}
        title="Enable Location Services"
        description="Allow DawaLens to access your device location to discover the nearest NDA-licensed pharmacies in Uganda and display real-time walking and driving routes."
        icon={Navigation}
        permissionName="Location"
      />
    </>,
    document.body
  );
};
