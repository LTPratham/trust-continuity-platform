"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useWallet } from "../../lib/WalletContext";
import { getReadOnlyContracts, getContractsWithSigner, parseContractError, DEMO_ACCOUNTS, ASSET_STATE_LABELS } from "../../lib/contracts";
import { Link2, CheckCircle2, XCircle, AlertTriangle, Clock, Shield, PlusCircle } from "lucide-react";

interface AttestationRecord {
  index: number;
  physicalIdentifierHash: string;
  assetStateHash: string;
  attestedBy: string;
  timestamp: number;
  valid: boolean;
}

interface AssetInfo {
  tokenId: number;
  assetId: string;
  name: string;
  status: number;
  physicalIdentifierHash: string;
  lastAttestation: number;
  attestedBy: string;
}

const KNOWN_TOKEN_IDS = [1047, 1048, 1049, 1050, 2001, 2002];

export default function AttestationPage() {
  const { currentAccount, signer } = useWallet();
  const [assets, setAssets] = useState<AssetInfo[]>([]);
  const [selectedTokenId, setSelectedTokenId] = useState<number>(1047);
  const [attestations, setAttestations] = useState<AttestationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [attLoading, setAttLoading] = useState(false);

  // Form state
  const [physInput, setPhysInput] = useState("ASSET-SERIAL-SIH26125-001-DEMO");
  const [stateInput, setStateInput] = useState("STATE:IN_CUSTODY|CUSTODIAN:ENGINEER_A");
  const [submitting, setSubmitting] = useState(false);
  const [actionStatus, setActionStatus] = useState<{ type: "success"|"error"; title: string; message: string; txHash?: string } | null>(null);

  // Computed hashes
  const physHash  = physInput  ? ethers.keccak256(ethers.toUtf8Bytes(physInput))  : ethers.ZeroHash;
  const stateHash = stateInput ? ethers.keccak256(ethers.toUtf8Bytes(stateInput)) : ethers.ZeroHash;

  const loadAssets = useCallback(async () => {
    setLoading(true);
    const { assetNFT } = getReadOnlyContracts();
    const list: AssetInfo[] = [];
    for (const id of KNOWN_TOKEN_IDS) {
      try {
        await assetNFT.ownerOf(id);
        const d = await assetNFT.assets(id);
        list.push({
          tokenId: id,
          assetId: d.assetId,
          name: d.name,
          status: Number(d.status),
          physicalIdentifierHash: d.physicalIdentifierHash,
          lastAttestation: Number(d.lastAttestation),
          attestedBy: d.attestedBy,
        });
      } catch {}
    }
    setAssets(list);
    setLoading(false);
  }, []);

  const loadAttestations = useCallback(async (tokenId: number) => {
    setAttLoading(true);
    const { assetAttestation } = getReadOnlyContracts();
    try {
      const count = Number(await assetAttestation.getAttestationCount(tokenId));
      const list: AttestationRecord[] = [];
      for (let i = 0; i < count; i++) {
        const [ph, sh, by, ts, valid] = await assetAttestation.getAttestation(tokenId, i);
        list.push({ index: i, physicalIdentifierHash: ph, assetStateHash: sh, attestedBy: by, timestamp: Number(ts), valid });
      }
      setAttestations(list.reverse());
    } catch (e) { setAttestations([]); }
    setAttLoading(false);
  }, []);

  useEffect(() => { loadAssets(); }, [loadAssets]);
  useEffect(() => { loadAttestations(selectedTokenId); }, [selectedTokenId, loadAttestations]);

  const handleSubmitAttestation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signer) return;
    setSubmitting(true);
    setActionStatus(null);
    try {
      const { assetAttestation } = getContractsWithSigner(signer);
      const tx = await assetAttestation.submitAttestation(selectedTokenId, physHash, stateHash);
      const receipt = await tx.wait();
      setActionStatus({
        type: "success",
        title: "Attestation Recorded On-Chain",
        message: `Physical-digital binding attestation for Token #${selectedTokenId} committed immutably to the blockchain.`,
        txHash: receipt.hash,
      });
      await loadAttestations(selectedTokenId);
      await loadAssets();
    } catch (err: any) {
      const p = parseContractError(err);
      setActionStatus({ type: "error", title: p.userMessage, message: p.technicalReason });
    } finally { setSubmitting(false); }
  };

  const getAccountLabel = (address: string) => {
    const found = DEMO_ACCOUNTS.find(a => a.address.toLowerCase() === address.toLowerCase());
    return found ? `${found.label}` : `${address.slice(0, 8)}...`;
  };

  const isManager = currentAccount.roles.includes("MANAGER");

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Link2 className="w-5 h-5 text-teal-700" />
          Physical-Digital Asset Binding
        </h1>
        <p className="text-xs text-slate-600 mt-1">
          Blockchain preserves a tamper-evident record of cryptographic attestations linking each digital asset
          record to a submitted physical identifier and state snapshot. An attestation does NOT prove
          the physical asset is authentic — it records that an authorized verifier submitted a hash binding
          at a specific point in time.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Asset list */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Select Asset</h2>
          {loading ? (
            <div className="text-xs text-slate-500 p-4">Loading assets…</div>
          ) : assets.length === 0 ? (
            <div className="text-xs text-slate-500 p-4">No assets found. Deploy and mint first.</div>
          ) : (
            assets.map(a => (
              <button
                key={a.tokenId}
                onClick={() => setSelectedTokenId(a.tokenId)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  selectedTokenId === a.tokenId
                    ? "bg-teal-50 border-teal-400 shadow-sm"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs font-bold text-teal-800">#{a.tokenId}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded border font-bold bg-slate-50 border-slate-200 text-slate-600">
                    {ASSET_STATE_LABELS[a.status] || "UNKNOWN"}
                  </span>
                </div>
                <div className="font-semibold text-sm text-slate-900">{a.assetId}</div>
                <div className="text-xs text-slate-500">{a.name}</div>
                {a.lastAttestation > 0 && (
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-teal-700">
                    <CheckCircle2 className="w-3 h-3" />
                    Last attested: {new Date(a.lastAttestation * 1000).toLocaleString()}
                  </div>
                )}
                {a.lastAttestation === 0 && (
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-600">
                    <AlertTriangle className="w-3 h-3" />
                    No attestation on record
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        {/* Center + Right: Attestation form + history */}
        <div className="lg:col-span-2 space-y-4">
          {/* Current binding panel */}
          {assets.find(a => a.tokenId === selectedTokenId) && (() => {
            const asset = assets.find(a => a.tokenId === selectedTokenId)!;
            return (
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-teal-600" />
                  Digital Asset Identity — Token #{selectedTokenId}
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-slate-500 font-medium">Asset ID</div>
                    <div className="font-bold text-slate-900">{asset.assetId}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 font-medium">Current State</div>
                    <div className="font-bold text-teal-700">{ASSET_STATE_LABELS[asset.status]}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-slate-500 font-medium mb-1">Physical Identity Binding (on-chain hash)</div>
                    <div className="font-mono text-[11px] text-teal-800 bg-teal-50 px-3 py-2 rounded border border-teal-200 break-all">
                      {asset.physicalIdentifierHash === ethers.ZeroHash
                        ? <span className="text-slate-400">Not yet attested</span>
                        : asset.physicalIdentifierHash}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 font-medium">Last Attested By</div>
                    <div className="font-semibold text-slate-800">
                      {asset.attestedBy === ethers.ZeroAddress ? "—" : getAccountLabel(asset.attestedBy)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 font-medium">Last Attestation</div>
                    <div className="font-semibold text-slate-800">
                      {asset.lastAttestation === 0
                        ? "Never"
                        : new Date(asset.lastAttestation * 1000).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Submit attestation form */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-1.5">
              <PlusCircle className="w-4 h-4 text-blue-700" />
              Submit New Attestation
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter the physical identifier and current state. Hashes are computed client-side and committed on-chain.
              The raw values are never stored on blockchain — only their cryptographic fingerprints.
            </p>

            {actionStatus && (
              <div className={`mb-4 p-3 rounded-lg border text-xs ${
                actionStatus.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-red-50 border-red-200 text-red-900"
              }`}>
                <div className="font-bold">{actionStatus.title}</div>
                <div>{actionStatus.message}</div>
                {actionStatus.txHash && <div className="font-mono text-[10px] mt-1">Tx: {actionStatus.txHash}</div>}
              </div>
            )}

            <form onSubmit={handleSubmitAttestation} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Physical Identifier (e.g. serial number — NOT stored on-chain)</label>
                <input
                  type="text"
                  value={physInput}
                  onChange={e => setPhysInput(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-teal-600"
                />
                <div className="text-[10px] font-mono text-teal-700 mt-1">→ Hash: {physHash.slice(0,20)}…</div>
              </div>
              <div>
                <label className="block text-slate-700 font-medium mb-1">State Record (canonicalized description — NOT stored on-chain)</label>
                <input
                  type="text"
                  value={stateInput}
                  onChange={e => setStateInput(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-teal-600"
                />
                <div className="text-[10px] font-mono text-teal-700 mt-1">→ Hash: {stateHash.slice(0,20)}…</div>
              </div>
              <button
                type="submit"
                disabled={submitting || !isManager || !physInput || !stateInput}
                className="w-full py-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs disabled:opacity-50 transition-all"
              >
                {submitting ? "Committing to blockchain…" : "Submit Attestation (VERIFIER_ROLE required)"}
              </button>
              {!isManager && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  Switch to Engineer A (Manager / Verifier) to submit attestations.
                </p>
              )}
            </form>
          </div>

          {/* Attestation history */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Attestation History — Token #{selectedTokenId}
              </h3>
              <span className="text-xs text-teal-700 font-bold">{attestations.length} records</span>
            </div>
            <div className="divide-y divide-slate-100">
              {attLoading ? (
                <div className="p-5 text-xs text-slate-500">Loading attestation history…</div>
              ) : attestations.length === 0 ? (
                <div className="p-5 text-xs text-slate-500">No attestations on record for this asset.</div>
              ) : (
                attestations.map(a => (
                  <div key={a.index} className={`p-4 text-xs ${!a.valid ? "opacity-50 bg-red-50" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {a.valid
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          : <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                        <span className={`font-bold text-[10px] uppercase px-2 py-0.5 rounded border ${a.valid ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                          {a.valid ? "VALID" : "INVALIDATED"}
                        </span>
                        <span className="text-slate-500">by {getAccountLabel(a.attestedBy)}</span>
                      </div>
                      <span className="text-slate-400 text-[10px] shrink-0">
                        {new Date(a.timestamp * 1000).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-2 font-mono text-[10px] text-slate-600 space-y-1">
                      <div><span className="text-slate-400">phys: </span>{a.physicalIdentifierHash.slice(0,16)}…</div>
                      <div><span className="text-slate-400">state: </span>{a.assetStateHash.slice(0,16)}…</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
