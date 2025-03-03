const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Pair", function () {
  let token0;
  let token1;
  let factory;
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
    const token0Address = await token0.getAddress();
    const token1Address = await token1.getAddress();

    factory = await ethers.deployContract("Factory");
    await factory.waitForDeployment();
    await factory.createPair(token0Address, token1Address);
    const pairAddress = await factory.pairs(token0Address, token1Address);
    pair = await ethers.getContractAt("Pair", pairAddress);

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

  it("should revert when burning liquidity with zero totalSupply", async function () {
    await expect(pair.burn(owner.address)).to.be.revertedWithPanic("0x12");
  });

  it("should revert when a user with zero liquidity attempts to burn", async function () {
    await token0.transfer(await pair.getAddress(), ethers.parseEther("1"));
    await token1.transfer(await pair.getAddress(), ethers.parseEther("1"));
    await pair.mint(owner.address);

    const [, nonLP] = await ethers.getSigners();
    await expect(
      pair.connect(nonLP).burn(owner.address)
    ).to.be.revertedWithCustomError(pair, "InsufficientLiquidityBurned");
  });

  it("should swap with basic scenario", async function () {
    const token0Address = await token0.getAddress();
    const token1Address = await token1.getAddress();
    const token0IsPair0 = (await pair.token0()) === token0Address;

    await token0.transfer(await pair.getAddress(), ethers.parseEther("1"));
    await token1.transfer(await pair.getAddress(), ethers.parseEther("2"));
    await pair.mint(owner.address);

    const amountOut = ethers.parseEther("0.181322178776029826");

    await token0.transfer(await pair.getAddress(), ethers.parseEther("0.1"));

    let amount0Out = 0n;
    let amount1Out = amountOut;

    if (!token0IsPair0) {
      amount0Out = amountOut;
      amount1Out = 0n;
    }

    await pair.swap(amount0Out, amount1Out, owner.address);

    expect(await token0.balanceOf(owner.address)).to.equal(
      ethers.parseEther("10") -
        ethers.parseEther("1") -
        ethers.parseEther("0.1")
    );

    expect(await token1.balanceOf(owner.address)).to.equal(
      ethers.parseEther("10") - ethers.parseEther("2") + amountOut
    );

    const reserves = await pair.getReserves();

    if (token0IsPair0) {
      expect(reserves[0]).to.equal(
        ethers.parseEther("1") + ethers.parseEther("0.1")
      );
      expect(reserves[1]).to.equal(ethers.parseEther("2") - amountOut);
    } else {
      expect(reserves[1]).to.equal(
        ethers.parseEther("1") + ethers.parseEther("0.1")
      );
      expect(reserves[0]).to.equal(ethers.parseEther("2") - amountOut);
    }
  });

  it("should swap bidirectionally", async function () {
    const token0Address = await token0.getAddress();
    const token1Address = await token1.getAddress();
    const token0IsPair0 = (await pair.token0()) === token0Address;

    await token0.transfer(await pair.getAddress(), ethers.parseEther("1"));
    await token1.transfer(await pair.getAddress(), ethers.parseEther("2"));
    await pair.mint(owner.address);

    await token0.transfer(await pair.getAddress(), ethers.parseEther("0.1"));
    await token1.transfer(await pair.getAddress(), ethers.parseEther("0.2"));

    let amount0Out = ethers.parseEther("0.09");
    let amount1Out = ethers.parseEther("0.18");

    if (!token0IsPair0) {
      amount0Out = ethers.parseEther("0.18");
      amount1Out = ethers.parseEther("0.09");
    }

    await pair.swap(amount0Out, amount1Out, owner.address);

    expect(await token0.balanceOf(owner.address)).to.equal(
      ethers.parseEther("10") -
        ethers.parseEther("1") -
        ethers.parseEther("0.1") +
        ethers.parseEther("0.09")
    );

    expect(await token1.balanceOf(owner.address)).to.equal(
      ethers.parseEther("10") -
        ethers.parseEther("2") -
        ethers.parseEther("0.2") +
        ethers.parseEther("0.18")
    );

    if (token0IsPair0) {
      await assertReserves(
        ethers.parseEther("1") +
          ethers.parseEther("0.1") -
          ethers.parseEther("0.09"),
        ethers.parseEther("2") +
          ethers.parseEther("0.2") -
          ethers.parseEther("0.18")
      );
    } else {
      await assertReserves(
        ethers.parseEther("2") +
          ethers.parseEther("0.2") -
          ethers.parseEther("0.18"),
        ethers.parseEther("1") +
          ethers.parseEther("0.1") -
          ethers.parseEther("0.09")
      );
    }
  });
});
