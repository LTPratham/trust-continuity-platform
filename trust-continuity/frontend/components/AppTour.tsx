"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Compass, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  ShieldCheck, 
  Users, 
  FileBox, 
  ShieldAlert, 
  History, 
  Check, 
  ExternalLink 
} from "lucide-react";

interface TourStep {
  title: string;
  badge: string;
  icon: React.ReactNode;
  page?: string;
  pageLabel?: string;
  description: string;
  takeaway: string;
}

export function AppTour() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const steps: TourStep[] = [
    {
      title: "Welcome to Trust Continuity Platform",
      badge: "SIH26125 — Bharat Electronics Limited (BEL)",
      icon: <ShieldCheck className="w-6 h-6 text-blue-700" />,
      description:
        "This platform is an enterprise blockchain protocol built to eliminate insider threats, stale employee permissions, and audit log manipulation in high-value defense electronics manufacturing.",
      takeaway:
        "Every single action is verified mathematically by Solidity smart contracts. If an employee is revoked, their access halts instantly.",
    },
    {
      title: "1. The Current Actor & Wallet Switcher",
      badge: "Top Navigation Bar",
      icon: <Compass className="w-6 h-6 text-indigo-700" />,
      description:
        "Look at the top right of your screen. You can connect a real MetaMask wallet for the primary demonstration, or use the 'Demo Accounts' selector to switch between Administrator, Custody Manager, Auditor, or a Revoked Employee with zero setup.",
      takeaway:
        "Notice how the 'Current Actor' bar immediately updates to show whether your identity is Active, Revoked, or Unregistered on-chain.",
    },
    {
      title: "2. Identity Registry & Kill-Switch",
      badge: "Route: /identities",
      icon: <Users className="w-6 h-6 text-emerald-700" />,
      page: "/identities",
      pageLabel: "Open Identities Page",
      description:
        "Traditional IT suffers from stale permissions when employees transfer or leave. Here, personnel identities are stored in IdentityRegistry.sol. An Administrator can revoke an identity in one on-chain transaction.",
      takeaway:
        "Revocation acts as an instant O(1) kill-switch that blocks all asset operations without having to manually hunt down individual roles.",
    },
    {
      title: "3. Governed Defense Assets & Custody",
      badge: "Route: /assets",
      icon: <FileBox className="w-6 h-6 text-blue-700" />,
      page: "/assets",
      pageLabel: "Open Assets Page",
      description:
        "High-value defense hardware (like radar modules and secure communication units) are minted as governed ERC-721 tokens with SHA-256 cryptographic document hashes.",
      takeaway:
        "Standard unregulated transfers are permanently disabled. Only active, authorized Custody Managers can initiate custody handoffs.",
    },
    {
      title: "4. Live Security Attack Demonstration",
      badge: "Route: /security",
      icon: <ShieldAlert className="w-6 h-6 text-red-700" />,
      page: "/security",
      pageLabel: "Open Security Demo",
      description:
        "This is the judge-ready proof. You can trigger real attack attempts: an unregistered actor trying to mint hardware, or a revoked manager trying to transfer custody.",
      takeaway:
        "Watch the Ethereum EVM visibly REVERT the transaction in real time with custom error signatures. Security is enforced by bytecode, not frontend code!",
    },
    {
      title: "5. Immutable Audit Evidence",
      badge: "Route: /audit",
      icon: <History className="w-6 h-6 text-slate-700" />,
      page: "/audit",
      pageLabel: "Open Audit Log",
      description:
        "In a conventional SQL database, a rogue Database Administrator (DBA) can run 'DELETE FROM audit_logs'. In this platform, every event is emitted as an immutable blockchain log.",
      takeaway:
        "Every identity change, mint, and custody handoff is cryptographically verifiable with transaction hash, block number, and timestamp.",
    },
  ];

  useEffect(() => {
    // Check if first-time visitor
    const seen = localStorage.getItem("tc_onboarding_tour_seen");
    if (!seen) {
      setIsOpen(true);
    }

    // Listen to custom open event
    const handleOpen = () => {
      setCurrentStep(0);
      setIsOpen(true);
    };

    window.addEventListener("open-app-tour", handleOpen);
    return () => window.removeEventListener("open-app-tour", handleOpen);
  }, []);

  const handleClose = () => {
    localStorage.setItem("tc_onboarding_tour_seen", "true");
    setIsOpen(false);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleNavigate = (path: string) => {
    router.push(path);
  };

  if (!isOpen) return null;

  const step = steps[currentStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-800">
              {step.icon}
            </div>
            <div>
              <span className="text-[11px] font-semibold text-blue-800 uppercase tracking-wide">
                {step.badge}
              </span>
              <h3 className="text-base font-bold text-slate-900">
                {step.title}
              </h3>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            title="Close Guide"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-700 leading-relaxed">
            {step.description}
          </p>

          <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs space-y-1">
            <div className="font-bold text-blue-900 flex items-center gap-1.5">
              <Check className="w-4 h-4 text-blue-700" />
              Key Innovation for Judges:
            </div>
            <p className="text-slate-700 leading-relaxed">
              {step.takeaway}
            </p>
          </div>

          {step.page && (
            <div className="pt-1">
              <button
                onClick={() => handleNavigate(step.page!)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-800 hover:text-blue-950 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg border border-slate-300 transition-colors"
              >
                <span>{step.pageLabel}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-1">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentStep ? "w-6 bg-blue-800" : "w-2 bg-slate-300"
                }`}
              />
            ))}
            <span className="text-xs text-slate-500 ml-2 font-medium">
              {currentStep + 1} of {steps.length}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}

            <button
              onClick={handleClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Skip Tour
            </button>

            <button
              onClick={handleNext}
              className="px-4 py-1.5 text-xs font-bold text-white bg-blue-800 hover:bg-blue-900 rounded-lg shadow-sm transition-colors flex items-center gap-1"
            >
              {currentStep === steps.length - 1 ? (
                <>Finish & Explore</>
              ) : (
                <>
                  Next Step <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
