const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NuniswapV2Factory", function () {
  let factory;
  let token0;
  let token1;
  let owner;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();

    // Deploy test tokens
    token0 = await ethers.deployContract("ERC20Mintable", ["Token A", "TKNA"]);
    token1 = await ethers.deployContract("ERC20Mintable", ["Token B", "TKNB"]);

    await token0.waitForDeployment();
    await token1.waitForDeployment();

    // Deploy factory
    factory = await ethers.deployContract("NuniswapV2Factory");
    await factory.waitForDeployment();
  });

  it("should create a pair correctly", async function () {
    const token0Address = await token0.getAddress();
    const token1Address = await token1.getAddress();

    // Create the pair
    const tx = await factory.createPair(token1Address, token0Address);
    await tx.wait();

    // Get the created pair address
    const pairAddress = await factory.pairs(token0Address, token1Address);

    // Create contract instance for the pair
    const pair = await ethers.getContractAt("NuniswapV2Pair", pairAddress);

    // Test that the tokens are sorted correctly (smaller address is token0)
    expect(await pair.token0()).to.equal(
      token0Address < token1Address ? token0Address : token1Address
    );
    expect(await pair.token1()).to.equal(
      token0Address < token1Address ? token1Address : token0Address
    );
  });
});
