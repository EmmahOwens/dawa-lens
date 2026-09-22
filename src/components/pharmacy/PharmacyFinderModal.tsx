import React, { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss";
import { useNearbyPharmacies } from "@/hooks/useNearbyPharmacies";
import { PharmacyRouteMap } from "./PharmacyRouteMap";
import { getDirectionsUrl, formatDuration, NdaPharmacy } from "@/services/pharmacyService";
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
  WifiOff,
  Pill,
} from "@/lib/icons";
import PermissionRequest from "@/components/PermissionRequest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ─── Types ────────────────────────────────────────────────────────────────────
interface PharmacyFinderModalProps {
  medicine?: Medicine | null;
  onClose: () => void;
  onRefillLogged?: (medicine: Medicine) => void;
}

type OutletTab = "pharmacy" | "drug_shop";
type ViewTab = "top5" | "search";

// ─── Shared sub-components ────────────────────────────────────────────────────

/** Top-5 card row shared between both outlet tabs */
function Top5Card({
  outlet,
  index,
  isSelected,
  onSelect,
  accentClass,
  accentSolid,
  isPharmacyTab,
  route,
}: {
  outlet: NdaPharmacy;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  accentClass: string;
  accentSolid: string;
  isPharmacyTab: boolean;
  route: ReturnType<typeof useNearbyPharmacies>["route"];
}) {
  const rank = index + 1;
  const distanceKm = isSelected && route ? route.distanceKm : outlet.distanceKm;

  return (
    <button
      key={outlet.id}
      onClick={onSelect}
      className={`relative flex flex-col p-3 rounded-2xl border text-left transition-all active:scale-95 ${
        isSelected
          ? `${accentClass} shadow-md ring-2`
          : "bg-muted/20 border-border/40 hover:bg-muted/40"
      }`}
    >
      <div className="flex items-center justify-between gap-1 mb-1">
        <span
          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 transition-colors ${
            isSelected ? accentSolid : "bg-muted text-muted-foreground"
          }`}
        >
          #{rank}
        </span>
        {distanceKm !== undefined && (
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-black border tracking-tight transition-colors ${
              isPharmacyTab
                ? isSelected
                  ? "bg-teal-500/20 border-teal-500/40 text-teal-800 dark:text-teal-200"
                  : "bg-teal-500/10 border-teal-500/20 text-teal-700 dark:text-teal-300"
                : isSelected
                  ? "bg-amber-500/20 border-amber-500/40 text-amber-800 dark:text-amber-200"
                  : "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300"
            }`}
          >
            {distanceKm} km
          </span>
        )}
      </div>
      <p className="text-xs font-bold text-foreground line-clamp-1 leading-snug">
        {outlet.name}
      </p>
      <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
        {outlet.street || outlet.district}
      </p>
    </button>
  );
}

