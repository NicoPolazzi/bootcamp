const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Factory", function () {
  let factory;
  let token0;
  let token1;
  let owner;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();

    token0 = await ethers.deployContract("ERC20Mintable", ["Token A", "TKNA"]);
    token1 = await ethers.deployContract("ERC20Mintable", ["Token B", "TKNB"]);

    await token0.waitForDeployment();
    await token1.waitForDeployment();

    factory = await ethers.deployContract("Factory");
    await factory.waitForDeployment();
  });

  it("should create a pair correctly", async function () {
    const token0Address = await token0.getAddress();
    const token1Address = await token1.getAddress();

    const tx = await factory.createPair(token1Address, token0Address);
    await tx.wait();

    const pairAddress = await factory.pairs(token0Address, token1Address);
    const pair = await ethers.getContractAt("Pair", pairAddress);

    expect(await pair.token0()).to.equal(
      token0Address < token1Address ? token0Address : token1Address
    );
    expect(await pair.token1()).to.equal(
      token0Address < token1Address ? token1Address : token0Address
    );
  });
});
