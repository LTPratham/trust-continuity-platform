import { expect } from "chai";
import { ethers } from "hardhat";
import { IdentityRegistry, AssetNFT } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("AssetNFT", function () {
  let identityRegistry: IdentityRegistry;
  let assetNFT: AssetNFT;
  let admin: HardhatEthersSigner;
  let manager: HardhatEthersSigner;
  let engineerB: HardhatEthersSigner;
  let unauthorized: HardhatEthersSigner;

  const MANAGER_ROLE      = ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"));
  const USER_ROLE         = ethers.keccak256(ethers.toUtf8Bytes("USER_ROLE"));
  const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;
  const ZERO_CRED         = ethers.ZeroHash;

  const sampleHash = ethers.keccak256(ethers.toUtf8Bytes("Technical Specs BEL-TEST-1047"));

  beforeEach(async function () {
    [admin, manager, engineerB, unauthorized] = await ethers.getSigners();

    const IdFactory = await ethers.getContractFactory("IdentityRegistry");
    identityRegistry = await IdFactory.deploy();
    await identityRegistry.waitForDeployment();

    const AssetFactory = await ethers.getContractFactory("AssetNFT");
    assetNFT = await AssetFactory.deploy(await identityRegistry.getAddress());
    await assetNFT.waitForDeployment();

    // Register identities
    await identityRegistry.connect(admin).registerIdentity(admin.address, "Admin", ZERO_CRED);
    await identityRegistry.connect(admin).registerIdentity(manager.address, "Manager", ZERO_CRED);
    await identityRegistry.connect(admin).registerIdentity(engineerB.address, "EngineerB", ZERO_CRED);

    // Grant roles
    await assetNFT.connect(admin).grantRole(MANAGER_ROLE, manager.address);
    await assetNFT.connect(admin).grantRole(USER_ROLE, engineerB.address);
  });

  describe("Deployment & Role Setup", function () {
    it("Admin has DEFAULT_ADMIN_ROLE", async function () {
      expect(await assetNFT.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
    });

    it("Manager has MANAGER_ROLE", async function () {
      expect(await assetNFT.hasRole(MANAGER_ROLE, manager.address)).to.be.true;
    });

    it("User has USER_ROLE and not MANAGER_ROLE", async function () {
      expect(await assetNFT.hasRole(USER_ROLE, engineerB.address)).to.be.true;
      expect(await assetNFT.hasRole(MANAGER_ROLE, engineerB.address)).to.be.false;
    });
  });

  describe("Asset Minting", function () {
    it("Active Manager can mint an asset", async function () {
      await expect(
        assetNFT.connect(manager).mintAsset(
          manager.address, 1047, "BEL-TEST-1047",
          "Secure Defense Asset A-001", "Hardware unit for test bench", sampleHash
        )
      )
        .to.emit(assetNFT, "AssetMinted")
        .withArgs(1047, "BEL-TEST-1047", manager.address, manager.address, sampleHash,
          (val: unknown) => typeof val === "bigint");

      expect(await assetNFT.ownerOf(1047)).to.equal(manager.address);
      expect(await assetNFT.totalAssets()).to.equal(1);

      const assetData = await assetNFT.assets(1047);
      expect(assetData.assetId).to.equal("BEL-TEST-1047");
      expect(assetData.custodian).to.equal(manager.address);
      expect(assetData.createdBy).to.equal(manager.address);
      expect(assetData.documentHash).to.equal(sampleHash);
      expect(assetData.status).to.equal(0); // REGISTERED
    });

    it("Non-manager cannot mint an asset", async function () {
      await expect(
        assetNFT.connect(engineerB).mintAsset(
          engineerB.address, 1048, "BEL-TEST-1048",
          "Test Item", "Unauthorized mint", sampleHash
        )
      ).to.be.revertedWithCustomError(assetNFT, "NotManager");
    });

    it("Cannot mint duplicate token IDs", async function () {
      await assetNFT.connect(manager).mintAsset(
        manager.address, 1047, "BEL-TEST-1047",
        "Secure Defense Asset A-001", "Test bench unit", sampleHash
      );
      await expect(
        assetNFT.connect(manager).mintAsset(
          manager.address, 1047, "BEL-TEST-1047-DUP",
          "Duplicate Unit", "Duplicate attempt", sampleHash
        )
      ).to.be.revertedWithCustomError(assetNFT, "ERC721InvalidSender");
    });

    it("Cannot mint with zero address as custodian", async function () {
      await expect(
        assetNFT.connect(manager).mintAsset(
          ethers.ZeroAddress, 1049, "BEL-TEST-1049",
          "Test", "Invalid Custodian", sampleHash
        )
      ).to.be.revertedWithCustomError(assetNFT, "InvalidCustodian");
    });
  });

  describe("Asset State Management", function () {
    beforeEach(async function () {
      await assetNFT.connect(manager).mintAsset(
        manager.address, 1047, "BEL-TEST-1047",
        "Secure Defense Asset A-001", "Bench test unit", sampleHash
      );
    });

    it("Active manager can update asset state", async function () {
      await expect(assetNFT.connect(manager).updateAssetState(1047, 1)) // ALLOCATED
        .to.emit(assetNFT, "AssetStateChanged")
        .withArgs(1047, 0, 1, manager.address, (v: unknown) => typeof v === "bigint");
      expect(await assetNFT.getAssetState(1047)).to.equal(1);
    });

    it("Non-manager cannot update asset state", async function () {
      await expect(
        assetNFT.connect(engineerB).updateAssetState(1047, 1)
      ).to.be.revertedWithCustomError(assetNFT, "NotManager");
    });

    it("Admin can suspend and unsuspend an asset", async function () {
      await expect(assetNFT.connect(admin).suspendAsset(1047))
        .to.emit(assetNFT, "AssetSuspended");
      expect(await assetNFT.getAssetState(1047)).to.equal(6); // SUSPENDED

      await assetNFT.connect(admin).unsuspendAsset(1047);
      expect(await assetNFT.getAssetState(1047)).to.equal(0); // back to REGISTERED
    });

    it("Admin can revoke an asset", async function () {
      await expect(assetNFT.connect(admin).revokeAsset(1047))
        .to.emit(assetNFT, "AssetRevoked");
      expect(await assetNFT.getAssetState(1047)).to.equal(7); // REVOKED
    });

    it("Manager cannot update state of suspended asset", async function () {
      await assetNFT.connect(admin).suspendAsset(1047);
      await expect(
        assetNFT.connect(manager).updateAssetState(1047, 2)
      ).to.be.revertedWithCustomError(assetNFT, "AssetSuspendedOrRevoked");
    });
  });

  describe("Asset Attestation", function () {
    const physHash = ethers.keccak256(ethers.toUtf8Bytes("SN-12345-XYZ"));
    const stateHash = ethers.keccak256(ethers.toUtf8Bytes("state-record-v1"));
    const metaHash = ethers.keccak256(ethers.toUtf8Bytes("metadata-blob-v1"));

    beforeEach(async function () {
      await assetNFT.connect(manager).mintAsset(
        manager.address, 1047, "BEL-TEST-1047",
        "Secure Defense Asset A-001", "Bench test unit", sampleHash
      );
    });

    it("Active manager can attest an asset", async function () {
      await expect(
        assetNFT.connect(manager).attestAsset(1047, physHash, stateHash, metaHash)
      ).to.emit(assetNFT, "AssetAttested")
        .withArgs(1047, physHash, stateHash, manager.address, (v: unknown) => typeof v === "bigint");

      const data = await assetNFT.assets(1047);
      expect(data.physicalIdentifierHash).to.equal(physHash);
      expect(data.assetStateHash).to.equal(stateHash);
      expect(data.metadataHash).to.equal(metaHash);
      expect(data.attestedBy).to.equal(manager.address);
      expect(data.lastAttestation).to.be.gt(0);
    });

    it("Non-manager cannot attest asset", async function () {
      await expect(
        assetNFT.connect(engineerB).attestAsset(1047, physHash, stateHash, metaHash)
      ).to.be.revertedWithCustomError(assetNFT, "NotManager");
    });
  });

  describe("Custody Transfer (Governance Action)", function () {
    beforeEach(async function () {
      await assetNFT.connect(manager).mintAsset(
        manager.address, 1047, "BEL-TEST-1047",
        "Secure Defense Asset A-001", "Bench test unit", sampleHash
      );
    });

    it("Active Manager can transfer custody to Engineer B", async function () {
      await expect(assetNFT.connect(manager).custodyTransfer(engineerB.address, 1047))
        .to.emit(assetNFT, "AssetCustodyTransferred")
        .withArgs(1047, manager.address, engineerB.address, manager.address,
          (val: unknown) => typeof val === "bigint");

      expect(await assetNFT.ownerOf(1047)).to.equal(engineerB.address);
      const assetData = await assetNFT.assets(1047);
      expect(assetData.custodian).to.equal(engineerB.address);
      expect(assetData.status).to.equal(5); // TRANSFERRED
    });

    it("Non-manager cannot transfer custody", async function () {
      await expect(
        assetNFT.connect(engineerB).custodyTransfer(unauthorized.address, 1047)
      ).to.be.revertedWithCustomError(assetNFT, "NotManager");
    });

    it("Cannot transfer custody to zero address", async function () {
      await expect(
        assetNFT.connect(manager).custodyTransfer(ethers.ZeroAddress, 1047)
      ).to.be.revertedWithCustomError(assetNFT, "InvalidCustodian");
    });

    it("Cannot transfer a suspended asset", async function () {
      await assetNFT.connect(admin).suspendAsset(1047);
      await expect(
        assetNFT.connect(manager).custodyTransfer(engineerB.address, 1047)
      ).to.be.revertedWithCustomError(assetNFT, "AssetSuspendedOrRevoked");
    });

    it("Standard direct ERC-721 transfers are disabled", async function () {
      await expect(
        assetNFT.connect(manager).transferFrom(manager.address, engineerB.address, 1047)
      ).to.be.revertedWithCustomError(assetNFT, "DirectTransferDisabled");

      await expect(
        assetNFT.connect(manager).approve(engineerB.address, 1047)
      ).to.be.revertedWithCustomError(assetNFT, "DirectTransferDisabled");

      await expect(
        assetNFT.connect(manager).setApprovalForAll(engineerB.address, true)
      ).to.be.revertedWithCustomError(assetNFT, "DirectTransferDisabled");
    });
  });

  describe("Document Integrity Verification", function () {
    beforeEach(async function () {
      await assetNFT.connect(manager).mintAsset(
        manager.address, 1047, "BEL-TEST-1047",
        "Secure Defense Asset A-001", "Bench test unit", sampleHash
      );
    });

    it("Returns true for exact matching document hash", async function () {
      const [matches, storedHash] = await assetNFT.verifyIntegrity(1047, sampleHash);
      expect(matches).to.be.true;
      expect(storedHash).to.equal(sampleHash);
    });

    it("Returns false for altered document hash (tampering detected)", async function () {
      const alteredHash = ethers.keccak256(ethers.toUtf8Bytes("TAMPERED DOCUMENT"));
      const [matches, storedHash] = await assetNFT.verifyIntegrity(1047, alteredHash);
      expect(matches).to.be.false;
      expect(storedHash).to.equal(sampleHash);
    });
  });

  describe("Administrator Safety", function () {
    it("Cannot remove the last DEFAULT_ADMIN_ROLE holder", async function () {
      await expect(
        assetNFT.connect(admin).revokeRole(DEFAULT_ADMIN_ROLE, admin.address)
      ).to.be.revertedWithCustomError(assetNFT, "CannotRemoveLastAdmin");
    });

    it("Can revoke admin role if another admin exists", async function () {
      await assetNFT.connect(admin).grantRole(DEFAULT_ADMIN_ROLE, manager.address);
      await expect(
        assetNFT.connect(admin).revokeRole(DEFAULT_ADMIN_ROLE, admin.address)
      ).to.not.be.reverted;
      expect(await assetNFT.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.false;
      expect(await assetNFT.hasRole(DEFAULT_ADMIN_ROLE, manager.address)).to.be.true;
    });
  });
});
