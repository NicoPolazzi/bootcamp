const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");

describe("Election contract", function () {
  async function deployedElectionFixture() {
    const [owner] = await ethers.getSigners();
    const hardhatElection = await ethers.deployContract("Election");
    return { hardhatElection, owner };
  }

  it("Initialize with two candidates", async function () {
    const { hardhatElection } = await loadFixture(deployedElectionFixture);
    expect(await hardhatElection.candidatesCount()).to.equal(2);
  });

  it("Inizializes candidates with the initial values", async function () {
    const { hardhatElection } = await loadFixture(deployedElectionFixture);
    const { id, name, voteCount } = await hardhatElection.candidates(1);

    expect(id).to.equal(1);
    expect(name).to.equal("Candidate 1");
    expect(voteCount).to.equal(0);

    const {
      id: id2,
      name: name2,
      voteCount: voteCount2,
    } = await hardhatElection.candidates(2);

    expect(id2).to.equal(2);
    expect(name2).to.equal("Candidate 2");
    expect(voteCount2).to.equal(0);
  });

  it("Allows a voter to cast a vote", async function () {
    const { hardhatElection, owner } = await loadFixture(
      deployedElectionFixture
    );
    const candidateId = 1;

    await expect(hardhatElection.vote(candidateId))
      .to.emit(hardhatElection, "votedEvent")
      .withArgs(candidateId);
    const candidate = await hardhatElection.candidates(candidateId);
    expect(await hardhatElection.voters(owner)).to.equal(true);
    expect(candidate.voteCount).to.equal(1);
  });

  it("Throws an exception for invalid candidates", async function () {
    const { hardhatElection } = await loadFixture(deployedElectionFixture);
    const candidateId = 99;

    await expect(
      hardhatElection.vote(candidateId)
    ).to.be.revertedWithoutReason();

    const candidate = await hardhatElection.candidates(candidateId);
    expect(candidate.voteCount).to.equal(0);
  });

  it("Throws an exception for double voting", async function () {
    const { hardhatElection, owner } = await loadFixture(
      deployedElectionFixture
    );
    const candidateId = 2;

    await hardhatElection.vote(candidateId);
    const candidate = await hardhatElection.candidates(candidateId);
    expect(candidate.voteCount).to.equal(1);
    await expect(
      hardhatElection.vote(candidateId)
    ).to.be.revertedWithoutReason();
    expect(candidate.voteCount).to.equal(1);
  });
});
