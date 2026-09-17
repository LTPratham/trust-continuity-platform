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

  const MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"));
  const USER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("USER_ROLE"));
  const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;

  const sampleHash = ethers.keccak256(ethers.toUtf8Bytes("Technical Specs BEL-TEST-1047"));

  beforeEach(async function () {
    [admin, manager, engineerB, unauthorized] = await ethers.getSigners();

    const IdFactory = await ethers.getContractFactory("IdentityRegistry");
    identityRegistry = await IdFactory.deploy();
    await identityRegistry.waitForDeployment();

    const AssetFactory = await ethers.getContractFactory("AssetNFT");
    assetNFT = await AssetFactory.deploy(await identityRegistry.getAddress());
    await assetNFT.waitForDeployment();

    // Register admin, manager, engineerB in IdentityRegistry
    await identityRegistry.connect(admin).registerIdentity(admin.address);
    await identityRegistry.connect(admin).registerIdentity(manager.address);
    await identityRegistry.connect(admin).registerIdentity(engineerB.address);

    // Grant roles in AssetNFT
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
        assetNFT
          .connect(manager)
          .mintAsset(
            manager.address,
            1047,
            "BEL-TEST-1047",
            "Radar Component A",
            "Hardware unit for test bench",
            sampleHash
          )
      )
        .to.emit(assetNFT, "AssetMinted")
        .withArgs(1047, "BEL-TEST-1047", manager.address, manager.address, sampleHash, (val: unknown) => typeof val === "bigint");

      expect(await assetNFT.ownerOf(1047)).to.equal(manager.address);
      expect(await assetNFT.totalAssets()).to.equal(1);

      const assetData = await assetNFT.assets(1047);
      expect(assetData.assetId).to.equal("BEL-TEST-1047");
      expect(assetData.custodian).to.equal(manager.address);
      expect(assetData.createdBy).to.equal(manager.address);
      expect(assetData.documentHash).to.equal(sampleHash);
    });

    it("Non-manager cannot mint an asset", async function () {
      await expect(
        assetNFT
          .connect(engineerB)
          .mintAsset(
            engineerB.address,
            1048,
            "BEL-TEST-1048",
            "Test Item",
            "Unauthorized mint attempt",
            sampleHash
          )
      ).to.be.revertedWithCustomError(assetNFT, "NotManager");
    });

    it("Cannot mint duplicate token IDs", async function () {
      await assetNFT
        .connect(manager)
        .mintAsset(
          manager.address,
          1047,
          "BEL-TEST-1047",
          "Radar Component A",
          "Test bench unit",
          sampleHash
        );

      await expect(
        assetNFT
          .connect(manager)
          .mintAsset(
            manager.address,
            1047,
            "BEL-TEST-1047-DUP",
            "Duplicate Unit",
            "Duplicate attempt",
            sampleHash
          )
      ).to.be.revertedWithCustomError(assetNFT, "ERC721InvalidSender");
    });

    it("Cannot mint with zero address as custodian", async function () {
      await expect(
        assetNFT
          .connect(manager)
          .mintAsset(
            ethers.ZeroAddress,
            1049,
            "BEL-TEST-1049",
            "Test",
            "Invalid Custodian",
            sampleHash
          )
      ).to.be.revertedWithCustomError(assetNFT, "InvalidCustodian");
    });
  });

  describe("Custody Transfer (Governance Action)", function () {
    beforeEach(async function () {
      await assetNFT
        .connect(manager)
        .mintAsset(
          manager.address,
          1047,
          "BEL-TEST-1047",
          "Radar Component A",
          "Bench test unit",
          sampleHash
        );
    });

    it("Active Manager can transfer custody to Engineer B", async function () {
      await expect(
        assetNFT.connect(manager).custodyTransfer(engineerB.address, 1047)
      )
        .to.emit(assetNFT, "AssetCustodyTransferred")
        .withArgs(1047, manager.address, engineerB.address, manager.address, (val: unknown) => typeof val === "bigint");

      expect(await assetNFT.ownerOf(1047)).to.equal(engineerB.address);
      const assetData = await assetNFT.assets(1047);
      expect(assetData.custodian).to.equal(engineerB.address);
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

    it("Standard direct ERC-721 transfers are disabled", async function () {
      // transferFrom should be blocked
      await expect(
        assetNFT.connect(manager).transferFrom(manager.address, engineerB.address, 1047)
      ).to.be.revertedWithCustomError(assetNFT, "DirectTransferDisabled");

      // approve should be blocked
      await expect(
        assetNFT.connect(manager).approve(engineerB.address, 1047)
      ).to.be.revertedWithCustomError(assetNFT, "DirectTransferDisabled");

      // setApprovalForAll should be blocked
      await expect(
        assetNFT.connect(manager).setApprovalForAll(engineerB.address, true)
      ).to.be.revertedWithCustomError(assetNFT, "DirectTransferDisabled");
    });
  });

  describe("Document Integrity Verification", function () {
    beforeEach(async function () {
      await assetNFT
        .connect(manager)
        .mintAsset(
          manager.address,
          1047,
          "BEL-TEST-1047",
          "Radar Component A",
          "Bench test unit",
          sampleHash
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
      // Add second admin
      await assetNFT.connect(admin).grantRole(DEFAULT_ADMIN_ROLE, manager.address);
      // Now revoking first admin should succeed
      await expect(
        assetNFT.connect(admin).revokeRole(DEFAULT_ADMIN_ROLE, admin.address)
      ).to.not.be.reverted;
      expect(await assetNFT.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.false;
      expect(await assetNFT.hasRole(DEFAULT_ADMIN_ROLE, manager.address)).to.be.true;
    });
  });
});
