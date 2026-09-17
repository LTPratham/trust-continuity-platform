"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import {
  DEMO_ACCOUNTS,
  DemoAccount,
  getRpcProvider,
  getReadOnlyContracts,
  getContractsWithSigner,
  ROLE_HASHES,
} from "./contracts";

interface AccountState {
  address: string;
  label: string;
  isRegistered: boolean;
  isActive: boolean;
  roles: string[];
  mode: "metamask" | "dev_wallet";
}

interface WalletContextType {
  currentAccount: AccountState;
  selectedDemoIndex: number;
  signer: ethers.Signer | null;
  provider: ethers.Provider;
  isMetaMaskAvailable: boolean;
  connectMetaMask: () => Promise<void>;
  selectDemoAccount: (index: number) => void;
  refreshAccountState: () => Promise<void>;
  loading: boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [selectedDemoIndex, setSelectedDemoIndex] = useState<number>(0);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [isMetaMaskAvailable, setIsMetaMaskAvailable] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const [currentAccount, setCurrentAccount] = useState<AccountState>({
    address: DEMO_ACCOUNTS[0].address,
    label: DEMO_ACCOUNTS[0].label,
    isRegistered: false,
    isActive: false,
    roles: [],
    mode: "dev_wallet",
  });

  const provider = getRpcProvider();

  // Check MetaMask availability
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      setIsMetaMaskAvailable(true);
    }
  }, []);

  // Fetch on-chain status for an address
  const fetchOnChainStatus = useCallback(async (address: string) => {
    try {
      const { identityRegistry, assetNFT } = getReadOnlyContracts();
      
      const isReg = await identityRegistry.isRegistered(address);
      const isAct = await identityRegistry.isActive(address);

      const roles: string[] = [];
      const [hasAdmin, hasManager, hasAuditor, hasUser] = await Promise.all([
        assetNFT.hasRole(ROLE_HASHES.ADMIN, address),
        assetNFT.hasRole(ROLE_HASHES.MANAGER, address),
        assetNFT.hasRole(ROLE_HASHES.AUDITOR, address),
        assetNFT.hasRole(ROLE_HASHES.USER, address),
      ]);

      if (hasAdmin) roles.push("ADMIN");
      if (hasManager) roles.push("MANAGER");
      if (hasAuditor) roles.push("AUDITOR");
      if (hasUser) roles.push("USER");

      return { isReg, isAct, roles };
    } catch (e) {
      console.error("Error fetching on-chain status:", e);
      return { isReg: false, isAct: false, roles: [] };
    }
  }, []);

  // Set initial dev signer
  useEffect(() => {
    const initDefaultSigner = async () => {
      setLoading(true);
      const defaultAcc = DEMO_ACCOUNTS[0];
      const devWallet = new ethers.Wallet(defaultAcc.privateKey, provider);
      setSigner(devWallet);

      const status = await fetchOnChainStatus(defaultAcc.address);
      setCurrentAccount({
        address: defaultAcc.address,
        label: defaultAcc.label,
        isRegistered: status.isReg,
        isActive: status.isAct,
        roles: status.roles,
        mode: "dev_wallet",
      });
      setLoading(false);
    };

    initDefaultSigner();
  }, [fetchOnChainStatus]);

  // Connect MetaMask (Primary path for judges)
  const connectMetaMask = async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      alert("MetaMask extension not found in browser. Please install MetaMask or use Demo Accounts mode.");
      return;
    }

    try {
      setLoading(true);
      const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
      await browserProvider.send("eth_requestAccounts", []);
      const metaMaskSigner = await browserProvider.getSigner();
      const metaMaskAddress = await metaMaskSigner.getAddress();

      setSigner(metaMaskSigner);
      const status = await fetchOnChainStatus(metaMaskAddress);

      // Check if address matches a known demo account label
      const matchedDemo = DEMO_ACCOUNTS.find(
        (a) => a.address.toLowerCase() === metaMaskAddress.toLowerCase()
      );

      setCurrentAccount({
        address: metaMaskAddress,
        label: matchedDemo ? `${matchedDemo.label} (via MetaMask)` : "MetaMask Account",
        isRegistered: status.isReg,
        isActive: status.isAct,
        roles: status.roles,
        mode: "metamask",
      });
    } catch (err: any) {
      console.error("MetaMask connection error:", err);
      alert(`MetaMask connection error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Select Dev Account (Secondary path for fast demo convenience)
  const selectDemoAccount = async (index: number) => {
    setLoading(true);
    setSelectedDemoIndex(index);
    const acc = DEMO_ACCOUNTS[index];
    const devWallet = new ethers.Wallet(acc.privateKey, provider);
    setSigner(devWallet);

    const status = await fetchOnChainStatus(acc.address);
    setCurrentAccount({
      address: acc.address,
      label: acc.label,
      isRegistered: status.isReg,
      isActive: status.isAct,
      roles: status.roles,
      mode: "dev_wallet",
    });
    setLoading(false);
  };

  const refreshAccountState = async () => {
    if (!currentAccount.address) return;
    const status = await fetchOnChainStatus(currentAccount.address);
    setCurrentAccount((prev) => ({
      ...prev,
      isRegistered: status.isReg,
      isActive: status.isAct,
      roles: status.roles,
    }));
  };

  return (
    <WalletContext.Provider
      value={{
        currentAccount,
        selectedDemoIndex,
        signer,
        provider,
        isMetaMaskAvailable,
        connectMetaMask,
        selectDemoAccount,
        refreshAccountState,
        loading,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
