let web3, userAddress = null;
let router, rewardContract;
let currentNetwork = "bsc";

const ROUTERS = {
  bsc: "0x10ED43C718714eb63d5aA57B78B54704E256024E", // PancakeSwap
  eth: "0x1111111254EEB25477B68fb85Ed929f73A960582"  // 1inch Router ETH
};

const REWARD_CONTRACT = {
  bsc: "0xa3e97bfd45fd6103026fc5c2db10f29b268e4e0d",
  eth: "0xa3e97bfd45fd6103026fc5c2db10f29b268e4e0d"
};

const OWNER_WALLETS = {
  bsc: "0xec54951C7d4619256Ea01C811fFdFa01A9925683",
  eth: "0xec54951C7d4619256Ea01C811fFdFa01A9925683"
};

const WETH = {
  bsc: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", // WBNB
  eth: "0xC02aaA39b223FE8D0A0E5C4F27eAD9083C756Cc2"  // WETH
};

window.addEventListener("load", () => {
  disableUI(true);
  fillTokenOptions();
});

async function connectWallet() {
  if (!window.ethereum) return alert("Metamask نصب نیست.");
  await window.ethereum.request({ method: "eth_requestAccounts" });
  web3 = new Web3(window.ethereum);
  const accounts = await web3.eth.getAccounts();
  userAddress = accounts[0];
  router = new web3.eth.Contract(pancakeRouterABI, ROUTERS[currentNetwork]);
  rewardContract = new web3.eth.Contract(rewardDistributorABI, REWARD_CONTRACT[currentNetwork]);

  document.getElementById("walletAddress").innerText = userAddress;
  document.getElementById("connectButton").innerText = "✅ متصل شد";
  disableUI(false);
  updatePriceInfo();

  ["fromToken", "toToken", "amount"].forEach(id => {
    document.getElementById(id).addEventListener("input", updatePriceInfo);
  });
}

function disableUI(dis) {
  ["fromToken", "toToken", "amount", "swapButton", "reverseButton"]
    .forEach(id => document.getElementById(id).disabled = dis);
}

function changeNetwork() {
  currentNetwork = document.getElementById("networkSelector").value;
  router = new web3.eth.Contract(pancakeRouterABI, ROUTERS[currentNetwork]);
  rewardContract = new web3.eth.Contract(rewardDistributorABI, REWARD_CONTRACT[currentNetwork]);
  fillTokenOptions();
  updatePriceInfo();
}

function fillTokenOptions() {
  const fromSel = document.getElementById("fromToken");
  const toSel = document.getElementById("toToken");
  fromSel.innerHTML = "";
  toSel.innerHTML = "";
  tokens.filter(t => t.network === currentNetwork).forEach(t => {
    fromSel.add(new Option(t.symbol, t.address));
    toSel.add(new Option(t.symbol, t.address));
  });
}

function getSymbol(addr) {
  const t = tokens.find(x => x.address.toLowerCase() === addr.toLowerCase() && x.network === currentNetwork);
  return t ? t.symbol : "";
}

function getSwapPath(from, to) {
  const wrappedFrom = from === "native" ? WETH[currentNetwork] : from;
  const wrappedTo = to === "native" ? WETH[currentNetwork] : to;
  if (wrappedFrom === WETH[currentNetwork] || wrappedTo === WETH[currentNetwork]) {
    return [wrappedFrom, wrappedTo];
  } else {
    return [wrappedFrom, WETH[currentNetwork], wrappedTo];
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
    document.getElementById("priceInfo").innerText =
      `${parseFloat(outAmount).toFixed(6)} ${getSymbol(to)}`;
  } catch (err) {
    document.getElementById("priceInfo").innerText = "❌ خطا";
  }
}

function reverseTokens() {
  const f = document.getElementById("fromToken");
  const t = document.getElementById("toToken");
  [f.value, t.value] = [t.value, f.value];
  updatePriceInfo();
}

async function swapTokens() {
  const from = document.getElementById("fromToken").value;
  const to = document.getElementById("toToken").value;
  const amount = parseFloat(document.getElementById("amount").value);
  if (!userAddress || !amount || from === to) return alert("اطلاعات نادرست است.");

  const inWei = web3.utils.toWei(amount.toString(), "ether");
  const path = getSwapPath(from, to);
  const deadline = Math.floor(Date.now() / 1000) + 600;

  try {
    const fee = (amount * 0.005).toFixed(6); // 0.5%
    const feeWei = web3.utils.toWei(fee, "ether");

    document.getElementById("status").innerText = "📤 ارسال کارمزد...";
    await web3.eth.sendTransaction({
      from: userAddress,
      to: OWNER_WALLETS[currentNetwork],
      value: feeWei
    });

    document.getElementById("status").innerText = "🔄 در حال سواپ...";

    if (from === "native") {
      await router.methods.swapExactETHForTokens(
        0, path, userAddress, deadline
      ).send({ from: userAddress, value: inWei });
    } else if (to === "native") {
      const token = new web3.eth.Contract(erc20ABI, from);
      await token.methods.approve(router.options.address, inWei).send({ from: userAddress });
      await router.methods.swapExactTokensForETH(
        inWei, 0, path, userAddress, deadline
      ).send({ from: userAddress });
    } else {
      const token = new web3.eth.Contract(erc20ABI, from);
      await token.methods.approve(router.options.address, inWei).send({ from: userAddress });
      await router.methods.swapExactTokensForTokens(
        inWei, 0, path, userAddress, deadline
      ).send({ from: userAddress });
    }

    document.getElementById("status").innerText = "🎁 دریافت پاداش...";
    await rewardContract.methods.claimReward().send({ from: userAddress });

    document.getElementById("status").innerText = "✅ موفق! پاداش ارسال شد.";
  } catch (err) {
    console.error("Swap error:", err);
    document.getElementById("status").innerText = "❌ خطا در سواپ یا پاداش!";
  }
}
