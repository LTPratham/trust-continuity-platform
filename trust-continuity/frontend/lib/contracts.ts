import { ethers, Interface } from "ethers";
import deploymentsData from "./deployments.json";

export interface DemoAccount {
  index: number;
  label: string;
  role: string;
  address: string;
  privateKey: string;
  description: string;
}

export const LOCAL_RPC_URL = "http://127.0.0.1:8545";

export const DEMO_ACCOUNTS: DemoAccount[] = deploymentsData.demoAccounts as DemoAccount[];

export const IDENTITY_REGISTRY_ADDRESS  = deploymentsData.contracts.IdentityRegistry.address;
export const IDENTITY_REGISTRY_ABI      = deploymentsData.contracts.IdentityRegistry.abi;

export const ASSET_NFT_ADDRESS = deploymentsData.contracts.AssetNFT.address;
export const ASSET_NFT_ABI     = deploymentsData.contracts.AssetNFT.abi;

export const ASSET_ATTESTATION_ADDRESS = deploymentsData.contracts.AssetAttestation.address;
export const ASSET_ATTESTATION_ABI     = deploymentsData.contracts.AssetAttestation.abi;

export const TRANSFER_LIFECYCLE_ADDRESS = deploymentsData.contracts.TransferLifecycle.address;
export const TRANSFER_LIFECYCLE_ABI     = deploymentsData.contracts.TransferLifecycle.abi;

// Role hashes
export const ROLE_HASHES = {
  ADMIN:    ethers.ZeroHash,
  MANAGER:  ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE")),
  AUDITOR:  ethers.keccak256(ethers.toUtf8Bytes("AUDITOR_ROLE")),
  USER:     ethers.keccak256(ethers.toUtf8Bytes("USER_ROLE")),
  VERIFIER: ethers.keccak256(ethers.toUtf8Bytes("VERIFIER_ROLE")),
};

// Asset state labels matching AssetNFT.AssetState enum
export const ASSET_STATE_LABELS = [
  "REGISTERED",
  "ALLOCATED",
  "IN_CUSTODY",
  "UNDER_INSPECTION",
  "TRANSFER_PENDING",
  "TRANSFERRED",
  "SUSPENDED",
  "REVOKED",
];

export const ASSET_STATE_COLORS: Record<number, string> = {
  0: "bg-blue-100 text-blue-800 border-blue-200",
  1: "bg-emerald-100 text-emerald-800 border-emerald-200",
  2: "bg-teal-100 text-teal-800 border-teal-200",
  3: "bg-amber-100 text-amber-800 border-amber-200",
  4: "bg-purple-100 text-purple-800 border-purple-200",
  5: "bg-slate-100 text-slate-700 border-slate-200",
  6: "bg-orange-100 text-orange-800 border-orange-200",
  7: "bg-red-100 text-red-800 border-red-200",
};

// Transfer lifecycle state labels matching TransferLifecycle.TransferState enum
export const TRANSFER_STATE_LABELS = [
  "TRANSFER_REQUESTED",
  "ORIGIN_VERIFIED",
  "ASSET_STATE_VERIFIED",
  "DESTINATION_AUTHORIZED",
  "DESTINATION_ACCEPTED",
  "TRANSFER_CONFIRMED",
  "TRANSFER_REJECTED",
];

/**
 * Get read-only JSON-RPC provider connected to local node
 */
export function getRpcProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(LOCAL_RPC_URL);
}

/**
 * Get read-only contract instances for all 4 contracts
 */
export function getReadOnlyContracts() {
  const provider = getRpcProvider();
  return {
    provider,
    identityRegistry: new ethers.Contract(IDENTITY_REGISTRY_ADDRESS, IDENTITY_REGISTRY_ABI, provider),
    assetNFT:         new ethers.Contract(ASSET_NFT_ADDRESS, ASSET_NFT_ABI, provider),
    assetAttestation: new ethers.Contract(ASSET_ATTESTATION_ADDRESS, ASSET_ATTESTATION_ABI, provider),
    transferLifecycle:new ethers.Contract(TRANSFER_LIFECYCLE_ADDRESS, TRANSFER_LIFECYCLE_ABI, provider),
  };
}

/**
 * Get contract instances connected to a specific signer
 */
export function getContractsWithSigner(signer: ethers.Signer) {
  return {
    signer,
    identityRegistry: new ethers.Contract(IDENTITY_REGISTRY_ADDRESS, IDENTITY_REGISTRY_ABI, signer),
    assetNFT:         new ethers.Contract(ASSET_NFT_ADDRESS, ASSET_NFT_ABI, signer),
    assetAttestation: new ethers.Contract(ASSET_ATTESTATION_ADDRESS, ASSET_ATTESTATION_ABI, signer),
    transferLifecycle:new ethers.Contract(TRANSFER_LIFECYCLE_ADDRESS, TRANSFER_LIFECYCLE_ABI, signer),
  };
}

/**
 * Parse blockchain contract errors into human-readable messages.
 * Covers all 4 contracts' custom errors.
 */
