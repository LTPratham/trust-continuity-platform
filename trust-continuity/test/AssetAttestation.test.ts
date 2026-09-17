import { expect } from "chai";
import { ethers } from "hardhat";
import { AssetAttestation } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("AssetAttestation", function () {
  let attestation: AssetAttestation;
  let admin: HardhatEthersSigner;
  let verifier: HardhatEthersSigner;
  let unauthorized: HardhatEthersSigner;

  const VERIFIER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VERIFIER_ROLE"));

  const TOKEN_ID   = 1047;
  const physHash   = ethers.keccak256(ethers.toUtf8Bytes("SN-12345-XYZ"));
  const stateHash  = ethers.keccak256(ethers.toUtf8Bytes("state-record-v1"));
  const physHash2  = ethers.keccak256(ethers.toUtf8Bytes("SN-12345-XYZ-v2"));
  const stateHash2 = ethers.keccak256(ethers.toUtf8Bytes("state-record-v2"));

  beforeEach(async function () {
    [admin, verifier, unauthorized] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("AssetAttestation");
    attestation = await Factory.deploy();
    await attestation.waitForDeployment();

    // Grant VERIFIER_ROLE to verifier (admin already has it from constructor)
    await attestation.connect(admin).grantRole(VERIFIER_ROLE, verifier.address);
  });

  describe("Deployment", function () {
    it("Admin has DEFAULT_ADMIN_ROLE and VERIFIER_ROLE", async function () {
      expect(await attestation.hasRole(ethers.ZeroHash, admin.address)).to.be.true;
      expect(await attestation.hasRole(VERIFIER_ROLE, admin.address)).to.be.true;
    });

    it("Total attestations starts at 0", async function () {
      expect(await attestation.totalAttestations()).to.equal(0);
    });
  });

  describe("Attestation Submission", function () {
    it("Verifier can submit a valid attestation", async function () {
      await expect(
        attestation.connect(verifier).submitAttestation(TOKEN_ID, physHash, stateHash)
      )
        .to.emit(attestation, "AttestationSubmitted")
        .withArgs(TOKEN_ID, 0, physHash, stateHash, verifier.address,
          (v: unknown) => typeof v === "bigint");

      expect(await attestation.totalAttestations()).to.equal(1);
      expect(await attestation.getAttestationCount(TOKEN_ID)).to.equal(1);
    });

    it("Unauthorized account cannot submit attestation", async function () {
      await expect(
        attestation.connect(unauthorized).submitAttestation(TOKEN_ID, physHash, stateHash)
      ).to.be.revertedWithCustomError(attestation, "AccessControlUnauthorizedAccount");
    });

    it("Cannot submit attestation with zero physicalIdentifierHash", async function () {
      await expect(
        attestation.connect(verifier).submitAttestation(TOKEN_ID, ethers.ZeroHash, stateHash)
      ).to.be.revertedWithCustomError(attestation, "InvalidPhysicalHash");
    });

    it("Cannot submit attestation with zero assetStateHash", async function () {
      await expect(
        attestation.connect(verifier).submitAttestation(TOKEN_ID, physHash, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(attestation, "InvalidStateHash");
    });

    it("Multiple attestations per asset are preserved (append-only)", async function () {
      await attestation.connect(verifier).submitAttestation(TOKEN_ID, physHash, stateHash);
      await attestation.connect(verifier).submitAttestation(TOKEN_ID, physHash2, stateHash2);

      expect(await attestation.getAttestationCount(TOKEN_ID)).to.equal(2);
      expect(await attestation.totalAttestations()).to.equal(2);

      const [pHash1, sHash1, by1, , valid1] = await attestation.getAttestation(TOKEN_ID, 0);
      const [pHash2, sHash2, by2, , valid2] = await attestation.getAttestation(TOKEN_ID, 1);

      expect(pHash1).to.equal(physHash);
      expect(pHash2).to.equal(physHash2);
      expect(sHash1).to.equal(stateHash);
      expect(sHash2).to.equal(stateHash2);
      expect(by1).to.equal(verifier.address);
      expect(by2).to.equal(verifier.address);
      expect(valid1).to.be.true;
      expect(valid2).to.be.true;
    });

    it("Attestations for different tokens are independent", async function () {
      await attestation.connect(verifier).submitAttestation(1047, physHash, stateHash);
      await attestation.connect(verifier).submitAttestation(1048, physHash2, stateHash2);

      expect(await attestation.getAttestationCount(1047)).to.equal(1);
      expect(await attestation.getAttestationCount(1048)).to.equal(1);
    });
  });

  describe("Attestation Invalidation", function () {
    beforeEach(async function () {
      await attestation.connect(verifier).submitAttestation(TOKEN_ID, physHash, stateHash);
    });

    it("Admin can invalidate an attestation", async function () {
      await expect(
        attestation.connect(admin).invalidateAttestation(TOKEN_ID, 0)
      ).to.emit(attestation, "AttestationInvalidated")
        .withArgs(TOKEN_ID, 0, admin.address, (v: unknown) => typeof v === "bigint");

      const [, , , , valid] = await attestation.getAttestation(TOKEN_ID, 0);
      expect(valid).to.be.false;
    });

    it("Unauthorized account cannot invalidate attestation", async function () {
      await expect(
        attestation.connect(unauthorized).invalidateAttestation(TOKEN_ID, 0)
      ).to.be.revertedWithCustomError(attestation, "AccessControlUnauthorizedAccount");
    });

    it("Cannot invalidate an already invalidated attestation", async function () {
      await attestation.connect(admin).invalidateAttestation(TOKEN_ID, 0);
      await expect(
        attestation.connect(admin).invalidateAttestation(TOKEN_ID, 0)
      ).to.be.revertedWithCustomError(attestation, "AlreadyInvalidated");
    });

    it("Index out of bounds reverts", async function () {
      await expect(
        attestation.connect(admin).invalidateAttestation(TOKEN_ID, 99)
      ).to.be.revertedWithCustomError(attestation, "AttestationIndexOutOfBounds");
    });
  });

  describe("Latest Valid Attestation", function () {
    it("Returns false when no attestation exists", async function () {
      const [found] = await attestation.getLatestValidAttestation(9999);
      expect(found).to.be.false;
    });

    it("Returns latest valid attestation", async function () {
      await attestation.connect(verifier).submitAttestation(TOKEN_ID, physHash, stateHash);
      await attestation.connect(verifier).submitAttestation(TOKEN_ID, physHash2, stateHash2);

      const [found, ph, sh] = await attestation.getLatestValidAttestation(TOKEN_ID);
      expect(found).to.be.true;
      expect(ph).to.equal(physHash2);
      expect(sh).to.equal(stateHash2);
    });

    it("Skips invalidated and returns last valid", async function () {
      await attestation.connect(verifier).submitAttestation(TOKEN_ID, physHash, stateHash);
      await attestation.connect(verifier).submitAttestation(TOKEN_ID, physHash2, stateHash2);
      await attestation.connect(admin).invalidateAttestation(TOKEN_ID, 1); // invalidate latest

      const [found, ph] = await attestation.getLatestValidAttestation(TOKEN_ID);
      expect(found).to.be.true;
      expect(ph).to.equal(physHash); // falls back to first
    });
  });

  describe("hasValidAttestation", function () {
    it("Returns true for matching valid attestation", async function () {
      await attestation.connect(verifier).submitAttestation(TOKEN_ID, physHash, stateHash);
      expect(
        await attestation.hasValidAttestation(TOKEN_ID, physHash, stateHash)
      ).to.be.true;
    });

    it("Returns false for mismatched hashes", async function () {
      await attestation.connect(verifier).submitAttestation(TOKEN_ID, physHash, stateHash);
      expect(
        await attestation.hasValidAttestation(TOKEN_ID, physHash2, stateHash)
      ).to.be.false;
    });

    it("Returns false after invalidation", async function () {
      await attestation.connect(verifier).submitAttestation(TOKEN_ID, physHash, stateHash);
      await attestation.connect(admin).invalidateAttestation(TOKEN_ID, 0);
      expect(
        await attestation.hasValidAttestation(TOKEN_ID, physHash, stateHash)
      ).to.be.false;
    });
  });
});
