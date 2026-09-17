import { expect } from "chai";
import { ethers } from "hardhat";
import { IdentityRegistry } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("IdentityRegistry", function () {
  let identityRegistry: IdentityRegistry;
  let admin: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;

  beforeEach(async function () {
    [admin, user1, user2] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("IdentityRegistry");
    identityRegistry = await Factory.deploy();
    await identityRegistry.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the deployer as admin", async function () {
      expect(await identityRegistry.admin()).to.equal(admin.address);
    });

    it("Should start with 0 active and revoked identities", async function () {
      expect(await identityRegistry.activeCount()).to.equal(0);
      expect(await identityRegistry.revokedCount()).to.equal(0);
      expect(await identityRegistry.totalRegistered()).to.equal(0);
    });
  });

  describe("Registration", function () {
    it("Admin can register identity and it becomes active", async function () {
      await expect(identityRegistry.connect(admin).registerIdentity(user1.address))
        .to.emit(identityRegistry, "IdentityRegistered");

      expect(await identityRegistry.isRegistered(user1.address)).to.be.true;
      expect(await identityRegistry.isActive(user1.address)).to.be.true;
      expect(await identityRegistry.activeCount()).to.equal(1);
      expect(await identityRegistry.totalRegistered()).to.equal(1);
    });

    it("Non-admin cannot register identity", async function () {
      await expect(
        identityRegistry.connect(user1).registerIdentity(user2.address)
      ).to.be.revertedWithCustomError(identityRegistry, "NotAdmin");
    });

    it("Cannot register the zero address", async function () {
      await expect(
        identityRegistry.connect(admin).registerIdentity(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(identityRegistry, "ZeroAddress");
    });

    it("Cannot register an already registered identity", async function () {
      await identityRegistry.connect(admin).registerIdentity(user1.address);
      await expect(
        identityRegistry.connect(admin).registerIdentity(user1.address)
      ).to.be.revertedWithCustomError(identityRegistry, "AlreadyRegistered");
    });
  });

  describe("Revocation", function () {
    beforeEach(async function () {
      await identityRegistry.connect(admin).registerIdentity(user1.address);
    });

    it("Admin can revoke identity and it becomes inactive", async function () {
      await expect(identityRegistry.connect(admin).revokeIdentity(user1.address))
        .to.emit(identityRegistry, "IdentityRevoked");

      expect(await identityRegistry.isRegistered(user1.address)).to.be.true;
      expect(await identityRegistry.isActive(user1.address)).to.be.false;
      expect(await identityRegistry.activeCount()).to.equal(0);
      expect(await identityRegistry.revokedCount()).to.equal(1);
    });

    it("Non-admin cannot revoke identity", async function () {
      await expect(
        identityRegistry.connect(user2).revokeIdentity(user1.address)
      ).to.be.revertedWithCustomError(identityRegistry, "NotAdmin");
    });

    it("Cannot revoke an unregistered address", async function () {
      await expect(
        identityRegistry.connect(admin).revokeIdentity(user2.address)
      ).to.be.revertedWithCustomError(identityRegistry, "NotRegistered");
    });

    it("Cannot revoke an already revoked identity", async function () {
      await identityRegistry.connect(admin).revokeIdentity(user1.address);
      await expect(
        identityRegistry.connect(admin).revokeIdentity(user1.address)
      ).to.be.revertedWithCustomError(identityRegistry, "AlreadyInactive");
    });

    it("Admin cannot revoke themselves (last-admin safety)", async function () {
      await identityRegistry.connect(admin).registerIdentity(admin.address);
      await expect(
        identityRegistry.connect(admin).revokeIdentity(admin.address)
      ).to.be.revertedWithCustomError(identityRegistry, "CannotRevokeSelf");
    });
  });

  describe("Reactivation", function () {
    beforeEach(async function () {
      await identityRegistry.connect(admin).registerIdentity(user1.address);
      await identityRegistry.connect(admin).revokeIdentity(user1.address);
    });

    it("Admin can reactivate a revoked identity", async function () {
      await expect(identityRegistry.connect(admin).reactivateIdentity(user1.address))
        .to.emit(identityRegistry, "IdentityReactivated");

      expect(await identityRegistry.isActive(user1.address)).to.be.true;
      expect(await identityRegistry.activeCount()).to.equal(1);
      expect(await identityRegistry.revokedCount()).to.equal(0);
    });

    it("Non-admin cannot reactivate identity", async function () {
      await expect(
        identityRegistry.connect(user2).reactivateIdentity(user1.address)
      ).to.be.revertedWithCustomError(identityRegistry, "NotAdmin");
    });

    it("Cannot reactivate an already active identity", async function () {
      await identityRegistry.connect(admin).reactivateIdentity(user1.address);
      await expect(
        identityRegistry.connect(admin).reactivateIdentity(user1.address)
      ).to.be.revertedWithCustomError(identityRegistry, "AlreadyActive");
    });
  });
});
