import { expect } from "chai";
import { ethers } from "hardhat";
import { IdentityRegistry, AssetNFT } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Security & Attack Demonstration Suite", function () {
  let identityRegistry: IdentityRegistry;
  let assetNFT: AssetNFT;
  let admin: HardhatEthersSigner;
  let engineerA: HardhatEthersSigner;
  let engineerB: HardhatEthersSigner;
  let auditor: HardhatEthersSigner;
  let attacker: HardhatEthersSigner;

  const MANAGER_ROLE       = ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"));
  const AUDITOR_ROLE       = ethers.keccak256(ethers.toUtf8Bytes("AUDITOR_ROLE"));
  const USER_ROLE          = ethers.keccak256(ethers.toUtf8Bytes("USER_ROLE"));
  const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;
  const ZERO_CRED          = ethers.ZeroHash;

  const sampleHash = ethers.keccak256(ethers.toUtf8Bytes("BEL Secure Asset Document"));

  beforeEach(async function () {
    [admin, engineerA, engineerB, auditor, attacker] = await ethers.getSigners();

    const IdFactory = await ethers.getContractFactory("IdentityRegistry");
    identityRegistry = await IdFactory.deploy();
    await identityRegistry.waitForDeployment();

    const AssetFactory = await ethers.getContractFactory("AssetNFT");
    assetNFT = await AssetFactory.deploy(await identityRegistry.getAddress());
    await assetNFT.waitForDeployment();

    // Register legitimate identities
    await identityRegistry.connect(admin).registerIdentity(admin.address, "Admin", ZERO_CRED);
    await identityRegistry.connect(admin).registerIdentity(engineerA.address, "Manager A", ZERO_CRED);
    await identityRegistry.connect(admin).registerIdentity(engineerB.address, "Engineer B", ZERO_CRED);
    await identityRegistry.connect(admin).registerIdentity(auditor.address, "Auditor", ZERO_CRED);

    // Assign roles
    await assetNFT.connect(admin).grantRole(MANAGER_ROLE, engineerA.address);
    await assetNFT.connect(admin).grantRole(USER_ROLE, engineerB.address);
    await assetNFT.connect(admin).grantRole(AUDITOR_ROLE, auditor.address);
  });

  describe("Attack Scenario 1: Unauthorized User (Role Missing)", function () {
    it("Engineer B (active User) attempts to mint an asset -> BLOCKED with NotManager", async function () {
      expect(await identityRegistry.isActive(engineerB.address)).to.be.true;
      expect(await assetNFT.hasRole(MANAGER_ROLE, engineerB.address)).to.be.false;

      await expect(
        assetNFT.connect(engineerB).mintAsset(
          engineerB.address, 2001, "BEL-UNAUTH-01",
          "Illegal Asset", "Unauthorized mint", sampleHash
        )
      ).to.be.revertedWithCustomError(assetNFT, "NotManager");
    });

    it("Engineer B attempts custodyTransfer -> BLOCKED with NotManager", async function () {
      await assetNFT.connect(engineerA).mintAsset(
        engineerB.address, 1047, "BEL-TEST-1047",
        "Secure Defense Asset A-001", "Hardware", sampleHash
      );
      expect(await assetNFT.ownerOf(1047)).to.equal(engineerB.address);

      await expect(
        assetNFT.connect(engineerB).custodyTransfer(attacker.address, 1047)
      ).to.be.revertedWithCustomError(assetNFT, "NotManager");
    });
  });

  describe("Attack Scenario 2: Revoked Manager (Identity Revoked)", function () {
    beforeEach(async function () {
      await assetNFT.connect(engineerA).mintAsset(
        engineerA.address, 1047, "BEL-TEST-1047",
        "Secure Defense Asset A-001", "Hardware", sampleHash
      );
      expect(await assetNFT.ownerOf(1047)).to.equal(engineerA.address);
    });

    it("Revoked Engineer A retains MANAGER_ROLE but is BLOCKED by smart contract", async function () {
      await identityRegistry.connect(admin).revokeIdentity(engineerA.address);
      expect(await identityRegistry.isActive(engineerA.address)).to.be.false;
      // Role record preserved as audit evidence — but execution is blocked
      expect(await assetNFT.hasRole(MANAGER_ROLE, engineerA.address)).to.be.true;

      await expect(
        assetNFT.connect(engineerA).mintAsset(
          engineerA.address, 1048, "BEL-TEST-1048",
          "Second Unit", "Unauthorized mint attempt", sampleHash
        )
      ).to.be.revertedWithCustomError(assetNFT, "IdentityNotActive");

      await expect(
        assetNFT.connect(engineerA).custodyTransfer(engineerB.address, 1047)
      ).to.be.revertedWithCustomError(assetNFT, "IdentityNotActive");
    });

    it("Reactivating Engineer A restores ability to perform manager actions", async function () {
      await identityRegistry.connect(admin).revokeIdentity(engineerA.address);
      await identityRegistry.connect(admin).reactivateIdentity(engineerA.address);
      expect(await identityRegistry.isActive(engineerA.address)).to.be.true;

      await expect(
        assetNFT.connect(engineerA).custodyTransfer(engineerB.address, 1047)
      ).to.emit(assetNFT, "AssetCustodyTransferred");

      expect(await assetNFT.ownerOf(1047)).to.equal(engineerB.address);
    });
  });

  describe("Attack Scenario 3: Auditor Modification Attempts", function () {
    it("Auditor cannot mint assets", async function () {
      expect(await identityRegistry.isActive(auditor.address)).to.be.true;
      expect(await assetNFT.hasRole(AUDITOR_ROLE, auditor.address)).to.be.true;

      await expect(
        assetNFT.connect(auditor).mintAsset(
          auditor.address, 3001, "AUDIT-01",
          "Audit Item", "Attempted mint", sampleHash
        )
      ).to.be.revertedWithCustomError(assetNFT, "NotManager");
    });

    it("Auditor cannot transfer custody", async function () {
      await assetNFT.connect(engineerA).mintAsset(
        engineerA.address, 1047, "BEL-TEST-1047",
        "Secure Defense Asset A-001", "Hardware", sampleHash
      );
      await expect(
        assetNFT.connect(auditor).custodyTransfer(auditor.address, 1047)
      ).to.be.revertedWithCustomError(assetNFT, "NotManager");
    });
  });

  describe("Attack Scenario 4: Privilege Escalation (Self-Promotion)", function () {
    it("Attacker cannot grant themselves MANAGER_ROLE", async function () {
      await expect(
        assetNFT.connect(attacker).grantRole(MANAGER_ROLE, attacker.address)
      ).to.be.revertedWithCustomError(assetNFT, "AccessControlUnauthorizedAccount");
    });

    it("Attacker cannot grant themselves DEFAULT_ADMIN_ROLE", async function () {
      await expect(
        assetNFT.connect(attacker).grantRole(DEFAULT_ADMIN_ROLE, attacker.address)
      ).to.be.revertedWithCustomError(assetNFT, "AccessControlUnauthorizedAccount");
    });

    it("Attacker cannot register themselves in IdentityRegistry", async function () {
      await expect(
        identityRegistry.connect(attacker).registerIdentity(attacker.address, "Hacker", ZERO_CRED)
      ).to.be.revertedWithCustomError(identityRegistry, "NotAdmin");
    });
  });

  describe("Attack Scenario 5: Suspended Asset Operations", function () {
    beforeEach(async function () {
      await assetNFT.connect(engineerA).mintAsset(
        engineerA.address, 1047, "BEL-TEST-1047",
        "Secure Defense Asset A-001", "Hardware", sampleHash
      );
    });

    it("Manager cannot transfer custody of a suspended asset -> BLOCKED", async function () {
      await assetNFT.connect(admin).suspendAsset(1047);
      expect(await assetNFT.getAssetState(1047)).to.equal(6); // SUSPENDED

      await expect(
        assetNFT.connect(engineerA).custodyTransfer(engineerB.address, 1047)
      ).to.be.revertedWithCustomError(assetNFT, "AssetSuspendedOrRevoked");
    });

    it("Admin unsuspends asset and manager can operate again", async function () {
      await assetNFT.connect(admin).suspendAsset(1047);
      await assetNFT.connect(admin).unsuspendAsset(1047);
      await expect(
        assetNFT.connect(engineerA).custodyTransfer(engineerB.address, 1047)
      ).to.emit(assetNFT, "AssetCustodyTransferred");
    });
  });
});
