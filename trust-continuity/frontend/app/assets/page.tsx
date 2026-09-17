"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useWallet } from "../../lib/WalletContext";
import {
  getReadOnlyContracts,
  getContractsWithSigner,
  parseContractError,
  DEMO_ACCOUNTS,
} from "../../lib/contracts";
import {
  FileBox,
  PlusCircle,
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  FileCheck,
  AlertTriangle,
  Lock,
  Search,
} from "lucide-react";

interface AssetRecord {
  tokenId: number;
  assetId: string;
  name: string;
  description: string;
  documentHash: string;
  custodian: string;
  createdBy: string;
  createdAt: number;
}

export default function AssetsPage() {
  const { currentAccount, signer, refreshAccountState } = useWallet();
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Mint Form State
  const [mintTokenId, setMintTokenId] = useState("1048");
  const [mintAssetId, setMintAssetId] = useState("BEL-TEST-1048");
  const [mintName, setMintName] = useState("Avionics Guidance Processor");
  const [mintDescription, setMintDescription] = useState("Mission computer unit for tactical flight testing");
  const [mintCustodian, setMintCustodian] = useState(DEMO_ACCOUNTS[1].address);
  const [documentContent, setDocumentContent] = useState("BEL Defense Specification: Level-3 Secure Hardware Architecture v2.4");
  const [computedHash, setComputedHash] = useState("");

  // Transfer Custody Form State
  const [transferTokenId, setTransferTokenId] = useState<number | "">("");
  const [newCustodian, setNewCustodian] = useState(DEMO_ACCOUNTS[2].address);

  // Integrity Verification State
  const [verifyTokenId, setVerifyTokenId] = useState<number | "">("");
  const [verifyDocumentText, setVerifyDocumentText] = useState("");
  const [verificationResult, setVerificationResult] = useState<{
    tested: boolean;
    matches: boolean;
    computedHash: string;
    storedHash: string;
  } | null>(null);

  // Action status message
  const [actionStatus, setActionStatus] = useState<{
    type: "success" | "error";
    title: string;
    message: string;
    technicalReason?: string;
    txHash?: string;
  } | null>(null);

  const [submitting, setSubmitting] = useState(false);

  // Compute SHA-256 hash in browser
  useEffect(() => {
    if (!documentContent) {
      setComputedHash(ethers.ZeroHash);
    } else {
      const hash = ethers.keccak256(ethers.toUtf8Bytes(documentContent));
      setComputedHash(hash);
    }
  }, [documentContent]);

  // Load all minted assets
  const loadAssets = useCallback(async () => {
    try {
      setLoading(true);
      const { assetNFT } = getReadOnlyContracts();

      const list: AssetRecord[] = [];
      const candidateIds = [1047, 1048, 1049, 1050, 2001, 2002];
      for (const id of candidateIds) {
        try {
          const owner = await assetNFT.ownerOf(id);
          const data = await assetNFT.assets(id);
          list.push({
            tokenId: id,
            assetId: data.assetId,
            name: data.name,
            description: data.description,
            documentHash: data.documentHash,
            custodian: data.custodian,
            createdBy: data.createdBy,
            createdAt: Number(data.createdAt),
          });
        } catch {
          // Token not minted yet
        }
      }

      setAssets(list);
      if (list.length > 0 && transferTokenId === "") {
        setTransferTokenId(list[0].tokenId);
        setVerifyTokenId(list[0].tokenId);
      }
    } catch (err) {
      console.error("Error loading assets:", err);
    } finally {
      setLoading(false);
    }
  }, [transferTokenId]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets, currentAccount]);

  // Execute Mint Asset
  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signer) return;

    try {
      setSubmitting(true);
      setActionStatus(null);
      const { assetNFT } = getContractsWithSigner(signer);

      const tx = await assetNFT.mintAsset(
        parseInt(mintTokenId),
        mintAssetId,
        mintName,
        mintDescription,
        computedHash,
        mintCustodian
      );
      const receipt = await tx.wait();

      setActionStatus({
        type: "success",
        title: `Asset Minted: ${mintAssetId}`,
        message: `Token #${mintTokenId} successfully recorded on-chain with cryptographic document hash.`,
        txHash: receipt.hash,
      });

      // Prepare next token ID
      setMintTokenId((prev) => (parseInt(prev) + 1).toString());
      setMintAssetId((prev) => `BEL-TEST-${parseInt(mintTokenId) + 1}`);

      await loadAssets();
      await refreshAccountState();
    } catch (err: any) {
      const parsed = parseContractError(err);
      setActionStatus({
        type: "error",
        title: parsed.userMessage,
        message: "Smart contract rejected the mint transaction.",
        technicalReason: parsed.technicalReason,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Execute Custody Transfer
  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signer || transferTokenId === "") return;

    try {
      setSubmitting(true);
      setActionStatus(null);
      const { assetNFT } = getContractsWithSigner(signer);

      const tx = await assetNFT.custodyTransfer(
        transferTokenId,
        newCustodian,
        "Routine deployment transfer between secure defense facilities"
      );
      const receipt = await tx.wait();

      setActionStatus({
        type: "success",
        title: `Custody Transferred: Token #${transferTokenId}`,
        message: `Hardware custody successfully reassigned to ${newCustodian.slice(0, 8)}... on-chain.`,
        txHash: receipt.hash,
      });

      await loadAssets();
      await refreshAccountState();
    } catch (err: any) {
      const parsed = parseContractError(err);
      setActionStatus({
        type: "error",
        title: parsed.userMessage,
        message: "Smart contract rejected the custody transfer transaction.",
        technicalReason: parsed.technicalReason,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Execute Document Integrity Verification
  const handleVerifyIntegrity = async () => {
    if (verifyTokenId === "") return;
    try {
      const { assetNFT } = getReadOnlyContracts();
      const currentDocHash = ethers.keccak256(ethers.toUtf8Bytes(verifyDocumentText));
      const [matches, storedHash] = await assetNFT.verifyIntegrity(
        verifyTokenId,
        currentDocHash
      );

      setVerificationResult({
        tested: true,
        matches,
        computedHash: currentDocHash,
        storedHash,
      });
    } catch (err) {
      console.error("Verification error:", err);
    }
  };

  const isManager = currentAccount.roles.includes("MANAGER");
  const isActive = currentAccount.isActive;

  const getAccountLabel = (address: string) => {
    const found = DEMO_ACCOUNTS.find(
      (a) => a.address.toLowerCase() === address.toLowerCase()
    );
    return found ? `${found.label} (${address.slice(0, 6)}...)` : `${address.slice(0, 8)}...`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileBox className="w-5 h-5 text-blue-700" />
            Governed Defense Hardware Assets
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Governed via <code className="font-mono text-blue-800 font-semibold">AssetNFT.sol</code> (ERC-721 Control Handles with Restricted Custody).
          </p>
        </div>

        <div className="text-xs">
          {isManager && isActive ? (
            <span className="inline-flex items-center px-3 py-1.5 rounded-lg font-semibold bg-emerald-50 text-emerald-900 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-700" />
              Connected as Active Manager (Can mint & transfer custody)
            </span>
          ) : isManager && !isActive ? (
            <span className="inline-flex items-center px-3 py-1.5 rounded-lg font-semibold bg-red-50 text-red-900 border border-red-200">
              <XCircle className="w-3.5 h-3.5 mr-1.5 text-red-700" />
              Manager Identity Revoked (Smart contract blocks actions)
            </span>
          ) : (
            <span className="inline-flex items-center px-3 py-1.5 rounded-lg font-medium bg-slate-100 text-slate-700 border border-slate-300">
              <Lock className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
              Manager permission required for asset modifications
            </span>
          )}
        </div>
      </div>

      {/* Transaction Feedback */}
      {actionStatus && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
            actionStatus.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-red-50 border-red-200 text-red-900"
          }`}
        >
          {actionStatus.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1 text-xs">
            <div className="font-bold text-sm text-slate-900">{actionStatus.title}</div>
            <div>{actionStatus.message}</div>
            {actionStatus.technicalReason && (
              <div className="font-mono text-[11px] text-slate-700 bg-white p-2 rounded border border-slate-200">
                Technical Reason: {actionStatus.technicalReason}
              </div>
            )}
            {actionStatus.txHash && (
              <div className="text-[11px] text-emerald-700 font-mono font-semibold">
                Tx Hash: {actionStatus.txHash}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Governed Assets Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              On-Chain Governed Assets
            </h2>
            <p className="text-[11px] text-slate-500">
              Each record represents physical defense equipment under continuous cryptographic custody.
            </p>
          </div>
          <span className="text-xs text-blue-800 font-bold">
            {assets.length} Assets Registered
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 text-left">Token ID</th>
                <th className="px-5 py-3 text-left">Asset Code</th>
                <th className="px-5 py-3 text-left">Hardware Item & Purpose</th>
                <th className="px-5 py-3 text-left">Current Custodian</th>
                <th className="px-5 py-3 text-left">Created By</th>
                <th className="px-5 py-3 text-left">Integrity Fingerprint</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                    Loading governed assets from blockchain...
                  </td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                    No assets found. Connect as Manager (Engineer A) to mint an asset.
                  </td>
                </tr>
              ) : (
                assets.map((item) => (
                  <tr key={item.tokenId} className="hover:bg-slate-50/80 transition-colors">
                    {/* Token ID */}
                    <td className="px-5 py-3.5 font-mono text-blue-800 font-bold">
                      #{item.tokenId}
                    </td>

                    {/* Asset ID */}
                    <td className="px-5 py-3.5 font-bold text-slate-900">
                      {item.assetId}
                    </td>

                    {/* Name & Desc */}
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900">{item.name}</div>
                      <div className="text-[11px] text-slate-500">{item.description}</div>
                    </td>

                    {/* Custodian */}
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900">
                        {getAccountLabel(item.custodian)}
                      </div>
                      <div className="font-mono text-[10px] text-slate-400">
                        {item.custodian}
                      </div>
                    </td>

                    {/* Created By */}
                    <td className="px-5 py-3.5">
                      <div className="text-slate-700">{getAccountLabel(item.createdBy)}</div>
                    </td>

                    {/* Document Hash */}
                    <td className="px-5 py-3.5 font-mono text-[11px]">
                      {item.documentHash !== ethers.ZeroHash ? (
                        <span title={item.documentHash} className="text-teal-700 font-medium">
                          {item.documentHash.slice(0, 10)}...{item.documentHash.slice(-8)}
                        </span>
                      ) : (
                        <span className="text-slate-400">None</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two Operation Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel 1: Mint New Governed Asset */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="border-b border-slate-200 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <PlusCircle className="w-4 h-4 text-blue-700" />
              Mint Governed Defense Hardware
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Restricted to active Custody Managers. Minting links physical hardware with cryptographic proofs.
            </p>
          </div>

          <form onSubmit={handleMint} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Token ID (Numeric)</label>
                <input
                  type="number"
                  value={mintTokenId}
                  onChange={(e) => setMintTokenId(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-medium mb-1">Asset Code</label>
                <input
                  type="text"
                  value={mintAssetId}
                  onChange={(e) => setMintAssetId(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Hardware Name</label>
              <input
                type="text"
                value={mintName}
                onChange={(e) => setMintName(e.target.value)}
                required
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Purpose / Specifications</label>
              <input
                type="text"
                value={mintDescription}
                onChange={(e) => setMintDescription(e.target.value)}
                required
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Initial Physical Custodian</label>
              <select
                value={mintCustodian}
                onChange={(e) => setMintCustodian(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600"
              >
                {DEMO_ACCOUNTS.map((acc) => (
                  <option key={acc.address} value={acc.address}>
                    {acc.label} ({acc.address.slice(0, 8)}...)
                  </option>
                ))}
              </select>
            </div>

            {/* Document Hash Input */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
              <label className="block text-slate-800 font-semibold">
                Technical Specification / Calibration Sheet
              </label>
              <p className="text-[11px] text-slate-500">
                The smart contract stores a tamper-evident SHA-256 fingerprint of this document.
              </p>
              <textarea
                rows={2}
                value={documentContent}
                onChange={(e) => setDocumentContent(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900 font-mono text-[11px] focus:ring-2 focus:ring-blue-600"
              />
              <div className="text-[11px] text-slate-600 font-mono truncate">
                On-Chain Fingerprint: <span className="text-teal-700 font-semibold">{computedHash}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-lg bg-blue-800 hover:bg-blue-900 text-white font-bold text-xs disabled:opacity-50 transition-all shadow-xs"
            >
              {submitting ? "Signing & Executing on-chain..." : "Mint Governed Asset via Smart Contract"}
            </button>
          </form>
        </div>

        {/* Panel 2: Transfer Custody & Verify */}
        <div className="space-y-6">
          {/* Transfer Custody */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <ArrowRightLeft className="w-4 h-4 text-purple-700" />
                Transfer Hardware Custody
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Controlled organizational handover. Standard ERC-721 transfers are blocked; only active Managers can execute this.
              </p>
            </div>

            <form onSubmit={handleTransfer} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Select Hardware Asset</label>
                <select
                  value={transferTokenId}
                  onChange={(e) => setTransferTokenId(Number(e.target.value))}
                  required
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600"
                >
                  {assets.map((a) => (
                    <option key={a.tokenId} value={a.tokenId}>
                      #{a.tokenId} — {a.assetId}: {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">New Responsible Custodian</label>
                <select
                  value={newCustodian}
                  onChange={(e) => setNewCustodian(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-600"
                >
                  {DEMO_ACCOUNTS.map((acc) => (
                    <option key={acc.address} value={acc.address}>
                      {acc.label} ({acc.address.slice(0, 8)}...)
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting || transferTokenId === ""}
                className="w-full py-2.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs disabled:opacity-50 transition-all shadow-xs"
              >
                {submitting ? "Signing on-chain..." : "Transfer Custody via Smart Contract"}
              </button>
            </form>
          </div>

          {/* Verify Integrity */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
            <div className="border-b border-slate-200 pb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-teal-700" />
                Verify Document Integrity On-Chain
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Check whether a local spec document matches the cryptographic fingerprint stored in the blockchain.
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <textarea
                rows={2}
                placeholder="Paste document text here to verify against blockchain fingerprint..."
                value={verifyDocumentText}
                onChange={(e) => setVerifyDocumentText(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900 font-mono text-[11px] focus:ring-2 focus:ring-teal-600"
              />

              <button
                type="button"
                onClick={handleVerifyIntegrity}
                disabled={verifyTokenId === "" || !verifyDocumentText}
                className="w-full py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs disabled:opacity-50 transition-all shadow-xs"
              >
                Verify Against Blockchain Hash
              </button>

              {verificationResult && (
                <div
                  className={`p-3 rounded-lg border text-xs ${
                    verificationResult.matches
                      ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                      : "bg-red-50 border-red-300 text-red-900"
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    {verificationResult.matches ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                        <span>INTEGRITY VERIFIED: Exact cryptographic match</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-red-700" />
                        <span>TAMPERING DETECTED: Hash does not match on-chain record!</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
