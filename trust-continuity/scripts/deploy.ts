import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("==================================================");
  console.log("SIH26125 — Trust Continuity Platform Deployment");
  console.log("Organization: Bharat Electronics Limited (BEL)");
  console.log("Architecture: Trust Continuity Engine");
  console.log("==================================================\n");

  const signers = await ethers.getSigners();
  const admin        = signers[0];
  const engineerA    = signers[1];
  const engineerB    = signers[2];
  const auditor      = signers[3];
  const unauthorized = signers[4];

  console.log("Configured Demo Accounts:");
  console.log(`- Account 0 [ADMIN]:          ${admin.address}`);
  console.log(`- Account 1 [MANAGER]:        ${engineerA.address} (Engineer A)`);
  console.log(`- Account 2 [USER]:           ${engineerB.address} (Engineer B)`);
  console.log(`- Account 3 [AUDITOR]:        ${auditor.address}`);
  console.log(`- Account 4 [UNAUTHORIZED]:   ${unauthorized.address}\n`);

  // 1. Deploy IdentityRegistry
  console.log("Deploying IdentityRegistry...");
  const IdFactory = await ethers.getContractFactory("IdentityRegistry", admin);
  const identityRegistry = await IdFactory.deploy();
  await identityRegistry.waitForDeployment();
  const identityRegistryAddress = await identityRegistry.getAddress();
  console.log(`✓ IdentityRegistry deployed at: ${identityRegistryAddress}`);

  // 2. Deploy AssetNFT
  console.log("Deploying AssetNFT...");
  const AssetFactory = await ethers.getContractFactory("AssetNFT", admin);
  const assetNFT = await AssetFactory.deploy(identityRegistryAddress);
  await assetNFT.waitForDeployment();
  const assetNFTAddress = await assetNFT.getAddress();
  console.log(`✓ AssetNFT deployed at: ${assetNFTAddress}`);

  // 3. Deploy AssetAttestation
  console.log("Deploying AssetAttestation...");
  const AttestFactory = await ethers.getContractFactory("AssetAttestation", admin);
  const assetAttestation = await AttestFactory.deploy();
  await assetAttestation.waitForDeployment();
  const assetAttestationAddress = await assetAttestation.getAddress();
  console.log(`✓ AssetAttestation deployed at: ${assetAttestationAddress}`);

  // 4. Deploy TransferLifecycle
  console.log("Deploying TransferLifecycle...");
  const LifecycleFactory = await ethers.getContractFactory("TransferLifecycle", admin);
  const transferLifecycle = await LifecycleFactory.deploy(assetNFTAddress, identityRegistryAddress);
  await transferLifecycle.waitForDeployment();
  const transferLifecycleAddress = await transferLifecycle.getAddress();
  console.log(`✓ TransferLifecycle deployed at: ${transferLifecycleAddress}\n`);

  // 5. Link TransferLifecycle to AssetNFT
  console.log("Linking TransferLifecycle contract to AssetNFT...");
  await (await assetNFT.connect(admin).setLifecycleContract(transferLifecycleAddress)).wait();
  console.log(`  ✓ AssetNFT.lifecycleContract = TransferLifecycle\n`);

  // 6. Register Identities
  console.log("Registering Identities on-chain (label + credentialHash)...");
  const ZERO_CRED = ethers.ZeroHash;
  const adminCredHash    = ethers.keccak256(ethers.toUtf8Bytes("SIH26125-ADMIN-CREDENTIAL-REF"));
  const managerCredHash  = ethers.keccak256(ethers.toUtf8Bytes("SIH26125-MANAGER-CREDENTIAL-REF"));
  const userCredHash     = ethers.keccak256(ethers.toUtf8Bytes("SIH26125-USER-CREDENTIAL-REF"));
  const auditorCredHash  = ethers.keccak256(ethers.toUtf8Bytes("SIH26125-AUDITOR-CREDENTIAL-REF"));

  await (await identityRegistry.connect(admin).registerIdentity(admin.address, "Platform Administrator", adminCredHash)).wait();
  console.log(`  ✓ Registered Admin: ${admin.address}`);

  await (await identityRegistry.connect(admin).registerIdentity(engineerA.address, "Authorized Manager (Engineer A)", managerCredHash)).wait();
  console.log(`  ✓ Registered Engineer A (Manager): ${engineerA.address}`);

  await (await identityRegistry.connect(admin).registerIdentity(engineerB.address, "Asset Custodian (Engineer B)", userCredHash)).wait();
  console.log(`  ✓ Registered Engineer B (User): ${engineerB.address}`);

  await (await identityRegistry.connect(admin).registerIdentity(auditor.address, "Independent Auditor", auditorCredHash)).wait();
  console.log(`  ✓ Registered Auditor: ${auditor.address}`);
  console.log("  * Account 4 left unregistered for Unauthorized Attack Demo\n");

  // 7. Grant Roles
  console.log("Configuring Role-Based Access Control in AssetNFT...");
  const MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"));
  const AUDITOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("AUDITOR_ROLE"));
  const USER_ROLE    = ethers.keccak256(ethers.toUtf8Bytes("USER_ROLE"));
  const VERIFIER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VERIFIER_ROLE"));

  await (await assetNFT.connect(admin).grantRole(MANAGER_ROLE, engineerA.address)).wait();
  console.log(`  ✓ Granted MANAGER_ROLE to Engineer A`);

  await (await assetNFT.connect(admin).grantRole(USER_ROLE, engineerB.address)).wait();
  console.log(`  ✓ Granted USER_ROLE to Engineer B`);

  await (await assetNFT.connect(admin).grantRole(AUDITOR_ROLE, auditor.address)).wait();
  console.log(`  ✓ Granted AUDITOR_ROLE to Auditor`);

  // Grant VERIFIER_ROLE to manager in AssetAttestation
  await (await assetAttestation.connect(admin).grantRole(VERIFIER_ROLE, engineerA.address)).wait();
  console.log(`  ✓ Granted VERIFIER_ROLE to Engineer A in AssetAttestation\n`);

  // 8. Mint initial demo asset
  console.log("Minting initial governed demo asset (SEC-ASSET-A001)...");
  const docHash = ethers.keccak256(ethers.toUtf8Bytes("SIH26125 Prototype — Secure Defense Asset Technical Specification v1.0"));
  await (
    await assetNFT.connect(engineerA).mintAsset(
      engineerA.address,
      1047,
      "SEC-ASSET-A001",
      "Secure Defense Asset A-001",
      "Prototype governed asset for SIH26125 Trust Continuity Platform demonstration",
      docHash
    )
  ).wait();
  console.log(`  ✓ Asset SEC-ASSET-A001 minted by Engineer A. Initial Custodian: Engineer A`);

  // 9. Submit initial attestation
  console.log("Submitting initial physical-digital attestation...");
  const physIdHash  = ethers.keccak256(ethers.toUtf8Bytes("ASSET-SERIAL-SIH26125-001-DEMO"));
  const stateHash   = ethers.keccak256(ethers.toUtf8Bytes("STATE:REGISTERED|CUSTODIAN:ENGINEER_A|TIMESTAMP:DEPLOY"));
  await (await assetAttestation.connect(engineerA).submitAttestation(1047, physIdHash, stateHash)).wait();
  console.log(`  ✓ Initial attestation recorded for Token #1047\n`);

  // 10. Export deployment artifact
  const deployments = {
    network: "localhost",
    chainId: 31337,
    contracts: {
      IdentityRegistry: {
        address: identityRegistryAddress,
        abi: JSON.parse(fs.readFileSync(
          path.join(__dirname, "../artifacts/contracts/IdentityRegistry.sol/IdentityRegistry.json"), "utf-8"
        )).abi,
      },
      AssetNFT: {
        address: assetNFTAddress,
        abi: JSON.parse(fs.readFileSync(
          path.join(__dirname, "../artifacts/contracts/AssetNFT.sol/AssetNFT.json"), "utf-8"
        )).abi,
      },
      AssetAttestation: {
        address: assetAttestationAddress,
        abi: JSON.parse(fs.readFileSync(
          path.join(__dirname, "../artifacts/contracts/AssetAttestation.sol/AssetAttestation.json"), "utf-8"
        )).abi,
      },
      TransferLifecycle: {
        address: transferLifecycleAddress,
        abi: JSON.parse(fs.readFileSync(
          path.join(__dirname, "../artifacts/contracts/TransferLifecycle.sol/TransferLifecycle.json"), "utf-8"
        )).abi,
      },
    },
    demoAccounts: [
      {
        index: 0, label: "Administrator", role: "ADMIN",
        address: admin.address,
        privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        description: "Manages organizational identities, governance roles, and platform configuration",
      },
      {
        index: 1, label: "Engineer A", role: "MANAGER",
        address: engineerA.address,
        privateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
        description: "Authorized to mint assets, attest physical binding, and perform governed custody transfers",
      },
      {
        index: 2, label: "Engineer B", role: "USER",
        address: engineerB.address,
        privateKey: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
        description: "Asset custodian/recipient — cannot perform manager-level operations",
      },
      {
        index: 3, label: "Auditor", role: "AUDITOR",
        address: auditor.address,
        privateKey: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
        description: "Independent verifier with view-only audit access",
      },
      {
        index: 4, label: "Unauthorized User", role: "NONE",
        address: unauthorized.address,
        privateKey: "0x47e179ec197488593b100287e941669c56a0fbf09444d151e7063074b873cd82",
        description: "Unregistered external entity used for security attack demonstrations",
      },
    ],
  };

  const outPath = path.join(__dirname, "../deployments.json");
  fs.writeFileSync(outPath, JSON.stringify(deployments, null, 2));
  console.log(`✓ Deployment information saved to: ${outPath}`);

  const frontendLibDir = path.join(__dirname, "../frontend/lib");
  if (!fs.existsSync(frontendLibDir)) fs.mkdirSync(frontendLibDir, { recursive: true });
  fs.writeFileSync(path.join(frontendLibDir, "deployments.json"), JSON.stringify(deployments, null, 2));
  console.log(`✓ Deployment information mirrored to frontend\n`);

  console.log("==================================================");
  console.log("Deployment and Demo Initialization Complete!");
  console.log(`  IdentityRegistry:  ${identityRegistryAddress}`);
  console.log(`  AssetNFT:          ${assetNFTAddress}`);
  console.log(`  AssetAttestation:  ${assetAttestationAddress}`);
  console.log(`  TransferLifecycle: ${transferLifecycleAddress}`);
  console.log("==================================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
