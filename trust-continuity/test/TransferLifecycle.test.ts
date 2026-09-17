import { expect } from "chai";
import { ethers } from "hardhat";
import { IdentityRegistry, AssetNFT, TransferLifecycle } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("TransferLifecycle", function () {
  let identityRegistry: IdentityRegistry;
  let assetNFT: AssetNFT;
  let lifecycle: TransferLifecycle;

  let admin: HardhatEthersSigner;
  let manager: HardhatEthersSigner;
  let destination: HardhatEthersSigner;
  let attacker: HardhatEthersSigner;

  const MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"));
  const USER_ROLE    = ethers.keccak256(ethers.toUtf8Bytes("USER_ROLE"));
  const ZERO_CRED    = ethers.ZeroHash;

  const sampleHash  = ethers.keccak256(ethers.toUtf8Bytes("BEL Spec Document"));
  const contextHash = ethers.keccak256(ethers.toUtf8Bytes("Transfer to facility B for inspection"));

  const TOKEN_ID = 1047;

  // Transfer states
  const TRANSFER_REQUESTED     = 0;
  const ORIGIN_VERIFIED        = 1;
  const ASSET_STATE_VERIFIED   = 2;
  const DESTINATION_AUTHORIZED = 3;
  const DESTINATION_ACCEPTED   = 4;
  const TRANSFER_CONFIRMED     = 5;
  const TRANSFER_REJECTED      = 6;

  async function deployAll() {
    const IdFactory = await ethers.getContractFactory("IdentityRegistry");
    identityRegistry = await IdFactory.deploy();
    await identityRegistry.waitForDeployment();

    const AssetFactory = await ethers.getContractFactory("AssetNFT");
    assetNFT = await AssetFactory.deploy(await identityRegistry.getAddress());
    await assetNFT.waitForDeployment();

    const LifecycleFactory = await ethers.getContractFactory("TransferLifecycle");
    lifecycle = await LifecycleFactory.deploy(
      await assetNFT.getAddress(),
      await identityRegistry.getAddress()
    );
    await lifecycle.waitForDeployment();

    // Link lifecycle contract to AssetNFT
    await assetNFT.connect(admin).setLifecycleContract(await lifecycle.getAddress());
  }

  async function setupIdentitiesAndRoles() {
    await identityRegistry.connect(admin).registerIdentity(admin.address, "Admin", ZERO_CRED);
    await identityRegistry.connect(admin).registerIdentity(manager.address, "Manager", ZERO_CRED);
    await identityRegistry.connect(admin).registerIdentity(destination.address, "Destination", ZERO_CRED);

    await assetNFT.connect(admin).grantRole(MANAGER_ROLE, manager.address);
    await assetNFT.connect(admin).grantRole(USER_ROLE, destination.address);
  }

  async function mintAsset() {
    await assetNFT.connect(manager).mintAsset(
      manager.address, TOKEN_ID, "BEL-TEST-1047",
      "Secure Defense Asset A-001", "Bench test unit", sampleHash
    );
  }

  beforeEach(async function () {
    [admin, manager, destination, attacker] = await ethers.getSigners();
    await deployAll();
    await setupIdentitiesAndRoles();
    await mintAsset();
  });

  describe("Deployment", function () {
    it("Admin has DEFAULT_ADMIN_ROLE in lifecycle", async function () {
      expect(await lifecycle.hasRole(ethers.ZeroHash, admin.address)).to.be.true;
    });

    it("lifecycleContract set in AssetNFT", async function () {
      expect(await assetNFT.lifecycleContract()).to.equal(await lifecycle.getAddress());
    });
  });

  describe("Full Happy Path Transfer (6 steps)", function () {
    it("Completes a full governed transfer through all stages", async function () {
      // Step 1+2+3: Request transfer (auto-advances to ASSET_STATE_VERIFIED)
      await expect(
        lifecycle.connect(manager).requestTransfer(TOKEN_ID, destination.address, contextHash)
      ).to.emit(lifecycle, "TransferRequested");

      let [tokenId, initiator, dest, state] = await lifecycle.getTransfer(0);
      expect(tokenId).to.equal(TOKEN_ID);
      expect(initiator).to.equal(manager.address);
      expect(dest).to.equal(destination.address);
      expect(state).to.equal(ASSET_STATE_VERIFIED); // auto-advanced

      // Step 4: Admin authorizes destination
      await expect(lifecycle.connect(admin).authorizeDestination(0))
        .to.emit(lifecycle, "TransferStateAdvanced")
        .withArgs(0, ASSET_STATE_VERIFIED, DESTINATION_AUTHORIZED, admin.address,
          (v: unknown) => typeof v === "bigint");

      [, , , state] = await lifecycle.getTransfer(0);
      expect(state).to.equal(DESTINATION_AUTHORIZED);

      // Step 5: Destination accepts
      await expect(lifecycle.connect(destination).acceptTransfer(0))
        .to.emit(lifecycle, "TransferStateAdvanced")
        .withArgs(0, DESTINATION_AUTHORIZED, DESTINATION_ACCEPTED, destination.address,
          (v: unknown) => typeof v === "bigint");

      // Step 6: Manager confirms and executes on-chain
      await expect(lifecycle.connect(manager).confirmTransfer(0))
        .to.emit(lifecycle, "TransferCompleted")
        .withArgs(0, TOKEN_ID, destination.address, (v: unknown) => typeof v === "bigint");

      // Verify on-chain state
      expect(await assetNFT.ownerOf(TOKEN_ID)).to.equal(destination.address);
      expect(await assetNFT.getAssetState(TOKEN_ID)).to.equal(5); // TRANSFERRED

      const [, , , finalState, , completedAt] = await lifecycle.getTransfer(0);
      expect(finalState).to.equal(TRANSFER_CONFIRMED);
      expect(completedAt).to.be.gt(0);
    });
  });

  describe("Trust Continuity Checks — DENY Scenarios", function () {
    it("Inactive manager identity fails at requestTransfer -> DENY (check 1)", async function () {
      await identityRegistry.connect(admin).revokeIdentity(manager.address);

      await expect(
        lifecycle.connect(manager).requestTransfer(TOKEN_ID, destination.address, contextHash)
      ).to.be.revertedWithCustomError(lifecycle, "IdentityNotActive");
    });

    it("Account without MANAGER_ROLE fails at requestTransfer -> DENY (check 2)", async function () {
      // Register attacker so identity check passes, but do NOT grant MANAGER_ROLE
      await identityRegistry.connect(admin).registerIdentity(attacker.address, "No-Role User", ethers.ZeroHash);
      await expect(
        lifecycle.connect(attacker).requestTransfer(TOKEN_ID, destination.address, contextHash)
      ).to.be.revertedWithCustomError(lifecycle, "NotManager");
    });

    it("Suspended asset fails at requestTransfer -> DENY (check 3)", async function () {
      await assetNFT.connect(admin).suspendAsset(TOKEN_ID);
      await expect(
        lifecycle.connect(manager).requestTransfer(TOKEN_ID, destination.address, contextHash)
      ).to.be.revertedWithCustomError(lifecycle, "AssetNotTransferable");
    });

    it("Wrong wallet cannot accept transfer -> DENY", async function () {
      await lifecycle.connect(manager).requestTransfer(TOKEN_ID, destination.address, contextHash);
      await lifecycle.connect(admin).authorizeDestination(0);

      await expect(
        lifecycle.connect(attacker).acceptTransfer(0)
      ).to.be.revertedWithCustomError(lifecycle, "NotDestination");
    });

    it("Cannot authorize from wrong state -> DENY", async function () {
      // No transfer created — index 0 doesn't exist
      await expect(
        lifecycle.connect(admin).authorizeDestination(0)
      ).to.be.revertedWithCustomError(lifecycle, "TransferNotFound");
    });

    it("Inactive manager fails at confirmTransfer -> DENY (re-validation)", async function () {
      await lifecycle.connect(manager).requestTransfer(TOKEN_ID, destination.address, contextHash);
      await lifecycle.connect(admin).authorizeDestination(0);
      await lifecycle.connect(destination).acceptTransfer(0);

      // Revoke manager between acceptance and confirmation
      await identityRegistry.connect(admin).revokeIdentity(manager.address);

      await expect(
        lifecycle.connect(manager).confirmTransfer(0)
      ).to.be.revertedWithCustomError(lifecycle, "IdentityNotActive");
    });

    it("Zero destination address fails -> DENY", async function () {
      await expect(
        lifecycle.connect(manager).requestTransfer(TOKEN_ID, ethers.ZeroAddress, contextHash)
      ).to.be.revertedWithCustomError(lifecycle, "ZeroAddress");
    });
  });

  describe("Transfer Rejection", function () {
    it("Admin can reject a transfer with reason", async function () {
      await lifecycle.connect(manager).requestTransfer(TOKEN_ID, destination.address, contextHash);

      await expect(
        lifecycle.connect(admin).rejectTransfer(0, "Destination facility not cleared")
      ).to.emit(lifecycle, "TransferRejected")
        .withArgs(0, TOKEN_ID, "Destination facility not cleared", admin.address,
          (v: unknown) => typeof v === "bigint");

      const [, , , state, , , reason] = await lifecycle.getTransfer(0);
      expect(state).to.equal(TRANSFER_REJECTED);
      expect(reason).to.equal("Destination facility not cleared");
    });

    it("Cannot operate on a rejected transfer", async function () {
      await lifecycle.connect(manager).requestTransfer(TOKEN_ID, destination.address, contextHash);
      await lifecycle.connect(admin).rejectTransfer(0, "Rejected");

      await expect(
        lifecycle.connect(admin).authorizeDestination(0)
      ).to.be.revertedWithCustomError(lifecycle, "AlreadyCompleted");
    });

    it("Cannot operate on a confirmed transfer", async function () {
      await lifecycle.connect(manager).requestTransfer(TOKEN_ID, destination.address, contextHash);
      await lifecycle.connect(admin).authorizeDestination(0);
      await lifecycle.connect(destination).acceptTransfer(0);
      await lifecycle.connect(manager).confirmTransfer(0);

      await expect(
        lifecycle.connect(admin).rejectTransfer(0, "Too late")
      ).to.be.revertedWithCustomError(lifecycle, "AlreadyCompleted");
    });
  });

  describe("Direct trustedTransfer Protection", function () {
    it("Direct trustedTransfer from non-lifecycle address is blocked", async function () {
      await expect(
        assetNFT.connect(manager).trustedTransfer(destination.address, TOKEN_ID)
      ).to.be.revertedWithCustomError(assetNFT, "NotLifecycleContract");
    });

    it("Attacker cannot call trustedTransfer", async function () {
      await expect(
        assetNFT.connect(attacker).trustedTransfer(attacker.address, TOKEN_ID)
      ).to.be.revertedWithCustomError(assetNFT, "NotLifecycleContract");
    });
  });

  describe("Transfer History", function () {
    it("getTransfersForToken returns correct IDs", async function () {
      await lifecycle.connect(manager).requestTransfer(TOKEN_ID, destination.address, contextHash);
      await lifecycle.connect(admin).rejectTransfer(0, "Rejected");

      // Mint a second token and create transfer for it
      await assetNFT.connect(manager).mintAsset(
        manager.address, 1048, "BEL-TEST-1048",
        "Asset B", "Bench test", sampleHash
      );
      await lifecycle.connect(manager).requestTransfer(1048, destination.address, contextHash);

      const ids = await lifecycle.getTransfersForToken(TOKEN_ID);
      expect(ids.length).to.equal(1);
      expect(ids[0]).to.equal(0);
    });
  });
});
