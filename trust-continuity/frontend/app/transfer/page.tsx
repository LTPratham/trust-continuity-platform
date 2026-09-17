"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useWallet } from "../../lib/WalletContext";
import { getReadOnlyContracts, getContractsWithSigner, parseContractError, DEMO_ACCOUNTS, TRANSFER_STATE_LABELS } from "../../lib/contracts";
import { ArrowRightLeft, CheckCircle2, XCircle, Clock, AlertTriangle, ChevronRight } from "lucide-react";

const KNOWN_TOKEN_IDS = [1047, 1048, 1049, 1050, 2001, 2002];

interface TransferRecord {
  id: number;
  tokenId: number;
  initiator: string;
  destination: string;
  state: number;
  requestedAt: number;
  completedAt: number;
  rejectionReason: string;
  contextHash: string;
}

const PIPELINE_STEPS = [
  { label: "Transfer\nRequested",      state: 0 },
  { label: "Origin\nVerified",         state: 1 },
  { label: "Asset State\nVerified",    state: 2 },
  { label: "Destination\nAuthorized",  state: 3 },
  { label: "Destination\nAccepted",    state: 4 },
  { label: "Transfer\nConfirmed",      state: 5 },
];

function PipelineDiagram({ currentState }: { currentState: number }) {
  const isRejected = currentState === 6;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {PIPELINE_STEPS.map((step, idx) => {
        const done    = currentState > step.state && !isRejected;
        const active  = currentState === step.state && !isRejected;
        const pending = currentState < step.state || isRejected;
        return (
          <React.Fragment key={step.state}>
            <div className={`flex flex-col items-center text-center px-2 py-1.5 rounded-lg border text-[10px] font-semibold min-w-[64px] transition-all ${
              done    ? "bg-emerald-50 border-emerald-300 text-emerald-800" :
              active  ? "bg-blue-100 border-blue-400 text-blue-900 shadow-sm" :
              isRejected ? "bg-red-50 border-red-200 text-red-400 line-through" :
              "bg-slate-50 border-slate-200 text-slate-400"
            }`}>
              {done ? <CheckCircle2 className="w-3 h-3 mb-0.5 text-emerald-600" /> :
               active ? <div className="w-2 h-2 rounded-full bg-blue-500 mb-0.5 animate-pulse" /> :
               <div className="w-2 h-2 rounded-full bg-slate-300 mb-0.5" />}
              <span className="whitespace-pre-line leading-tight">{step.label}</span>
            </div>
            {idx < PIPELINE_STEPS.length - 1 && (
              <ChevronRight className={`w-3 h-3 shrink-0 ${done ? "text-emerald-400" : "text-slate-300"}`} />
            )}
          </React.Fragment>
        );
      })}
      {isRejected && (
        <div className="flex items-center gap-1 ml-1">
          <XCircle className="w-4 h-4 text-red-500" />
          <span className="text-xs font-bold text-red-700">REJECTED</span>
        </div>
      )}
    </div>
  );
}

