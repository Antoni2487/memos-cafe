import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./sidebar";
import Navbar from "./navbar";
import useApiErrors from "../../hooks/useApiErrors";

export default function Layout() {
  const { error, clearError } = useApiErrors();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "#F8F4EE" }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Overlay móvil — clic afuera cierra el drawer */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 md:hidden"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
        />
      )}

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        {/* Banner global de errores API */}
        {error && (
          <div
            onClick={clearError}
            style={{
              backgroundColor: "rgba(198,40,40,0.08)",
              border: "1px solid rgba(198,40,40,0.25)",
              borderRadius: "8px", padding: "10px 20px",
              margin: "8px 16px 0",
              cursor: "pointer",
              fontFamily: "'Lato', sans-serif",
              fontSize: "13px", color: "#c62828",
              zIndex: 50,
            }}
          >
            ⚠ {error} — <span style={{ textDecoration: "underline" }}>Cerrar</span>
          </div>
        )}
        <main className="flex-1 overflow-y-auto relative" style={{ backgroundColor: "#F8F4EE" }}>
          <BotanicalWatermark />
          <div className="relative z-10 p-3 sm:p-4 md:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function BotanicalWatermark() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 600 600"
      className="hidden md:block"
      style={{
        position: "fixed",
        bottom: 0,
        right: 0,
        width: 480,
        height: 480,
        opacity: 0.045,
        pointerEvents: "none",
        userSelect: "none",
        zIndex: 0,
      }}
    >
      <path d="M520 540 Q420 460 380 380 Q340 300 300 240" stroke="#2C5545" strokeWidth="2.5" fill="none" />
      <path d="M380 380 Q350 340 320 310 Q290 280 260 270" stroke="#2C5545" strokeWidth="1.8" fill="none" />
      <path d="M340 300 Q310 280 275 265 Q240 250 210 255" stroke="#2C5545" strokeWidth="1.5" fill="none" />
      <path d="M300 240 Q270 220 240 215 Q210 210 190 220" stroke="#2C5545" strokeWidth="1.4" fill="none" />
      <ellipse cx="320" cy="310" rx="30" ry="14" transform="rotate(-35 320 310)" fill="#2C5545" />
      <ellipse cx="275" cy="265" rx="26" ry="12" transform="rotate(-40 275 265)" fill="#2C5545" />
      <ellipse cx="240" cy="215" rx="22" ry="10" transform="rotate(-45 240 215)" fill="#2C5545" />
      <ellipse cx="350" cy="340" rx="28" ry="13" transform="rotate(25 350 340)" fill="#2C5545" />
      <ellipse cx="295" cy="295" rx="24" ry="11" transform="rotate(20 295 295)" fill="#2C5545" />
      <ellipse cx="255" cy="250" rx="22" ry="10" transform="rotate(15 255 250)" fill="#2C5545" />
      <path d="M450 500 Q430 460 410 430 Q390 400 370 380" stroke="#2C5545" strokeWidth="2" fill="none" />
      <ellipse cx="405" cy="435" rx="22" ry="10" transform="rotate(-30 405 435)" fill="#2C5545" />
      <ellipse cx="420" cy="415" rx="20" ry="9" transform="rotate(20 420 415)" fill="#2C5545" />
      <circle cx="300" cy="240" r="12" fill="#2C5545" />
      <ellipse cx="300" cy="225" rx="6" ry="10" fill="#2C5545" />
      <ellipse cx="300" cy="255" rx="6" ry="10" fill="#2C5545" />
      <ellipse cx="285" cy="240" rx="10" ry="6" fill="#2C5545" />
      <ellipse cx="315" cy="240" rx="10" ry="6" fill="#2C5545" />
      <ellipse cx="289" cy="229" rx="6" ry="10" transform="rotate(-45 289 229)" fill="#2C5545" />
      <ellipse cx="311" cy="251" rx="6" ry="10" transform="rotate(-45 311 251)" fill="#2C5545" />
      <ellipse cx="311" cy="229" rx="6" ry="10" transform="rotate(45 311 229)" fill="#2C5545" />
      <ellipse cx="289" cy="251" rx="6" ry="10" transform="rotate(45 289 251)" fill="#2C5545" />
      <circle cx="300" cy="240" r="5" fill="#2C5545" />
      <circle cx="260" cy="270" r="5" fill="#2C5545" />
      <circle cx="252" cy="262" r="4" fill="#2C5545" />
      <circle cx="268" cy="263" r="4" fill="#2C5545" />
    </svg>
  );
}
