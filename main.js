let web3, router, userAddress = null;
const BNB_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E"; // PancakeSwap
const ETH_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"; // Uniswap V2
const ownerBNB = "0xec54951C7d4619256Ea01C811fFdFa01A9925683";
const ownerETH = "0xec54951C7d4619256Ea01C811fFdFa01A9925683";
const rewardContractAddress = "0xa3e97bfd45fd6103026fc5c2db10f29b268e4e0d";
const WBNB = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c";
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

let rewardContract;

window.addEventListener("load", () => disableUI(true));

async function connectWallet() {
  if (!window.ethereum) return alert("Please install MetaMask.");
  await window.ethereum.request({ method: "eth_requestAccounts" });
  web3 = new Web3(window.ethereum);
  const accounts = await web3.eth.getAccounts();
  userAddress = accounts[0];

  const chainId = await web3.eth.getChainId();
  router = new web3.eth.Contract(pancakeRouterABI, chainId === 56 ? BNB_ROUTER : ETH_ROUTER);
  rewardContract = new web3.eth.Contract(rewardDistributorABI, rewardContractAddress);

  document.getElementById("walletAddress").innerText = userAddress;
  document.getElementById("connectButton").innerText = "🔌 Connected";
  fillTokenOptions();
  disableUI(false);
  updatePriceInfo();
  ["fromToken", "toToken", "amount"].forEach(id =>
    document.getElementById(id).addEventListener("input", updatePriceInfo)
  );
}

function disableUI(dis) {
  ["fromToken", "toToken", "amount", "swapButton", "reverseButton"]
    .forEach(id => document.getElementById(id).disabled = dis);
}

function fillTokenOptions() {
  ["fromToken", "toToken"].forEach(id => {
    const sel = document.getElementById(id);
    sel.innerHTML = "";
    tokens.forEach(t => sel.add(new Option(t.symbol, t.address)));
  });
}

function getSymbol(addr) {
  const t = tokens.find(x => x.address.toLowerCase() === addr.toLowerCase());
  return t ? t.symbol : "";
}

function getWrappedAddress(address) {
  const chainId = parseInt(window.ethereum.chainId, 16);
  const isBNB = address.toLowerCase() === "bnb";
  const isETH = address.toLowerCase() === "eth";
  if (chainId === 56) return isBNB ? WBNB : address;
  if (chainId === 1) return isETH ? WETH : address;
  return address;
}

function getSwapPath(from, to) {
  const wrappedFrom = getWrappedAddress(from);
  const wrappedTo = getWrappedAddress(to);
  if (wrappedFrom === wrappedTo) return [wrappedFrom];
  if (wrappedFrom === WBNB || wrappedTo === WBNB || wrappedFrom === WETH || wrappedTo === WETH) {
    return [wrappedFrom, wrappedTo];
  } else {
    return [wrappedFrom, wrappedFrom.includes("WBNB") ? WBNB : WETH, wrappedTo];
  }
}

async function updatePriceInfo() {
  const from = document.getElementById("fromToken").value;
  const to = document.getElementById("toToken").value;
  const amount = parseFloat(document.getElementById("amount").value);
  if (!amount || from === to) {
    document.getElementById("priceInfo").innerText = "-";
    return;
  }
  try {
    const inWei = web3.utils.toWei(amount.toString(), "ether");
    const path = getSwapPath(from, to);
    const amounts = await router.methods.getAmountsOut(inWei, path).call();
    const outAmount = web3.utils.fromWei(amounts[amounts.length - 1], "ether");
    document.getElementById("priceInfo").innerText = `${parseFloat(outAmount).toFixed(6)} ${getSymbol(to)}`;
  } catch (err) {
    console.warn("Price error:", err.message);
    document.getElementById("priceInfo").innerText = "❌";
  }
}

function reverseTokens() {
  const f = document.getElementById("fromToken");
  const t = document.getElementById("toToken");
  [f.value, t.value] = [t.value, f.value];
  updatePriceInfo();
}

async function swapTokens() {
  if (!userAddress) return alert("Wallet not connected.");
  const from = document.getElementById("fromToken").value;
  const to = document.getElementById("toToken").value;
  const amount = parseFloat(document.getElementById("amount").value);
  if (!amount || from === to) return alert("Invalid token or amount.");

  const inWei = web3.utils.toWei(amount.toString(), "ether");
  const chainId = await web3.eth.getChainId();
  const path = getSwapPath(from, to);
  const wrappedFrom = getWrappedAddress(from);
  const deadline = Math.floor(Date.now() / 1000) + 600;
  const owner = chainId === 56 ? ownerBNB : ownerETH;

  try {
    document.getElementById("status").innerText = "💰 Paying fee...";
    const fee = (amount * 0.005).toFixed(6);
    const feeWei = web3.utils.toWei(fee, "ether");

    if (from.toLowerCase() === "bnb" || from.toLowerCase() === "eth") {
      await web3.eth.sendTransaction({ from: userAddress, to: owner, value: feeWei });
    } else {
      const token = new web3.eth.Contract(erc20ABI, from);
      await token.methods.transfer(owner, feeWei).send({ from: userAddress });
    }

    document.getElementById("status").innerText = "✅ Fee paid. Swapping...";

    if (from.toLowerCase() === "bnb" || from.toLowerCase() === "eth") {
      const swapValue = web3.utils.toWei((amount - amount * 0.005).toString(), "ether");
      await router.methods.swapExactETHForTokens(0, path, userAddress, deadline)
        .send({ from: userAddress, value: swapValue });

    } else if (to.toLowerCase() === "bnb" || to.toLowerCase() === "eth") {
      const token = new web3.eth.Contract(erc20ABI, from);
      await token.methods.approve(router.options.address, inWei).send({ from: userAddress });
      await router.methods.swapExactTokensForETH(inWei, 0, path, userAddress, deadline)
        .send({ from: userAddress });

    } else {
      const token = new web3.eth.Contract(erc20ABI, from);
      await token.methods.approve(router.options.address, inWei).send({ from: userAddress });
      await router.methods.swapExactTokensForTokens(inWei, 0, path, userAddress, deadline)
        .send({ from: userAddress });
    }

    document.getElementById("status").innerText = "🎉 Swap successful. Sending reward...";
    await rewardContract.methods.claimReward().send({ from: userAddress });
    document.getElementById("status").innerText = "🎁 Reward sent!";

  } catch (err) {
    console.error("Swap error:", err.message);
    document.getElementById("status").innerText = "❌ Error during swap.";
  }
}
