// main.js

let web3;
let userAccount;
const routerAddress = "0x10ED43C718714eb63d5aA57B78B54704E256024E"; // PancakeSwap V2
const rewardContractAddress = "0xYourRewardContract";

async function connectWallet() {
  if (window.trustwallet || window.ethereum) {
    web3 = new Web3(window.trustwallet || window.ethereum);
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      userAccount = accounts[0];
      document.getElementById("walletAddress").textContent = userAccount;
    } catch (err) {
      console.error("User denied access", err);
    }
  } else {
    alert("Trust Wallet or compatible wallet not found.");
  }
}

function getTokenAddress(symbol) {
  const token = tokens.find(t => t.symbol === symbol);
  return token ? token.address : null;
}

function reverseTokens() {
  const from = document.getElementById("fromToken");
  const to = document.getElementById("toToken");
  const temp = from.value;
  from.value = to.value;
  to.value = temp;
}

async function updatePrices() {
  const fromSymbol = document.getElementById("fromToken").value;
  const toSymbol = document.getElementById("toToken").value;
  const amount = parseFloat(document.getElementById("amount").value || 1);

  if (!fromSymbol || !toSymbol || !amount || fromSymbol === toSymbol) return;

  const fromAddress = getTokenAddress(fromSymbol);
  const toAddress = getTokenAddress(toSymbol);

  const router = new web3.eth.Contract(pancakeRouterABI, routerAddress);
  const amountIn = web3.utils.toWei(amount.toString(), 'ether');

  try {
    const path = fromAddress === "BNB" || toAddress === "BNB"
      ? [fromAddress === "BNB" ? "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" : fromAddress,
         toAddress === "BNB" ? "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" : toAddress]
      : [fromAddress, "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", toAddress];

    const result = await router.methods.getAmountsOut(amountIn, path).call();
    const received = web3.utils.fromWei(result[result.length - 1]);

    document.getElementById("priceInfo").textContent = `Received Amount: ${received}`;

    // قیمت لحظه‌ای فرضی به دلار (از API در نسخه نهایی بگیر)
    document.getElementById("priceUSDFrom").textContent = `Price (${fromSymbol}) in $: ~${(Math.random() * 10).toFixed(2)}`;
    document.getElementById("priceUSDTo").textContent = `Price (${toSymbol}) in $: ~${(Math.random() * 10).toFixed(2)}`;

  } catch (err) {
    console.error("Error fetching price:", err);
  }
}

let countdown = 60;
function startTimer() {
  setInterval(() => {
    countdown--;
    document.getElementById("countdown").textContent = countdown;
    if (countdown <= 0) {
      updatePrices();
      countdown = 60;
    }
  }, 1000);
}

async function swapTokens() {
  const from = document.getElementById("fromToken").value;
  const to = document.getElementById("toToken").value;
  const amount = document.getElementById("amount").value;
  const fromAddress = getTokenAddress(from);
  const toAddress = getTokenAddress(to);
  const router = new web3.eth.Contract(pancakeRouterABI, routerAddress);
  const deadline = Math.floor(Date.now() / 1000) + 60 * 10;

  const amountIn = web3.utils.toWei(amount.toString(), 'ether');
  const path = [fromAddress, toAddress];

  try {
    document.getElementById("status").textContent = "Paying fee...";

    // Step 1: دریافت کارمزد ثابت $0.50 به BNB فرضی
    await web3.eth.sendTransaction({
      from: userAccount,
      to: "0xYourFeeReceiver", // آدرس دریافت کارمزد
      value: web3.utils.toWei("0.0015", "ether") // حدود 0.50$ بسته به قیمت BNB
    });

    document.getElementById("status").textContent = "Swapping...";

    // Step 2: approve
    if (from !== "BNB") {
      const tokenContract = new web3.eth.Contract(erc20ABI, fromAddress);
      await tokenContract.methods.approve(routerAddress, amountIn).send({ from: userAccount });
    }

    // Step 3: انجام Swap
    if (from === "BNB") {
      await router.methods.swapExactETHForTokens(
        0, path, userAccount, deadline
      ).send({ from: userAccount, value: amountIn });
    } else if (to === "BNB") {
      await router.methods.swapExactTokensForETH(
        amountIn, 0, path, userAccount, deadline
      ).send({ from: userAccount });
    } else {
      await router.methods.swapExactTokensForTokens(
        amountIn, 0, path, userAccount, deadline
      ).send({ from: userAccount });
    }

    document.getElementById("status").textContent = "Distributing reward...";

    // Step 4: پاداش
    const reward = new web3.eth.Contract(rewardDistributorABI, rewardContractAddress);
    await reward.methods.claimReward().send({ from: userAccount });

    document.getElementById("status").textContent = "✅ Swap and reward complete!";
    updatePrices();

  } catch (err) {
    console.error("Swap error:", err);
    document.getElementById("status").textContent = "❌ Error during swap";
  }
}

window.onload = () => {
  const fromSelect = document.getElementById("fromToken");
  const toSelect = document.getElementById("toToken");

  tokens.forEach(token => {
    const opt1 = document.createElement("option");
    opt1.value = token.symbol;
    opt1.text = token.symbol;
    fromSelect.add(opt1);

    const opt2 = document.createElement("option");
    opt2.value = token.symbol;
    opt2.text = token.symbol;
    toSelect.add(opt2);
  });

  fromSelect.value = tokens[0].symbol;
  toSelect.value = tokens[1].symbol;

  updatePrices();
  startTimer();
};
