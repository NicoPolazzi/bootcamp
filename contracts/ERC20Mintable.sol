// SPDX-License-Identifier: Unlicense
// Mock contract only used for testing
pragma solidity ^0.8.10;

import "@rari-capital/solmate/src/tokens/ERC20.sol";

contract ERC20Mintable is ERC20 {
    constructor(
        string memory name_,
        string memory symbol_
    ) ERC20(name_, symbol_, 18) {}

    function mint(uint256 amount, address to) public {
        _mint(to, amount);
    }
}
