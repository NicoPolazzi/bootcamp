const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NuniswapV2Pair", function () {
  let token0;
  let token1;
  let pair;
  let owner;

  async function assertReserves(expectedReserve0, expectedReserve1) {
    const [reserve0, reserve1] = await pair.getReserves();
    expect(reserve0).to.equal(expectedReserve0);
    expect(reserve1).to.equal(expectedReserve1);
  }

  beforeEach(async function () {
    [owner] = await ethers.getSigners();

    token0 = await ethers.deployContract("ERC20Mintable", ["Token A", "TKNA"]);
    token1 = await ethers.deployContract("ERC20Mintable", ["Token B", "TKNB"]);

    await token0.waitForDeployment();
    await token1.waitForDeployment();

    // console.log("Token0 address:", await token0.getAddress());
    // console.log("Token1 address:", await token1.getAddress());

    pair = await ethers.deployContract("NuniswapV2Pair", [
      await token0.getAddress(),
      await token1.getAddress(),
    ]);
    await pair.waitForDeployment();
    // console.log("Pair address:", await pair.getAddress());

    await token0.mint(ethers.parseEther("10"), owner.address);
    await token1.mint(ethers.parseEther("10"), owner.address);
  });

  it("bootstrap initial liquidity", async function () {
    await token0.transfer(await pair.getAddress(), ethers.parseEther("1"));
    await token1.transfer(await pair.getAddress(), ethers.parseEther("1"));

    await pair.mint(owner.address);

    expect(await pair.balanceOf(owner.address)).to.equal(
      ethers.parseEther("1") - 1000n
    );
    await assertReserves(ethers.parseEther("1"), ethers.parseEther("1"));
    expect(await pair.totalSupply()).to.equal(ethers.parseEther("1"));
  });

  it("should mint when there is liquidity", async function () {
    await token0.transfer(await pair.getAddress(), ethers.parseEther("1"));
    await token1.transfer(await pair.getAddress(), ethers.parseEther("1"));

    await pair.mint(owner.address);

    await token0.transfer(await pair.getAddress(), ethers.parseEther("2"));
    await token1.transfer(await pair.getAddress(), ethers.parseEther("2"));

    await pair.mint(owner.address);

    expect(await pair.balanceOf(owner.address)).to.equal(
      ethers.parseEther("3") - 1000n
    );
    expect(await pair.totalSupply()).to.equal(ethers.parseEther("3"));
    await assertReserves(ethers.parseEther("3"), ethers.parseEther("3"));
  });

  it("mint when there is unbalanced liquidity", async function () {
    // Initial balanced deposit of 1 ether each
    await token0.transfer(await pair.getAddress(), ethers.parseEther("1"));
    await token1.transfer(await pair.getAddress(), ethers.parseEther("1"));

    await pair.mint(owner.address);

    expect(await pair.balanceOf(owner.address)).to.equal(
      ethers.parseEther("1") - 1000n
    );
    await assertReserves(ethers.parseEther("1"), ethers.parseEther("1"));

    await token0.transfer(await pair.getAddress(), ethers.parseEther("2"));
    await token1.transfer(await pair.getAddress(), ethers.parseEther("1"));

    await pair.mint(owner.address);

    expect(await pair.balanceOf(owner.address)).to.equal(
      ethers.parseEther("2") - 1000n
    );
    await assertReserves(ethers.parseEther("3"), ethers.parseEther("2"));
  });

  it("should burn liquidity", async function () {
    await token0.transfer(await pair.getAddress(), ethers.parseEther("1"));
    await token1.transfer(await pair.getAddress(), ethers.parseEther("1"));

    await pair.mint(owner.address);
    const liquidity = await pair.balanceOf(owner.address);
    await pair.transfer(await pair.getAddress(), liquidity);
    await pair.burn(owner.address);

    expect(await pair.balanceOf(owner.address)).to.equal(0n);

    await assertReserves(1000n, 1000n);

    expect(await pair.totalSupply()).to.equal(1000n);
    expect(await token0.balanceOf(owner.address)).to.equal(
      ethers.parseEther("10") - 1000n
    );
    expect(await token1.balanceOf(owner.address)).to.equal(
      ethers.parseEther("10") - 1000n
    );
  });

  it("should burn unbalanced liquidity", async function () {
    // First deposit: balanced liquidity of 1 ether each
    await token0.transfer(await pair.getAddress(), ethers.parseEther("1"));
    await token1.transfer(await pair.getAddress(), ethers.parseEther("1"));

    // Mint LP tokens for the first deposit
    await pair.mint(owner.address);

    // Second deposit: unbalanced liquidity (2 ether for token0, 1 ether for token1)
    await token0.transfer(await pair.getAddress(), ethers.parseEther("2"));
    await token1.transfer(await pair.getAddress(), ethers.parseEther("1"));

    // Mint LP tokens for the second deposit
    await pair.mint(owner.address);

    // Retrieve total LP tokens held by the owner and transfer them to the pair contract
    const liquidity = await pair.balanceOf(owner.address);
    await pair.transfer(await pair.getAddress(), liquidity);

    // Burn the liquidity tokens to withdraw underlying tokens
    await pair.burn(owner.address);

    // Owner should have 0 LP tokens after burning
    expect(await pair.balanceOf(owner.address)).to.equal(0n);

    // Expected reserves after burn: 1500 for token0 and 1000 for token1 (in raw units)
    await assertReserves(1500n, 1000n);

    // Total supply should be the locked MINIMUM_LIQUIDITY, 1000
    expect(await pair.totalSupply()).to.equal(1000n);

    // Owner's token balances should be initial 10 ether minus the amounts withdrawn
    expect(await token0.balanceOf(owner.address)).to.equal(
      ethers.parseEther("10") - 1500n
    );
    expect(await token1.balanceOf(owner.address)).to.equal(
      ethers.parseEther("10") - 1000n
    );
  });

  it("should revert when burning liquidity with zero totalSupply", async function () {
    // When totalSupply is 0, calling burn should revert with a Panic error (0x12).
    await expect(pair.burn(owner.address)).to.be.revertedWithPanic("0x12");
  });

  it("should revert when a user with zero liquidity attempts to burn", async function () {
    // Transfer tokens to pair from owner and mint liquidity tokens for owner
    await token0.transfer(await pair.getAddress(), ethers.parseEther("1"));
    await token1.transfer(await pair.getAddress(), ethers.parseEther("1"));
    await pair.mint(owner.address);

    // Now, using a different signer (simulating address 0xdeadbeef), attempt to burn
    // Note: using a test signer who did not provide liquidity
    const [, nonLP] = await ethers.getSigners();
    await expect(
      pair.connect(nonLP).burn(owner.address)
    ).to.be.revertedWithCustomError(pair, "InsufficientLiquidityBurned");
  });
});
