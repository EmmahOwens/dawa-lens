import React, { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import { motion, AnimatePresence } from "framer-motion";

export interface VitalityTrends3DProps {
  data: {
    name: string;
    adherence: number;
    energy: number | null;
    mood: number | null;
  }[];
}

// Fixed colors for the data series
const COLORS = {
  adherence: 0x3b82f6, // Blue
  energy: 0x10b981,    // Emerald Green
  mood: 0x6366f1,      // Indigo
};

interface HoveredState {
  name: string;
  adherence: number;
  energy: number | null;
  mood: number | null;
  x: number;
  y: number;
  type: "adherence" | "energy" | "mood";
  value: number;
}

export function VitalityTrends3D({ data }: VitalityTrends3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [hoveredData, setHoveredData] = useState<HoveredState | null>(null);
  // Store 2D screen positions for day labels
  const [dayLabelPositions, setDayLabelPositions] = useState<{ name: string; x: number; y: number }[]>([]);

  // Helper to extract theme colors dynamically from CSS variables
  const getThemeColors = () => {
    if (typeof window === "undefined") return { border: "#e2e8f0", text: "#64748b" };
    const style = getComputedStyle(document.documentElement);
    
    const getHSLVal = (varName: string, fallback: string) => {
      const val = style.getPropertyValue(varName).trim();
      if (!val) return fallback;
      if (val.includes(" ")) {
        return `hsl(${val.replace(/\s+/g, ", ")})`;
      }
      return val;
    };

    return {
      border: getHSLVal("--border", "#e2e8f0"),
      text: getHSLVal("--muted-foreground", "#64748b"),
    };
  };

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const canvas = canvasRef.current;

    // Dimensions
    let width = container.clientWidth || 300;
    let height = container.clientHeight || 260;

    // 1. Scene setup
    const scene = new THREE.Scene();

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 4.5, 9.5);

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0xffffff, 0.5, 10);
    pointLight.position.set(-3, 2, -3);
    scene.add(pointLight);

    // 5. Pivot Group (handles user-drag rotation)
    const pivot = new THREE.Group();
    // Default tilt
    pivot.rotation.x = 0.35;
    pivot.rotation.y = -0.45;
    scene.add(pivot);

    // 6. Base / Grid deck
    const themeColors = getThemeColors();
    const gridColorStr = themeColors.border;
    const textColorStr = themeColors.text;

    // Draw base platform
    const baseWidth = 10;
    const baseDepth = 4.2;
    const baseGeo = new THREE.BoxGeometry(baseWidth, 0.05, baseDepth);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.05,
      roughness: 0.9,
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = -0.025;
    pivot.add(base);

    // Platform boundary wireframe
    const edges = new THREE.EdgesGeometry(baseGeo);
    const lineMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(gridColorStr),
      transparent: true,
      opacity: 0.3,
    });
    const baseWire = new THREE.LineSegments(edges, lineMat);
    baseWire.position.y = -0.025;
    pivot.add(baseWire);

    // 7. Render 3D columns for days
    const spacingX = 1.35;
    const startX = -((data.length - 1) * spacingX) / 2;
    const zCoords = {
      adherence: -1.1,
      energy: 0,
      mood: 1.1,
    };

    const columns: {
      mesh: THREE.Mesh;
      targetYScale: number;
      currentYScale: number;
      type: "adherence" | "energy" | "mood";
      dayIndex: number;
      material: THREE.MeshStandardMaterial;
    }[] = [];

    const columnGeo = new THREE.BoxGeometry(0.32, 1, 0.32);

    data.forEach((day, dayIdx) => {
      const x = startX + dayIdx * spacingX;

      const series = [
        { type: "adherence", value: day.adherence, max: 100, color: COLORS.adherence },
        { type: "energy", value: day.energy, max: 100, color: COLORS.energy },
        { type: "mood", value: day.mood, max: 100, color: COLORS.mood },
      ] as const;

      series.forEach((s) => {
        if (s.value === null) return;

        // Scale heights: max height is 2.5 units
        const scaleVal = s.value / s.max;
        const targetYScale = Math.max(scaleVal * 2.5, 0.05); // Minimum height to show visual presence

        const colMat = new THREE.MeshStandardMaterial({
          color: s.color,
          transparent: true,
          opacity: 0.8,
          roughness: 0.2,
          metalness: 0.1,
          emissive: s.color,
          emissiveIntensity: 0.12,
        });

        const mesh = new THREE.Mesh(columnGeo, colMat);
        // Initially flat for intro animation
        mesh.scale.set(1, 0.01, 1);
        mesh.position.set(x, 0.005, zCoords[s.type]);
        
        mesh.userData = {
          dayIdx,
          type: s.type,
          value: s.value,
          originalColor: s.color,
        };

        pivot.add(mesh);
        columns.push({
          mesh,
          targetYScale,
          currentYScale: 0.01,
          type: s.type,
          dayIndex: dayIdx,
          material: colMat,
        });
      });
    });

    // 8. Custom Grid Lines
    // Draw lines along X axis (connecting series columns)
    const gridLinesGeo = new THREE.BufferGeometry();
    const gridPoints: number[] = [];

    // Horizontal lines for days
    for (let i = 0; i < data.length; i++) {
      const x = startX + i * spacingX;
      gridPoints.push(x, 0, -1.5, x, 0, 1.5);
    }
    // Longitudinal lines for series
    Object.values(zCoords).forEach((z) => {
      gridPoints.push(startX - 0.5, 0, z, startX + (data.length - 1) * spacingX + 0.5, 0, z);
    });

    gridLinesGeo.setAttribute("position", new THREE.Float32BufferAttribute(gridPoints, 3));
    const gridLines = new THREE.LineSegments(
      gridLinesGeo,
      new THREE.LineBasicMaterial({
        color: new THREE.Color(gridColorStr),
        transparent: true,
        opacity: 0.15,
      })
    );
    pivot.add(gridLines);

    // 9. Interactivity — Pointer/Touch rotation & Raycasting
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let isDragging = false;
    let dragStart = { x: 0, y: 0 };
    let rotationStart = { x: pivot.rotation.x, y: pivot.rotation.y };
    let hasMoved = false;

    // Hover detection
    let currentHoveredCol: typeof columns[number] | null = null;

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      hasMoved = false;
      dragStart = { x: e.clientX, y: e.clientY };
      rotationStart = { x: pivot.rotation.x, y: pivot.rotation.y };
      canvas.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      // Handle drag rotation
      if (isDragging) {
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;
        
        if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
          hasMoved = true;
        }

        pivot.rotation.y = rotationStart.y + deltaX * 0.007;
        pivot.rotation.x = Math.max(0.15, Math.min(0.8, rotationStart.x + deltaY * 0.007));
      }

      // Normalized coordinates for Raycasting
      mouse.x = (clientX / rect.width) * 2 - 1;
      mouse.y = -(clientY / rect.height) * 2 + 1;

      // Raycast columns
      raycaster.setFromCamera(mouse, camera);
      const meshesToCheck = columns.map((c) => c.mesh);
      const intersects = raycaster.intersectObjects(meshesToCheck);

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as THREE.Mesh;
        const col = columns.find((c) => c.mesh === hitMesh) || null;

        if (col && col !== currentHoveredCol) {
          // Reset old hover
          if (currentHoveredCol) {
            currentHoveredCol.material.emissiveIntensity = 0.12;
            currentHoveredCol.material.opacity = 0.8;
          }

          // Apply new hover style
          currentHoveredCol = col;
          col.material.emissiveIntensity = 0.45;
          col.material.opacity = 0.95;

          // Get screen position of hovered column top
          const tempV = new THREE.Vector3();
          hitMesh.getWorldPosition(tempV);
          tempV.y += col.currentYScale / 2; // Offset to the top of the column
          tempV.project(camera);

          const screenX = ((tempV.x + 1) * rect.width) / 2;
          const screenY = ((-tempV.y + 1) * rect.height) / 2;

          setHoveredData({
            name: data[col.dayIndex].name,
            adherence: data[col.dayIndex].adherence,
            energy: data[col.dayIndex].energy,
            mood: data[col.dayIndex].mood,
            x: screenX,
            y: screenY - 14,
            type: col.type,
            value: hitMesh.userData.value,
          });
        } else if (col && currentHoveredCol) {
          // Update tooltip position if camera is rotating
          const tempV = new THREE.Vector3();
          col.mesh.getWorldPosition(tempV);
          tempV.y += col.currentYScale / 2;
          tempV.project(camera);
          const screenX = ((tempV.x + 1) * rect.width) / 2;
          const screenY = ((-tempV.y + 1) * rect.height) / 2;
          setHoveredData((prev) => prev ? { ...prev, x: screenX, y: screenY - 14 } : null);
        }
      } else {
        if (currentHoveredCol) {
          currentHoveredCol.material.emissiveIntensity = 0.12;
          currentHoveredCol.material.opacity = 0.8;
          currentHoveredCol = null;
          setHoveredData(null);
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      isDragging = false;
      canvas.releasePointerCapture(e.pointerId);
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    // 10. Animation Loop
    let animationId = 0;
    const tempLabelPos = new THREE.Vector3();

    const animate = () => {
      animationId = requestAnimationFrame(animate);

      // Interpolate column heights (intro grow animation)
      let needsRender = false;
      columns.forEach((col) => {
        if (Math.abs(col.currentYScale - col.targetYScale) > 0.005) {
          col.currentYScale += (col.targetYScale - col.currentYScale) * 0.1;
          col.mesh.scale.y = col.currentYScale;
          col.mesh.position.y = col.currentYScale / 2;
          needsRender = true;
        }
      });

      // Project day labels to screen coordinates (at base floor)
      const positions = data.map((day, dayIdx) => {
        const x = startX + dayIdx * spacingX;
        // Position labels slightly forward along Z axis
        tempLabelPos.set(x, -0.05, 2.2);
        tempLabelPos.applyMatrix4(pivot.matrixWorld);
        tempLabelPos.project(camera);

        const screenX = ((tempLabelPos.x + 1) * width) / 2;
        const screenY = ((-tempLabelPos.y + 1) * height) / 2;

        return {
          name: day.name,
          x: screenX,
          y: screenY,
        };
      });
      setDayLabelPositions(positions);

      renderer.render(scene, camera);
    };

    animate();

    // 11. Handle container resizing
    const resizeObserver = new ResizeObserver(() => {
      if (!containerRef.current) return;
      width = containerRef.current.clientWidth;
      height = containerRef.current.clientHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      renderer.setSize(width, height);
    });
    resizeObserver.observe(container);

    // Clean up
    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      
      // Dispose materials & geometries
      columnGeo.dispose();
      baseGeo.dispose();
      baseMat.dispose();
      lineMat.dispose();
      edges.dispose();
      gridLinesGeo.dispose();
      columns.forEach((col) => col.material.dispose());
      renderer.dispose();
    };
  }, [data]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[260px] md:h-[280px] overflow-hidden select-none cursor-grab active:cursor-grabbing"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block touch-none"
      />

      {/* Floating Interactive Tooltip */}
      <AnimatePresence>
        {hoveredData && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ duration: 0.12 }}
            style={{
              position: "absolute",
              left: hoveredData.x,
              top: hoveredData.y,
              transform: "translate(-50%, -100%)",
              pointerEvents: "none",
            }}
            className="z-30 bg-card border border-border px-3 py-2 rounded-xl shadow-xl flex flex-col gap-0.5 min-w-[110px]"
          >
            <p className="text-[9px] font-black uppercase text-muted-foreground tracking-wider mb-0.5">
              {hoveredData.name}
            </p>
            <div className="flex items-center gap-1.5 justify-between">
              <span className="flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor:
                      hoveredData.type === "adherence"
                        ? "#3b82f6"
                        : hoveredData.type === "energy"
                        ? "#10b981"
                        : "#6366f1",
                  }}
                />
                <span className="text-[10px] font-bold text-foreground capitalize">
                  {hoveredData.type}
                </span>
              </span>
              <span className="text-[11px] font-extrabold text-foreground">
                {hoveredData.value}
                {hoveredData.type === "adherence" ? "%" : "/5"}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CSS overlay day labels */}
      <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
        {dayLabelPositions.map((pos, idx) => {
          // Only render if coordinates are valid inside the viewport bounds
          if (isNaN(pos.x) || isNaN(pos.y)) return null;

          return (
            <div
              key={idx}
              style={{
                position: "absolute",
                left: pos.x,
                top: pos.y,
                transform: "translate(-50%, -50%)",
              }}
              className="text-[8px] font-black tracking-tighter uppercase text-muted-foreground/70 bg-background/30 backdrop-blur-[1px] px-1 rounded shadow-sm border border-border/10"
            >
              {pos.name.split(" ")[1] || pos.name}
            </div>
          );
        })}
      </div>
    </div>
  );
}
