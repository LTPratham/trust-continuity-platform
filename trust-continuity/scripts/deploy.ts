import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("==================================================");
  console.log("SIH26125 — Trust Continuity Platform Deployment");
  console.log("Organization: Bharat Electronics Limited (BEL)");
  console.log("==================================================\n");

  const signers = await ethers.getSigners();
  const admin = signers[0];
  const engineerA = signers[1];
  const engineerB = signers[2];
  const auditor = signers[3];
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
  console.log(`✓ AssetNFT deployed at: ${assetNFTAddress}\n`);

  // 3. Register Identities in IdentityRegistry
  console.log("Registering Identities on-chain...");
  await (await identityRegistry.connect(admin).registerIdentity(admin.address)).wait();
  console.log(`  ✓ Registered Admin: ${admin.address}`);

  await (await identityRegistry.connect(admin).registerIdentity(engineerA.address)).wait();
  console.log(`  ✓ Registered Engineer A (Manager): ${engineerA.address}`);

  await (await identityRegistry.connect(admin).registerIdentity(engineerB.address)).wait();
  console.log(`  ✓ Registered Engineer B (User): ${engineerB.address}`);

  await (await identityRegistry.connect(admin).registerIdentity(auditor.address)).wait();
  console.log(`  ✓ Registered Auditor: ${auditor.address}`);
  console.log("  * Account 4 left unregistered for Unauthorized Attack Demo\n");

  // 4. Grant Roles in AssetNFT
  console.log("Configuring Role-Based Access Control in AssetNFT...");
  const MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"));
  const AUDITOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("AUDITOR_ROLE"));
  const USER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("USER_ROLE"));

  await (await assetNFT.connect(admin).grantRole(MANAGER_ROLE, engineerA.address)).wait();
  console.log(`  ✓ Granted MANAGER_ROLE to Engineer A`);

  await (await assetNFT.connect(admin).grantRole(USER_ROLE, engineerB.address)).wait();
  console.log(`  ✓ Granted USER_ROLE to Engineer B`);

  await (await assetNFT.connect(admin).grantRole(AUDITOR_ROLE, auditor.address)).wait();
  console.log(`  ✓ Granted AUDITOR_ROLE to Auditor\n`);

  // 5. Mint initial demo asset
  console.log("Minting initial governed demo asset (BEL-TEST-1047)...");
  const docHash = ethers.keccak256(ethers.toUtf8Bytes("BEL Radar Technical Specification v1.0"));
  await (
    await assetNFT.connect(engineerA).mintAsset(
      engineerA.address,
      1047,
      "BEL-TEST-1047",
      "Tactical Radar Transceiver Module",
      "High-frequency radar subsystem for aerospace test bench",
      docHash
    )
  ).wait();
  console.log(`  ✓ Asset BEL-TEST-1047 minted by Engineer A. Initial Custodian: Engineer A\n`);

  // 6. Export deployment artifact for frontend
  const deployments = {
    network: "localhost",
    chainId: 31337,
    contracts: {
      IdentityRegistry: {
        address: identityRegistryAddress,
        abi: JSON.parse(
          fs.readFileSync(
            path.join(__dirname, "../artifacts/contracts/IdentityRegistry.sol/IdentityRegistry.json"),
            "utf-8"
          )
        ).abi,
      },
      AssetNFT: {
        address: assetNFTAddress,
        abi: JSON.parse(
          fs.readFileSync(
            path.join(__dirname, "../artifacts/contracts/AssetNFT.sol/AssetNFT.json"),
            "utf-8"
          )
        ).abi,
      },
    },
    demoAccounts: [
      {
        index: 0,
        label: "Administrator",
        role: "ADMIN",
        address: admin.address,
        privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        description: "Manages organizational identities and governance roles",
      },
      {
        index: 1,
        label: "Engineer A",
        role: "MANAGER",
        address: engineerA.address,
        privateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
        description: "Authorized to mint assets and perform governance custody transfers",
      },
      {
        index: 2,
        label: "Engineer B",
        role: "USER",
        address: engineerB.address,
        privateKey: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
        description: "Asset custodian / recipient; cannot perform manager actions",
      },
      {
        index: 3,
        label: "Auditor",
        role: "AUDITOR",
        address: auditor.address,
        privateKey: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
        description: "Independent verifier; view-only audit log access",
      },
      {
        index: 4,
        label: "Unauthorized User",
        role: "NONE",
        address: unauthorized.address,
        privateKey: "0x47e179ec197488593b100287e941669c56a0fbf09444d151e7063074b873cd82",
        description: "Unregistered external entity used for security attack demonstrations",
      },
    ],
  };

  // Save to trust-continuity root
  const outPath = path.join(__dirname, "../deployments.json");
  fs.writeFileSync(outPath, JSON.stringify(deployments, null, 2));
  console.log(`✓ Deployment information saved to: ${outPath}`);

  // Also save to frontend directory if it exists
  const frontendLibDir = path.join(__dirname, "../frontend/lib");
  if (!fs.existsSync(frontendLibDir)) {
    fs.mkdirSync(frontendLibDir, { recursive: true });
  }
  fs.writeFileSync(path.join(frontendLibDir, "deployments.json"), JSON.stringify(deployments, null, 2));
  console.log(`✓ Deployment information mirrored to: ${path.join(frontendLibDir, "deployments.json")}\n`);

  console.log("==================================================");
  console.log("Deployment and Demo Initialization Complete!");
  console.log("==================================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
