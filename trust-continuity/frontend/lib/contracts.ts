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

export const DEMO_ACCOUNTS: DemoAccount[] = deploymentsData.demoAccounts;

export const IDENTITY_REGISTRY_ADDRESS = deploymentsData.contracts.IdentityRegistry.address;
export const IDENTITY_REGISTRY_ABI = deploymentsData.contracts.IdentityRegistry.abi;

export const ASSET_NFT_ADDRESS = deploymentsData.contracts.AssetNFT.address;
export const ASSET_NFT_ABI = deploymentsData.contracts.AssetNFT.abi;

// Constant Role Hashes
export const ROLE_HASHES = {
  ADMIN: ethers.ZeroHash,
  MANAGER: ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE")),
  AUDITOR: ethers.keccak256(ethers.toUtf8Bytes("AUDITOR_ROLE")),
  USER: ethers.keccak256(ethers.toUtf8Bytes("USER_ROLE")),
};

/**
 * Get read-only JSON-RPC provider connected to local node
 */
export function getRpcProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(LOCAL_RPC_URL);
}

/**
 * Get read-only contract instances
 */
export function getReadOnlyContracts() {
  const provider = getRpcProvider();
  const identityRegistry = new ethers.Contract(
    IDENTITY_REGISTRY_ADDRESS,
    IDENTITY_REGISTRY_ABI,
    provider
  );
  const assetNFT = new ethers.Contract(
    ASSET_NFT_ADDRESS,
    ASSET_NFT_ABI,
    provider
  );
  return { identityRegistry, assetNFT, provider };
}

/**
 * Get contract instances connected to a specific signer
 */
export function getContractsWithSigner(signer: ethers.Signer) {
  const identityRegistry = new ethers.Contract(
    IDENTITY_REGISTRY_ADDRESS,
    IDENTITY_REGISTRY_ABI,
    signer
  );
  const assetNFT = new ethers.Contract(
    ASSET_NFT_ADDRESS,
    ASSET_NFT_ABI,
    signer
  );
  return { identityRegistry, assetNFT, signer };
}

/**
 * Translate blockchain errors and reverts into clear human-readable messages
 * as required by SIH specification (§14)
 */
export function parseContractError(error: any): {
  userMessage: string;
  technicalReason: string;
  isBlocked: boolean;
} {
  console.error("Original blockchain error:", error);

  const errorString = error?.message || error?.toString() || "";
  const errorData = error?.data || error?.error?.data || error?.info?.error?.data;

  // Check custom errors by decoding error data if present
  if (errorData && typeof errorData === "string") {
    try {
      const idIface = new Interface(IDENTITY_REGISTRY_ABI);
      const decodedId = idIface.parseError(errorData);
      if (decodedId) {
        switch (decodedId.name) {
          case "NotAdmin":
            return {
              userMessage: "Administrator permission required",
              technicalReason: "Caller is not the authorized administrator (NotAdmin)",
              isBlocked: true,
            };
          case "CannotRevokeSelf":
            return {
              userMessage: "Safety policy: Administrator cannot revoke own identity",
              technicalReason: "Last-admin protection enforced by IdentityRegistry.sol",
              isBlocked: true,
            };
          case "AlreadyRegistered":
            return {
              userMessage: "Identity is already registered in the registry",
              technicalReason: "IdentityRegistry.AlreadyRegistered",
              isBlocked: true,
            };
          case "NotRegistered":
            return {
              userMessage: "Identity has not been registered",
              technicalReason: "IdentityRegistry.NotRegistered",
              isBlocked: true,
            };
          case "AlreadyActive":
            return {
              userMessage: "Identity is already active",
              technicalReason: "IdentityRegistry.AlreadyActive",
              isBlocked: true,
            };
          case "AlreadyInactive":
            return {
              userMessage: "Identity is already inactive/revoked",
              technicalReason: "IdentityRegistry.AlreadyInactive",
              isBlocked: true,
            };
          case "ZeroAddress":
            return {
              userMessage: "Invalid address (zero address not allowed)",
              technicalReason: "IdentityRegistry.ZeroAddress",
              isBlocked: true,
            };
        }
      }
    } catch {}

    try {
      const assetIface = new Interface(ASSET_NFT_ABI);
      const decodedAsset = assetIface.parseError(errorData);
      if (decodedAsset) {
        switch (decodedAsset.name) {
          case "IdentityNotActive":
            return {
              userMessage: "Active identity required — identity is revoked or not registered",
              technicalReason: "IdentityRegistry.isActive(msg.sender) returned false",
              isBlocked: true,
            };
          case "NotManager":
            return {
              userMessage: "Manager permission required",
              technicalReason: "Caller lacks MANAGER_ROLE in AssetNFT.sol",
              isBlocked: true,
            };
          case "InvalidCustodian":
            return {
              userMessage: "Invalid custodian address",
              technicalReason: "Recipient cannot be zero address (InvalidCustodian)",
              isBlocked: true,
            };
          case "CannotRemoveLastAdmin":
            return {
              userMessage: "Safety policy: Cannot remove the last administrator",
              technicalReason: "AssetNFT._adminCount protection prevents lockout",
              isBlocked: true,
            };
          case "DirectTransferDisabled":
            return {
              userMessage: "Direct transfers are disabled by system governance policy",
              technicalReason: "ERC-721 transferFrom/approve disabled; custody transfer only",
              isBlocked: true,
            };
          case "AccessControlUnauthorizedAccount":
            return {
              userMessage: "Permission denied by system Access Control",
              technicalReason: `Account lacks role: ${decodedAsset.args?.[1] || "privileged"}`,
              isBlocked: true,
            };
        }
      }
    } catch {}
  }

  // Fallback pattern matching in error text / revert strings
  if (errorString.includes("IdentityNotActive")) {
    return {
      userMessage: "Active identity required — identity is revoked or not registered",
      technicalReason: "IdentityRegistry.isActive(msg.sender) returned false",
      isBlocked: true,
    };
  }
  if (errorString.includes("NotManager")) {
    return {
      userMessage: "Manager permission required",
      technicalReason: "Caller lacks MANAGER_ROLE in AssetNFT.sol",
      isBlocked: true,
    };
  }
  if (errorString.includes("NotAdmin")) {
    return {
      userMessage: "Administrator permission required",
      technicalReason: "Caller is not the designated admin",
      isBlocked: true,
    };
  }
  if (errorString.includes("CannotRevokeSelf")) {
    return {
      userMessage: "Safety policy: Admin cannot revoke own identity",
      technicalReason: "Last-admin protection enforced by IdentityRegistry.sol",
      isBlocked: true,
    };
  }
  if (errorString.includes("DirectTransferDisabled")) {
    return {
      userMessage: "Direct transfers are disabled by governance policy",
      technicalReason: "Standard ERC721 transfers blocked in governed asset",
      isBlocked: true,
    };
  }
  if (errorString.includes("AccessControlUnauthorizedAccount")) {
    return {
      userMessage: "Permission denied by system Access Control",
      technicalReason: "Caller lacks the required governance role",
      isBlocked: true,
    };
  }
  if (errorString.includes("user rejected") || errorString.includes("ACTION_REJECTED")) {
    return {
      userMessage: "Transaction was rejected by the user in wallet",
      technicalReason: "User cancelled signature request",
      isBlocked: false,
    };
  }

  return {
    userMessage: "Action blocked by system policy",
    technicalReason: errorString.slice(0, 180),
    isBlocked: true,
  };
}
