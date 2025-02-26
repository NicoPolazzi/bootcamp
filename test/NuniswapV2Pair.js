const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NuniswapV2Pair", function () {
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

    factory = await ethers.deployContract("NuniswapV2Factory");
    await factory.waitForDeployment();
    await factory.createPair(token0Address, token1Address);
    const pairAddress = await factory.pairs(token0Address, token1Address);
    pair = await ethers.getContractAt("NuniswapV2Pair", pairAddress);

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

  it("should swap with basic scenario", async function () {
    // First determine token order in the pair
    const token0Address = await token0.getAddress();
    const token1Address = await token1.getAddress();
    const token0IsPair0 = (await pair.token0()) === token0Address;

    // Initial liquidity provision
    await token0.transfer(await pair.getAddress(), ethers.parseEther("1"));
    await token1.transfer(await pair.getAddress(), ethers.parseEther("2"));
    await pair.mint(owner.address);

    // Calculate amount to receive from swap
    const amountOut = ethers.parseEther("0.181322178776029826");

    // Send token0 to pair for swapping
    await token0.transfer(await pair.getAddress(), ethers.parseEther("0.1"));

    // Execute the swap - need to set amountOut parameters according to token order
    let amount0Out = 0n;
    let amount1Out = amountOut;

    // If tokens are reversed in the pair, swap the output amounts
    if (!token0IsPair0) {
      amount0Out = amountOut;
      amount1Out = 0n;
    }

    await pair.swap(amount0Out, amount1Out, owner.address);

    // Verify token0 balance: initial 10 - 1 (initial liquidity) - 0.1 (swap input)
    expect(await token0.balanceOf(owner.address)).to.equal(
      ethers.parseEther("10") -
        ethers.parseEther("1") -
        ethers.parseEther("0.1")
    );

    // Verify token1 balance: initial 10 - 2 (initial liquidity) + amountOut (swap output)
    expect(await token1.balanceOf(owner.address)).to.equal(
      ethers.parseEther("10") - ethers.parseEther("2") + amountOut
    );

    // Verify reserves are updated correctly
    const reserves = await pair.getReserves();

    if (token0IsPair0) {
      // token0 is pair's token0
      expect(reserves[0]).to.equal(
        ethers.parseEther("1") + ethers.parseEther("0.1")
      );
      expect(reserves[1]).to.equal(ethers.parseEther("2") - amountOut);
    } else {
      // token0 is pair's token1
      expect(reserves[1]).to.equal(
        ethers.parseEther("1") + ethers.parseEther("0.1")
      );
      expect(reserves[0]).to.equal(ethers.parseEther("2") - amountOut);
    }
  });

  it("should swap bidirectionally", async function () {
    // First determine token order in the pair
    const token0Address = await token0.getAddress();
    const token1Address = await token1.getAddress();
    const token0IsPair0 = (await pair.token0()) === token0Address;

    // Initial liquidity provision
    await token0.transfer(await pair.getAddress(), ethers.parseEther("1"));
    await token1.transfer(await pair.getAddress(), ethers.parseEther("2"));
    await pair.mint(owner.address);

    // Send tokens to pair for swapping (both token0 and token1)
    await token0.transfer(await pair.getAddress(), ethers.parseEther("0.1"));
    await token1.transfer(await pair.getAddress(), ethers.parseEther("0.2"));

    // Execute the swap - take out some of both tokens
    // We need to set the amounts based on the token order in the pair
    let amount0Out = ethers.parseEther("0.09");
    let amount1Out = ethers.parseEther("0.18");

    // If tokens are reversed in the pair, swap the output amounts
    if (!token0IsPair0) {
      amount0Out = ethers.parseEther("0.18");
      amount1Out = ethers.parseEther("0.09");
    }

    await pair.swap(amount0Out, amount1Out, owner.address);

    // Verify token0 balance: initial 10 - 1 (initial liquidity) - 0.1 (swap input) + 0.09 (swap output) = 8.99 ETH
    expect(await token0.balanceOf(owner.address)).to.equal(
      ethers.parseEther("10") -
        ethers.parseEther("1") -
        ethers.parseEther("0.1") +
        ethers.parseEther("0.09")
    );

    // Verify token1 balance: initial 10 - 2 (initial liquidity) - 0.2 (swap input) + 0.18 (swap output) = 7.98 ETH
    expect(await token1.balanceOf(owner.address)).to.equal(
      ethers.parseEther("10") -
        ethers.parseEther("2") -
        ethers.parseEther("0.2") +
        ethers.parseEther("0.18")
    );

    // Verify reserves after swap, taking into account token order
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