export function parseContractError(error: any): {
  userMessage: string;
  technicalReason: string;
  isBlocked: boolean;
} {
  const errorString = error?.message || error?.toString() || "";
  const errorData   = error?.data || error?.error?.data || error?.info?.error?.data;

  if (errorData && typeof errorData === "string") {
    // Try each contract ABI
    const abis = [
      { iface: new Interface(IDENTITY_REGISTRY_ABI), name: "IdentityRegistry" },
      { iface: new Interface(ASSET_NFT_ABI), name: "AssetNFT" },
      { iface: new Interface(ASSET_ATTESTATION_ABI), name: "AssetAttestation" },
      { iface: new Interface(TRANSFER_LIFECYCLE_ABI), name: "TransferLifecycle" },
    ];

    for (const { iface } of abis) {
      try {
        const decoded = iface.parseError(errorData);
        if (decoded) {
          return mapCustomError(decoded.name, decoded.args);
        }
      } catch {}
    }
  }

  // Fallback: pattern match in error string
  return matchErrorString(errorString);
}

function mapCustomError(name: string, args?: any): { userMessage: string; technicalReason: string; isBlocked: boolean } {
  const map: Record<string, [string, string]> = {
    NotAdmin:                  ["Administrator permission required", "Caller is not the designated admin (NotAdmin)"],
    CannotRevokeSelf:          ["Safety: Admin cannot revoke own identity", "Last-admin protection (CannotRevokeSelf)"],
    AlreadyRegistered:         ["Identity is already registered", "IdentityRegistry.AlreadyRegistered"],
    NotRegistered:             ["Identity has not been registered", "IdentityRegistry.NotRegistered"],
    AlreadyActive:             ["Identity is already active", "IdentityRegistry.AlreadyActive"],
    AlreadyInactive:           ["Identity is already inactive/revoked", "IdentityRegistry.AlreadyInactive"],
    ZeroAddress:               ["Invalid address (zero address not allowed)", "ZeroAddress"],
    IdentityNotActive:         ["Active identity required — identity is revoked", "IdentityRegistry.isActive() returned false"],
    NotManager:                ["Manager permission required", "Caller lacks MANAGER_ROLE"],
    InvalidCustodian:          ["Invalid custodian address (zero address)", "InvalidCustodian"],
    CannotRemoveLastAdmin:     ["Safety: Cannot remove the last administrator", "AssetNFT last-admin protection"],
    DirectTransferDisabled:    ["Direct transfers disabled by governance policy", "Use custodyTransfer() or TransferLifecycle"],
    AssetSuspendedOrRevoked:   ["Asset is SUSPENDED or REVOKED — operations blocked", "AssetNFT.AssetSuspendedOrRevoked"],
    NotLifecycleContract:      ["Operation restricted to TransferLifecycle contract", "AssetNFT.NotLifecycleContract"],
    InvalidPhysicalHash:       ["Physical identifier hash cannot be zero", "AssetAttestation.InvalidPhysicalHash"],
    InvalidStateHash:          ["Asset state hash cannot be zero", "AssetAttestation.InvalidStateHash"],
    AttestationIndexOutOfBounds:["Attestation index out of bounds", "AssetAttestation.AttestationIndexOutOfBounds"],
    AlreadyInvalidated:        ["Attestation already invalidated", "AssetAttestation.AlreadyInvalidated"],
    TransferNotFound:          ["Transfer ID does not exist", "TransferLifecycle.TransferNotFound"],
    InvalidTransferState:      ["Operation not valid in current transfer state", "TransferLifecycle.InvalidTransferState"],
    AssetNotTransferable:      ["Asset cannot be transferred — SUSPENDED or REVOKED", "TransferLifecycle.AssetNotTransferable"],
    NotDestination:            ["Only the destination wallet can accept this transfer", "TransferLifecycle.NotDestination"],
    AlreadyCompleted:          ["Transfer is already completed or rejected", "TransferLifecycle.AlreadyCompleted"],
    AccessControlUnauthorizedAccount: ["Permission denied by Access Control", `Account lacks required role`],
  };

  const entry = map[name];
  if (entry) return { userMessage: entry[0], technicalReason: entry[1], isBlocked: true };
  return { userMessage: `Contract error: ${name}`, technicalReason: name, isBlocked: true };
}

function matchErrorString(s: string): { userMessage: string; technicalReason: string; isBlocked: boolean } {
  const patterns: [string, string, string][] = [
    ["IdentityNotActive", "Active identity required", "IdentityRegistry.isActive() returned false"],
    ["NotManager", "Manager permission required", "Caller lacks MANAGER_ROLE"],
    ["NotAdmin", "Administrator permission required", "Caller is not admin"],
    ["CannotRevokeSelf", "Safety: Admin cannot revoke own identity", "Last-admin protection"],
    ["DirectTransferDisabled", "Direct transfers disabled by governance policy", "Use custodyTransfer()"],
    ["AssetSuspendedOrRevoked", "Asset is SUSPENDED or REVOKED", "State blocks operation"],
    ["AccessControlUnauthorizedAccount", "Permission denied by Access Control", "Missing required role"],
    ["user rejected", "Transaction rejected by user in wallet", "User cancelled"],
    ["ACTION_REJECTED", "Transaction rejected by user in wallet", "User cancelled"],
  ];

  for (const [pattern, userMessage, technicalReason] of patterns) {
    if (s.includes(pattern)) return { userMessage, technicalReason, isBlocked: !pattern.includes("reject") };
  }

  return { userMessage: "Action blocked by system policy", technicalReason: s.slice(0, 180), isBlocked: true };
}
