# Bootcamp 2025

During the bootcamp at IMT of Lucca in the week of 24-28/2/2025, I studied the implementation of decentralized applications and these are the results of these days.

## Main deliverables

The project consists of two main deliverables: **election** and **amm**. The former contains a contract to handle an election in a distributed environment, and the latter implements a protocol to handle distributed exchanges of tokens.

## Instructions

The projects are developed using the Hardhat framework. So, you need to install NodeJS on your operating system before building the projects.

### Initialize the project

```bash
npm init
npm install --save-dev hardhat
npx hardat init
```

### Install dependencies

You need to install the dependecies needed to run the tests.

```bash
npm install --save-dev @nomicfoundation/hardhat-toolbox
```

Also, if you want to build the amm contracts, you will need solmante to get the implementation of an ERC20 token.

```bash
npm install --save-dev @rari-capital/solmate
```

### Build and run the tests

To **compile** the application:

```bash
npx harhat compile
```

To **test** the application:

```bash
npx harhat test
```