/** Selected outlet details card */
function SelectedCard({
  outlet,
  route,
  isRouteLoading,
  transportMode,
  medicine,
  onRefillLogged,
  onClose,
  onNavigate,
  isDrugShop,
}: {
  outlet: NdaPharmacy;
  route: ReturnType<typeof useNearbyPharmacies>["route"];
  isRouteLoading: boolean;
  transportMode: "driving" | "walking";
  medicine?: Medicine | null;
  onRefillLogged?: (m: Medicine) => void;
  onClose: () => void;
  onNavigate: () => void;
  isDrugShop: boolean;
}) {
  const accentBorder = isDrugShop ? "border-amber-500/30" : "border-teal-500/30";
  const accentBg = isDrugShop ? "bg-amber-500/10" : "bg-teal-500/10";
  const accentBorder2 = isDrugShop ? "border-amber-500/20" : "border-teal-500/20";
  const accentText = isDrugShop ? "text-amber-600 dark:text-amber-400" : "text-teal-600 dark:text-teal-400";
  const btnClass = isDrugShop
    ? "bg-amber-600 hover:bg-amber-700 shadow-amber-500/20"
    : "bg-teal-600 hover:bg-teal-700 shadow-teal-500/20";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-5 rounded-3xl bg-gradient-to-br from-card via-card to-muted/30 border ${accentBorder} shadow-lg space-y-4`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${accentBg} ${accentText} border ${accentBorder2}`}>
              {outlet.premiseType || (isDrugShop ? "Drug Shop" : "Retail Pharmacy")}
            </span>
            <span className="text-[9px] font-bold text-muted-foreground">{outlet.category}</span>
          </div>
          <h3 className="text-lg font-black text-foreground tracking-tight mt-1 leading-snug">
            {outlet.name}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {outlet.address || outlet.street},{" "}
            <span className="font-semibold text-foreground">{outlet.district}</span>
          </p>
          {outlet.region && (
            <p className="text-[10px] text-muted-foreground mt-0.5 italic">{outlet.region}</p>
          )}
        </div>

        {/* Distance & ETA badge */}
        <div className={`flex flex-col items-end flex-shrink-0 ${accentBg} border ${accentBorder2} p-2.5 rounded-2xl text-right`}>
          <span className={`text-base font-black ${accentText} leading-none`}>
            {route ? `${route.distanceKm} km` : `${outlet.distanceKm ?? "—"} km`}
          </span>
          <span className="text-[10px] font-bold text-muted-foreground mt-1">
            {route
              ? `${formatDuration(route.durationMinutes)} ${transportMode}`
              : "Distance"}
          </span>
        </div>
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40 text-xs">
        <div className="p-2.5 rounded-xl bg-background/60 border border-border/30">
          <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
            {isDrugShop ? "Owner / Proprietor" : "Supervising Pharmacist"}
          </p>
          <p className="font-bold text-foreground mt-0.5 truncate">
            {outlet.pharmacist || (isDrugShop ? "Licensed Drug Shop" : "Registered Pharmacist")}
          </p>
          {outlet.psuNo && (
            <p className="text-[10px] text-muted-foreground">PSU Reg: {outlet.psuNo}</p>
          )}
        </div>
        <div className="p-2.5 rounded-xl bg-background/60 border border-border/30">
          <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
            NDA License Number
          </p>
          <p className={`font-bold ${accentText} mt-0.5 truncate`}>{outlet.premiseNo}</p>
          <p className="text-[10px] text-muted-foreground">
            Expires: {outlet.expiryDate?.split(" ")[0] || "Active"}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <Button
          onClick={onNavigate}
          className={`flex-1 h-12 rounded-2xl font-black ${btnClass} text-white shadow-lg flex items-center justify-center gap-2 text-xs uppercase tracking-wider`}
        >
          <Navigation className="size-4" />
          <span>Open in Navigation</span>
        </Button>
        {medicine && onRefillLogged && (
          <Button
            variant="outline"
            onClick={() => { onRefillLogged(medicine); onClose(); }}
            className="h-12 rounded-2xl font-bold border-border/60 text-xs"
          >
            <RefreshCw className="size-3.5 mr-1" /> Log Refill
          </Button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export const PharmacyFinderModal: React.FC<PharmacyFinderModalProps> = ({
  medicine,
  onClose,
  onRefillLogged,
}) => {
  const {
    userCoords,
    isUsingPreviousLocation,
    isNetworkIssue,
    geoStatus,
    requestLocation,
    // Pharmacies
    top5Pharmacies,
    filteredPharmacies,
    searchQuery,
    setSearchQuery,
    selectedDistrict,
    setSelectedDistrict,
    allDistricts,
    // Drug shops
    top5DrugShops,
    filteredDrugShops,
    dsSearchQuery,
    setDsSearchQuery,
    dsSelectedDistrict,
    setDsSelectedDistrict,
    allDrugShopDistricts,
    // Shared
    selectedPharmacy,
    setSelectedPharmacy,
    route,
    isRouteLoading,
    transportMode,
    setTransportMode,
  } = useNearbyPharmacies();

  const [outletTab, setOutletTab] = useState<OutletTab>("pharmacy");
  const [viewTab, setViewTab] = useState<ViewTab>("top5");
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const swipe = useSwipeToDismiss(onClose);

  const isPharmacyTab = outletTab === "pharmacy";
  const isDrugShopTab = outletTab === "drug_shop";

  // Which set of data to show in the map + list
  const activeTop5 = isPharmacyTab ? top5Pharmacies : top5DrugShops;
  const activeFiltered = isPharmacyTab ? filteredPharmacies : filteredDrugShops;
  const activeSearch = isPharmacyTab ? searchQuery : dsSearchQuery;
  const setActiveSearch = isPharmacyTab ? setSearchQuery : setDsSearchQuery;
  const activeDistrict = isPharmacyTab ? selectedDistrict : dsSelectedDistrict;
  const setActiveDistrict = isPharmacyTab ? setSelectedDistrict : setDsSelectedDistrict;
  const activeDistricts = isPharmacyTab ? allDistricts : allDrugShopDistricts;

  const mapOutlets = viewTab === "top5" ? activeTop5 : activeFiltered.slice(0, 5);

  // Colour tokens
  const accentClass = isPharmacyTab
    ? "bg-teal-500/10 border-teal-500 ring-teal-500/30"
    : "bg-amber-500/10 border-amber-500 ring-amber-500/30";
  const accentText = isPharmacyTab
    ? "text-teal-600 dark:text-teal-400"
    : "text-amber-600 dark:text-amber-400";
  const accentSolid = isPharmacyTab
    ? "bg-teal-600 text-white"
    : "bg-amber-600 text-white";
  const accentBadge = isPharmacyTab
    ? "bg-teal-500/10 border-teal-500/20 text-teal-600 dark:text-teal-400"
    : "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400";
  const activeTabClass = isPharmacyTab
    ? "bg-teal-600 text-white shadow-sm"
    : "bg-amber-600 text-white shadow-sm";

  const handleOpenExternalMaps = (outlet: NdaPharmacy) => {
    const url = getDirectionsUrl(outlet.latitude, outlet.longitude, outlet.name, {
      userCoords,
      mode: transportMode,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // When switching outlet tab, auto-select the top nearest from new set
  const handleOutletTabChange = (tab: OutletTab) => {
    setOutletTab(tab);
    const top = tab === "pharmacy" ? top5Pharmacies : top5DrugShops;
    if (top.length > 0) setSelectedPharmacy(top[0]);
    setViewTab("top5");
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
          {/* Grab handle */}
          <motion.div
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.3 }}
            onDragEnd={(_e, info) => { if (info.offset.y > 80) onClose(); }}
            className="flex-shrink-0 pt-4 pb-2 px-6 cursor-grab active:cursor-grabbing touch-pan-x select-none"
            {...swipe}
          >
            <div className="w-12 h-1.5 rounded-full bg-muted/80 hover:bg-muted mx-auto transition-colors" />
          </motion.div>

          {/* ── Modal Header ────────────────────────────────────────── */}
          <div className="px-6 pb-4 border-b border-border/40 shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${accentBadge}`}>
                    <CheckCircle className="size-3" /> NDA Uganda
                  </span>
                  {medicine && (
                    <span className="inline-flex items-center rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-600 dark:text-amber-400">
                      Refill Radar
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-black tracking-tight text-foreground leading-tight">
                  {medicine ? `Refill ${medicine.name}` : "Find Nearest Licensed Outlet"}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isPharmacyTab
                    ? "NDA-licensed pharmacies (drug outlets) with live road routes."
                    : "NDA-licensed drug shops across all Uganda regions."}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-2xl bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <CloseSquare size={20} />
              </button>
            </div>

            {/* ── Outlet Type Switcher (Pharmacies / Drug Shops) ─── */}
            <div className="mt-4 flex rounded-2xl bg-muted/40 p-1 border border-border/40 gap-1">
              <button
                onClick={() => handleOutletTabChange("pharmacy")}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-black transition-all ${
                  isPharmacyTab
                    ? "bg-teal-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Building className="size-3.5" />
                Pharmacies
                <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[9px] font-black ${isPharmacyTab ? "bg-white/20" : "bg-muted/60"}`}>
                  {top5Pharmacies.length > 0 ? "Outlets" : "—"}
                </span>
              </button>
              <button
                onClick={() => handleOutletTabChange("drug_shop")}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-black transition-all ${
                  isDrugShopTab
                    ? "bg-amber-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Pill className="size-3.5" />
                Drug Shops
                <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[9px] font-black ${isDrugShopTab ? "bg-white/20" : "bg-muted/60"}`}>
                  NDA Licensed
                </span>
              </button>
            </div>

            {/* ── Sub-row: Top 5 / Search + Travel Mode ─────────── */}
            <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex rounded-xl bg-muted/40 p-1 border border-border/40">
                <button
                  onClick={() => setViewTab("top5")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    viewTab === "top5"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Top 5 Nearest
                </button>
                <button
                  onClick={() => setViewTab("search")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    viewTab === "search"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Search & Filter
                </button>
              </div>

              <div className="flex rounded-xl bg-muted/40 p-1 border border-border/40">
                <button
                  onClick={() => setTransportMode("driving")}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    transportMode === "driving"
                      ? `${isDrugShopTab ? "bg-amber-600" : "bg-teal-600"} text-white shadow-sm`
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Car className="size-3.5" /> Driving
                </button>
                <button
                  onClick={() => setTransportMode("walking")}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    transportMode === "walking"
                      ? `${isDrugShopTab ? "bg-amber-600" : "bg-teal-600"} text-white shadow-sm`
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Navigation className="size-3.5" /> Walking
                </button>
              </div>
            </div>
          </div>

          {/* ── Modal Body ──────────────────────────────────────────── */}
          <div className="p-6 space-y-5 flex-1 overflow-y-auto no-scrollbar touch-auto overscroll-contain">

            {/* Location / Network warning */}
            {isNetworkIssue ? (
              <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <WifiOff className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span className="truncate">
                    {isUsingPreviousLocation
                      ? "Network issue detected. Using your previous location (offline mode)."
                      : "Network issue detected. Defaulting to Kampala area."}
                  </span>
                </div>
                <Button size="sm" variant="outline" onClick={() => requestLocation()}
                  className="h-7 text-[10px] font-bold rounded-xl border-amber-500/30 bg-amber-500/15 hover:bg-amber-500/25 shrink-0 ml-2">
                  Retry GPS
                </Button>
              </div>
            ) : (geoStatus === "denied" || geoStatus === "error") && (
              <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Location className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span className="truncate">
                    {isUsingPreviousLocation
                      ? "Location disabled. Showing your previous location."
                      : "Location disabled. Showing default Kampala area."}
                  </span>
                </div>
                <Button size="sm" variant="outline" onClick={() => setShowLocationDialog(true)}
                  className="h-7 text-[10px] font-bold rounded-xl border-amber-500/30 bg-amber-500/15 hover:bg-amber-500/25 shrink-0 ml-2">
                  Enable Location
                </Button>
              </div>
            )}

            {/* ── Drug Shop regional info banner ───────────────────── */}
            <AnimatePresence mode="wait">
              {isDrugShopTab && (
                <motion.div
                  key="ds-banner"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                      <Pill className="size-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-amber-700 dark:text-amber-300">
                        NDA-Licensed Drug Shops — All 9 Regions
                      </p>
                      <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70 mt-0.5">
                        Western · South Western · Central · Eastern · West Nile · Northern · South Eastern · Kampala Extra · North Eastern
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Top 5 Carousel ───────────────────────────────────── */}
            {viewTab === "top5" && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                    isPharmacyTab ? "text-teal-600 dark:text-teal-400" : "text-amber-600 dark:text-amber-400"
                  }`}>
                    <Compass className="size-3.5" />
                    {isPharmacyTab ? "Top 5 Nearest Pharmacies" : "Top 5 Nearest Drug Shops"}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-semibold">Tap to view route</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                  {activeTop5.map((outlet, idx) => (
                    <Top5Card
                      key={outlet.id}
                      outlet={outlet}
                      index={idx}
                      isSelected={selectedPharmacy?.id === outlet.id}
                      onSelect={() => setSelectedPharmacy(outlet)}
                      accentClass={accentClass}
                      accentSolid={accentSolid}
                      isPharmacyTab={isPharmacyTab}
                      route={route}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── Search & Filter ──────────────────────────────────── */}
            {viewTab === "search" && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      placeholder={isPharmacyTab
                        ? "Search pharmacy name, pharmacist, district…"
                        : "Search drug shop name, district, region…"}
                      value={activeSearch}
                      onChange={(e) => setActiveSearch(e.target.value)}
                      className="pl-9 h-11 rounded-2xl font-medium"
                    />
                  </div>
                  <select
                    value={activeDistrict}
                    onChange={(e) => setActiveDistrict(e.target.value)}
                    className="h-11 px-3 rounded-2xl border border-input bg-background text-xs font-bold text-foreground focus:ring-2 focus:ring-ring"
                  >
                    <option value="ALL">All Districts ({activeDistricts.length})</option>
                    {activeDistricts.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {/* Filtered list */}
                <div className="max-h-40 overflow-y-auto no-scrollbar space-y-1.5 p-1 rounded-2xl bg-muted/20 border border-border/40">
                  {activeFiltered.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4 font-semibold">
                      No matching {isPharmacyTab ? "pharmacies" : "drug shops"} found.
                    </p>
                  ) : (
                    activeFiltered.map((p) => {
                      const isSelected = selectedPharmacy?.id === p.id;
                      return (
                        <div
                          key={p.id}
                          onClick={() => setSelectedPharmacy(p)}
                          className={`p-2.5 rounded-xl cursor-pointer flex items-center justify-between transition-all ${
                            isSelected
                              ? `${isPharmacyTab ? "bg-teal-500/15 border border-teal-500/40" : "bg-amber-500/15 border border-amber-500/40"} text-foreground`
                              : "hover:bg-muted/40 text-muted-foreground"
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <p className="text-xs font-bold text-foreground truncate">{p.name}</p>
                            <p className="text-[10px] truncate">{p.district}{p.region ? ` · ${p.region}` : ""}</p>
                          </div>
                          <span className={`text-[11px] font-black flex-shrink-0 ${
                            isPharmacyTab ? "text-teal-600 dark:text-teal-400" : "text-amber-600 dark:text-amber-400"
                          }`}>
                            {(isSelected && route ? route.distanceKm : p.distanceKm) !== undefined
                              ? `${isSelected && route ? route.distanceKm : p.distanceKm} km`
                              : ""}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* ── Map ─────────────────────────────────────────────────── */}
            <PharmacyRouteMap
              userCoords={userCoords}
              topPharmacies={mapOutlets}
              selectedPharmacy={selectedPharmacy}
              route={route}
              isRouteLoading={isRouteLoading}
              onSelectPharmacy={(p) => setSelectedPharmacy(p)}
              className="h-[260px] w-full"
            />

            {/* ── Selected outlet detail card ───────────────────────── */}
            {selectedPharmacy && (
              <SelectedCard
                outlet={selectedPharmacy}
                route={route}
                isRouteLoading={isRouteLoading}
                transportMode={transportMode}
                medicine={medicine}
                onRefillLogged={onRefillLogged}
                onClose={onClose}
                onNavigate={() => handleOpenExternalMaps(selectedPharmacy)}
                isDrugShop={selectedPharmacy.outletType === "drug_shop"}
              />
            )}

            {/* ── NDA Source Footer ─────────────────────────────────── */}
            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/40 flex items-center justify-between gap-3 text-xs text-muted-foreground mt-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`p-1.5 rounded-lg border shrink-0 ${
                  isPharmacyTab
                    ? "bg-teal-500/10 border-teal-500/20 text-teal-600 dark:text-teal-400"
                    : "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                }`}>
                  <ShieldCheck className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-foreground text-[11px] leading-tight truncate">
                    Source: National Drug Authority (NDA) Uganda
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 truncate">
                    {isPharmacyTab
                      ? "Official Register of Licensed Drug Outlets & Pharmacies"
                      : "Licensed Drug Shops — All 9 Regional Zones"}
                  </p>
                </div>
              </div>
              <a
                href="https://www.nda.or.ug"
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider hover:underline shrink-0 px-2.5 py-1 rounded-lg border ${
                  isPharmacyTab
                    ? "text-teal-600 dark:text-teal-400 bg-teal-500/10 border-teal-500/20"
                    : "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20"
                }`}
              >
                nda.or.ug
              </a>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Location Permission Dialog */}
      <PermissionRequest
        isOpen={showLocationDialog}
        onClose={() => setShowLocationDialog(false)}
        onConfirm={async () => {
          setShowLocationDialog(false);
          try { await requestLocation(); } catch (err) {
            console.warn("Location request failed:", err);
          }
        }}
        title="Enable Location Services"
        description="Allow DawaLens to access your device location to discover the nearest NDA-licensed pharmacies and drug shops in Uganda with real-time walking and driving routes."
        icon={Navigation}
        permissionName="Location"
      />
    </>,
    document.body
  );
};