export default function TransferPage() {
  const { currentAccount, signer } = useWallet();
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [assets, setAssets] = useState<{ tokenId: number; assetId: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionStatus, setActionStatus] = useState<{ type: "success"|"error"; title: string; message: string; txHash?: string } | null>(null);

  // Form
  const [reqTokenId, setReqTokenId] = useState<number>(1047);
  const [reqDestination, setReqDestination] = useState(DEMO_ACCOUNTS[2].address);
  const [reqContext, setReqContext] = useState("Transfer to secure facility for inspection");
  const [rejectId, setRejectId] = useState<number | "">("");
  const [rejectReason, setRejectReason] = useState("Authorization requirements not met");

  const getLabel = (address: string) => {
    const f = DEMO_ACCOUNTS.find(a => a.address.toLowerCase() === address.toLowerCase());
    return f ? f.label : `${address.slice(0,8)}…`;
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const { assetNFT, transferLifecycle } = getReadOnlyContracts();
      const assetList: typeof assets = [];
      for (const id of KNOWN_TOKEN_IDS) {
        try {
          await assetNFT.ownerOf(id);
          const d = await assetNFT.assets(id);
          assetList.push({ tokenId: id, assetId: d.assetId, name: d.name });
        } catch {}
      }
      setAssets(assetList);

      const count = Number(await transferLifecycle.transferCount());
      const list: TransferRecord[] = [];
      for (let i = count - 1; i >= 0; i--) {
        const [tokenId, initiator, destination, state, requestedAt, completedAt, rejectionReason, contextHash] =
          await transferLifecycle.getTransfer(i);
        list.push({
          id: i,
          tokenId: Number(tokenId),
          initiator,
          destination,
          state: Number(state),
          requestedAt: Number(requestedAt),
          completedAt: Number(completedAt),
          rejectionReason,
          contextHash,
        });
      }
      setTransfers(list);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll, currentAccount]);

  const act = async (fn: () => Promise<any>, successTitle: string) => {
    setSubmitting(true);
    setActionStatus(null);
    try {
      const tx = await fn();
      const receipt = await tx.wait();
      setActionStatus({ type: "success", title: successTitle, message: "Transaction confirmed on-chain.", txHash: receipt.hash });
      await loadAll();
    } catch (err: any) {
      const p = parseContractError(err);
      setActionStatus({ type: "error", title: p.userMessage, message: p.technicalReason });
    } finally { setSubmitting(false); }
  };

  const handleRequestTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signer) return;
    const { transferLifecycle } = getContractsWithSigner(signer);
    const ctx = reqContext ? ethers.keccak256(ethers.toUtf8Bytes(reqContext)) : ethers.ZeroHash;
    act(() => transferLifecycle.requestTransfer(reqTokenId, reqDestination, ctx), "Transfer Request Submitted");
  };

  const handleAuthorize = async (id: number) => {
    if (!signer) return;
    const { transferLifecycle } = getContractsWithSigner(signer);
    act(() => transferLifecycle.authorizeDestination(id), `Transfer #${id} Destination Authorized`);
  };

  const handleAccept = async (id: number) => {
    if (!signer) return;
    const { transferLifecycle } = getContractsWithSigner(signer);
    act(() => transferLifecycle.acceptTransfer(id), `Transfer #${id} Accepted by Destination`);
  };

  const handleConfirm = async (id: number) => {
    if (!signer) return;
    const { transferLifecycle } = getContractsWithSigner(signer);
    act(() => transferLifecycle.confirmTransfer(id), `Transfer #${id} Confirmed — Custody Updated On-Chain`);
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signer || rejectId === "") return;
    const { transferLifecycle } = getContractsWithSigner(signer);
    act(() => transferLifecycle.rejectTransfer(rejectId, rejectReason), `Transfer #${rejectId} Rejected`);
  };

  const isAdmin   = currentAccount.roles.includes("ADMIN");
  const isManager = currentAccount.roles.includes("MANAGER");

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5 text-purple-700" />
          Governed Transfer Lifecycle
        </h1>
        <p className="text-xs text-slate-600 mt-1">
          Every custody transfer goes through a 6-step validated lifecycle. The blockchain records each state
          transition immutably. Trust Continuity checks are performed at initiation and confirmation.
        </p>
      </div>

      {actionStatus && (
        <div className={`p-4 rounded-xl border text-xs ${actionStatus.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-red-50 border-red-200 text-red-900"}`}>
          <div className="font-bold">{actionStatus.title}</div>
          <div>{actionStatus.message}</div>
          {actionStatus.txHash && <div className="font-mono text-[10px] mt-1">Tx: {actionStatus.txHash}</div>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Request form */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-800">Initiate Transfer Request</h2>
          <form onSubmit={handleRequestTransfer} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Asset (Token)</label>
              <select value={reqTokenId} onChange={e => setReqTokenId(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-purple-600">
                {assets.map(a => <option key={a.tokenId} value={a.tokenId}>#{a.tokenId} — {a.assetId}: {a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Destination</label>
              <select value={reqDestination} onChange={e => setReqDestination(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-purple-600">
                {DEMO_ACCOUNTS.map(a => <option key={a.address} value={a.address}>{a.label} ({a.address.slice(0,8)}…)</option>)}
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Transfer Context (hashed)</label>
              <input type="text" value={reqContext} onChange={e => setReqContext(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-purple-600" />
              <div className="text-[10px] text-purple-600 font-mono mt-0.5">→ {reqContext ? ethers.keccak256(ethers.toUtf8Bytes(reqContext)).slice(0,16) : "0x0"}…</div>
            </div>
            <button type="submit" disabled={submitting || !isManager}
              className="w-full py-2.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs disabled:opacity-50 transition-all">
              {submitting ? "Submitting…" : "Request Governed Transfer (MANAGER required)"}
            </button>
          </form>
        </div>

        {/* Reject form */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-800">Reject a Transfer</h2>
          <form onSubmit={handleReject} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Transfer ID</label>
              <select value={rejectId} onChange={e => setRejectId(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-red-600">
                <option value="">Select transfer…</option>
                {transfers.filter(t => t.state < 5).map(t => (
                  <option key={t.id} value={t.id}>#{t.id} — Token #{t.tokenId} — {TRANSFER_STATE_LABELS[t.state]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Rejection Reason (recorded immutably)</label>
              <input type="text" value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-red-600" />
            </div>
            <button type="submit" disabled={submitting || rejectId === "" || (!isAdmin && !isManager)}
              className="w-full py-2.5 rounded-lg bg-red-700 hover:bg-red-800 text-white font-bold text-xs disabled:opacity-50 transition-all">
              {submitting ? "Submitting…" : "Reject Transfer (ADMIN or MANAGER)"}
            </button>
          </form>
        </div>
      </div>

      {/* Transfer records */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Transfer History ({transfers.length} records)
          </h2>
        </div>
        {loading ? (
          <div className="p-6 text-xs text-slate-500">Loading transfer records…</div>
        ) : transfers.length === 0 ? (
          <div className="p-6 text-xs text-slate-500">No transfers initiated yet.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {transfers.map(t => (
              <div key={t.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-purple-800">Transfer #{t.id}</span>
                    <span className="ml-2 text-xs text-slate-500">Token #{t.tokenId}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    t.state === 5 ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                    t.state === 6 ? "bg-red-50 text-red-700 border-red-200" :
                    "bg-blue-50 text-blue-700 border-blue-200"
                  }`}>{TRANSFER_STATE_LABELS[t.state]}</span>
                </div>

                <PipelineDiagram currentState={t.state} />

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-slate-400">Initiator: </span><span className="font-semibold">{getLabel(t.initiator)}</span></div>
                  <div><span className="text-slate-400">Destination: </span><span className="font-semibold">{getLabel(t.destination)}</span></div>
                  <div><span className="text-slate-400">Requested: </span>{new Date(t.requestedAt * 1000).toLocaleString()}</div>
                  {t.completedAt > 0 && <div><span className="text-slate-400">Completed: </span>{new Date(t.completedAt * 1000).toLocaleString()}</div>}
                  {t.rejectionReason && <div className="col-span-2"><span className="text-red-600 font-medium">Rejection: </span>{t.rejectionReason}</div>}
                </div>

                {/* Action buttons based on state */}
                {t.state === 2 && isAdmin && (
                  <button onClick={() => handleAuthorize(t.id)} disabled={submitting}
                    className="px-4 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs disabled:opacity-50">
                    Step 4: Authorize Destination (ADMIN)
                  </button>
                )}
                {t.state === 3 && currentAccount.address.toLowerCase() === t.destination.toLowerCase() && (
                  <button onClick={() => handleAccept(t.id)} disabled={submitting}
                    className="px-4 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs disabled:opacity-50">
                    Step 5: Accept Incoming Transfer
                  </button>
                )}
                {t.state === 4 && isManager && (
                  <button onClick={() => handleConfirm(t.id)} disabled={submitting}
                    className="px-4 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs disabled:opacity-50">
                    Step 6: Confirm & Execute Transfer (MANAGER)
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
