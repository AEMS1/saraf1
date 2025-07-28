let web3, userAddress = null;

const networks = [
  {
    chainId: "0x38", // BSC Mainnet
    chainName: "BNB Smart Chain",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrls: ["https://bsc-dataseed.binance.org/"],
    blockExplorerUrls: ["https://bscscan.com"]
  },
  {
    chainId: "0x1", // Ethereum Mainnet
    chainName: "Ethereum",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://rpc.ankr.com/eth"],
    blockExplorerUrls: ["https://etherscan.io"]
  }
];

const WBNB = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c";
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

const routerAddresses = {
  "0x38": "0x10ED43C718714eb63d5aA57B78B54704E256024E", // PancakeSwap
  "0x1": "0x1111111254EEB25477B68fb85Ed929f73A960582"  // 1inch Router V5
};

const ownerWallets = {
  "0x38": "0xec54951C7d4619256Ea01C811fFdFa01A9925683", // BNB Owner
  "0x1":  "0xec54951C7d4619256Ea01C811fFdFa01A9925683"  // ETH Owner
};

const rewardContractAddress = "0xa3e97bfd45fd6103026fc5c2db10f29b268e4e0d";
let rewardContract;

window.addEventListener("load", () => {
  disableUI(true);
  document.getElementById("connectButton").addEventListener("click", connectWallet);
  document.getElementById("networkSelect").addEventListener("change", e => changeNetwork(e.target.value));
});

async function connectWallet() {
  if (!window.ethereum) return alert("🦊 لطفاً MetaMask را نصب کنید.");
  await window.ethereum.request({ method: "eth_requestAccounts" });
  web3 = new Web3(window.ethereum);
  const accounts = await web3.eth.getAccounts();
  userAddress = accounts[0];
  document.getElementById("walletAddress").innerText = userAddress;
  document.getElementById("connectButton").innerText = "متصل شد";
  await changeNetwork(window.ethereum.networkVersion);
}

async function changeNetwork(chainId) {
  const net = networks.find(n => n.chainId === chainId || n.chainId === `0x${parseInt(chainId).toString(16)}`);
  if (!net) return alert("🔴 شبکه پشتیبانی نمی‌شود");

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: net.chainId }]
    });
  } catch (err) {
    if (err.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [net]
      });
    }
  }

  web3 = new Web3(window.ethereum);
  userAddress = (await web3.eth.getAccounts())[0];
  rewardContract = new web3.eth.Contract(rewardDistributorABI, rewardContractAddress);

  fillTokenOptions();
  disableUI(false);
  updatePriceInfo();

  ["fromToken", "toToken", "amount"].forEach(id =>
    document.getElementById(id).addEventListener("input", updatePriceInfo)
  );
}

function disableUI(disabled) {
  ["fromToken", "toToken", "amount", "swapButton", "reverseButton"]
    .forEach(id => document.getElementById(id).disabled = disabled);
}

function fillTokenOptions() {
  const selFrom = document.getElementById("fromToken");
  const selTo = document.getElementById("toToken");
  selFrom.innerHTML = "";
  selTo.innerHTML = "";
  tokens.forEach(t => {
    selFrom.add(new Option(t.symbol, t.address));
    selTo.add(new Option(t.symbol, t.address));
  });
}

function getSymbol(address) {
  const t = tokens.find(x => x.address.toLowerCase() === address.toLowerCase());
  return t ? t.symbol : "";
}

function reverseTokens() {
  const from = document.getElementById("fromToken");
  const to = document.getElementById("toToken");
  [from.value, to.value] = [to.value, from.value];
  updatePriceInfo();
}

function getSwapPath(from, to, chainId) {
  const wrap = chainId === "0x38" ? WBNB : WETH;
  const a = from.toLowerCase() === "native" ? wrap : from;
  const b = to.toLowerCase() === "native" ? wrap : to;
  return a === wrap || b === wrap ? [a, b] : [a, wrap, b];
}

async function updatePriceInfo() {
  const from = document.getElementById("fromToken").value;
  const to = document.getElementById("toToken").value;
  const amount = parseFloat(document.getElementById("amount").value);
  const chainId = await web3.eth.getChainId();
  const hexChain = `0x${chainId.toString(16)}`;

  if (!from || !to || from === to || !amount) {
    document.getElementById("priceInfo").innerText = "-";
    return;
  }

  try {
    const router = new web3.eth.Contract(pancakeRouterABI, routerAddresses[hexChain]);
    const inWei = web3.utils.toWei(amount.toString(), "ether");
    const path = getSwapPath(from, to, hexChain);
    const amounts = await router.methods.getAmountsOut(inWei, path).call();
    const out = web3.utils.fromWei(amounts[amounts.length - 1], "ether");
    document.getElementById("priceInfo").innerText = `دریافتی: ${parseFloat(out).toFixed(6)} ${getSymbol(to)}`;
  } catch (e) {
    console.warn("❌ خطا در دریافت قیمت:", e.message);
    document.getElementById("priceInfo").innerText = "❌ خطا در قیمت";
  }
}

async function swapTokens() {
  const from = document.getElementById("fromToken").value;
  const to = document.getElementById("toToken").value;
  const amount = parseFloat(document.getElementById("amount").value);
  const chainId = await web3.eth.getChainId();
  const hexChain = `0x${chainId.toString(16)}`;
  const router = new web3.eth.Contract(pancakeRouterABI, routerAddresses[hexChain]);
  const path = getSwapPath(from, to, hexChain);
  const inWei = web3.utils.toWei(amount.toString(), "ether");
  const deadline = Math.floor(Date.now() / 1000) + 600;
  const fee = (amount * 0.005).toFixed(6);
  const feeWei = web3.utils.toWei(fee, "ether");

  try {
    document.getElementById("status").innerText = "💸 در حال انجام تراکنش...";

    // کارمزد به کیف پول مدیریت
    await web3.eth.sendTransaction({
      from: userAddress,
      to: ownerWallets[hexChain],
      value: feeWei
    });

    if (from.toLowerCase() === "native") {
      await router.methods.swapExactETHForTokens(
        0, path, userAddress, deadline
      ).send({ from: userAddress, value: inWei });

    } else if (to.toLowerCase() === "native") {
      const token = new web3.eth.Contract(erc20ABI, from);
      await token.methods.approve(routerAddresses[hexChain], inWei).send({ from: userAddress });
      await router.methods.swapExactTokensForETH(
        inWei, 0, path, userAddress, deadline
      ).send({ from: userAddress });

    } else {
      const token = new web3.eth.Contract(erc20ABI, from);
      await token.methods.approve(routerAddresses[hexChain], inWei).send({ from: userAddress });
      await router.methods.swapExactTokensForTokens(
        inWei, 0, path, userAddress, deadline
      ).send({ from: userAddress });
    }

    // پاداش
    await rewardContract.methods.claimReward().send({ from: userAddress });
    document.getElementById("status").innerText = "✅ تراکنش موفق + پاداش دریافت شد!";
  } catch (err) {
    console.error("Swap error:", err);
    document.getElementById("status").innerText = "❌ خطا در تراکنش یا پاداش!";
  }
}
