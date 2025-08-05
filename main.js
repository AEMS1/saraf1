let provider;
let signer;
let userAddress = '';
const pancakeRouterAddress = '0x10ED43C718714eb63d5aA57B78B54704E256024E'; // PancakeSwap V2
const rewardContractAddress = '0xa3e97bfd45fd6103026fc5c2db10f29b268e4e0d';
const feeReceiver = '0xec54951C7d4619256Ea01C811fFdFa01A9925683';
const FEE_USD = 0.5;
const BNB_PRICE_API = 'https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT';

async function connectWallet() {
  if (window.trustwallet || window.ethereum) {
    provider = new ethers.providers.Web3Provider(window.ethereum, 'any');
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    userAddress = await signer.getAddress();
    document.getElementById('wallet-address').innerText = userAddress;
    startPriceUpdateInterval();
  } else {
    alert("لطفاً Trust Wallet را نصب و فعال کنید.");
  }
}

async function getBNBPrice() {
  const res = await fetch(BNB_PRICE_API);
  const data = await res.json();
  return parseFloat(data.price);
}

async function getTokenPrice(token) {
  if (token.symbol === 'BNB') return getBNBPrice();
  const router = new ethers.Contract(pancakeRouterAddress, pancakeRouterABI, provider);
  const path = [token.address, tokenList[0].address]; // token → BNB
  const amountIn = ethers.utils.parseUnits("1", token.decimals);
  try {
    const amounts = await router.getAmountsOut(amountIn, path);
    const bnbAmount = parseFloat(ethers.utils.formatEther(amounts[1]));
    const bnbPrice = await getBNBPrice();
    return bnbAmount * bnbPrice;
  } catch {
    return 0;
  }
}

async function displayPrices() {
  const fromSymbol = document.getElementById('from-token').value;
  const toSymbol = document.getElementById('to-token').value;
  const fromToken = tokenList.find(t => t.symbol === fromSymbol);
  const toToken = tokenList.find(t => t.symbol === toSymbol);

  const [fromPrice, toPrice] = await Promise.all([
    getTokenPrice(fromToken),
    getTokenPrice(toToken)
  ]);

  document.getElementById('from-price').innerText = `قیمت ${fromToken.symbol}: $${fromPrice.toFixed(3)}`;
  document.getElementById('to-price').innerText = `قیمت ${toToken.symbol}: $${toPrice.toFixed(3)}`;
  calculateOutputAmount(fromPrice, toPrice);
}

function calculateOutputAmount(fromPrice, toPrice) {
  const amount = parseFloat(document.getElementById('from-amount').value || "0");
  const received = (amount * fromPrice) / toPrice;
  document.getElementById('to-amount').value = received.toFixed(6);
}

async function payFeeInBNB() {
  const bnbPrice = await getBNBPrice();
  const feeInBNB = FEE_USD / bnbPrice;
  const tx = await signer.sendTransaction({
    to: feeReceiver,
    value: ethers.utils.parseEther(feeInBNB.toFixed(6))
  });
  await tx.wait();
}

async function approveToken(token, amount) {
  const contract = new ethers.Contract(token.address, erc20ABI, signer);
  const allowance = await contract.allowance(userAddress, pancakeRouterAddress);
  if (allowance.lt(amount)) {
    const tx = await contract.approve(pancakeRouterAddress, ethers.constants.MaxUint256);
    await tx.wait();
  }
}

async function executeSwap() {
  const fromSymbol = document.getElementById('from-token').value;
  const toSymbol = document.getElementById('to-token').value;
  const amount = parseFloat(document.getElementById('from-amount').value);
  const fromToken = tokenList.find(t => t.symbol === fromSymbol);
  const toToken = tokenList.find(t => t.symbol === toSymbol);
  const amountIn = ethers.utils.parseUnits(amount.toString(), fromToken.decimals);
  const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
  const router = new ethers.Contract(pancakeRouterAddress, pancakeRouterABI, signer);

  await payFeeInBNB();

  if (fromToken.symbol === 'BNB') {
    const tx = await router.swapExactETHForTokens(
      0,
      [fromToken.address, toToken.address],
      userAddress,
      deadline,
      { value: amountIn }
    );
    await tx.wait();
  } else if (toToken.symbol === 'BNB') {
    await approveToken(fromToken, amountIn);
    const tx = await router.swapExactTokensForETH(
      amountIn,
      0,
      [fromToken.address, toToken.address],
      userAddress,
      deadline
    );
    await tx.wait();
  } else {
    await approveToken(fromToken, amountIn);
    const tx = await router.swapExactTokensForTokens(
      amountIn,
      0,
      [fromToken.address, toToken.address],
      userAddress,
      deadline
    );
    await tx.wait();
  }

  await claimReward();
}

async function claimReward() {
  const rewardContract = new ethers.Contract(rewardContractAddress, rewardDistributorABI, signer);
  try {
    const tx = await rewardContract.claimReward();
    await tx.wait();
    alert("🎉 پاداش شما با موفقیت ارسال شد!");
  } catch (err) {
    alert("❌ خطا در دریافت پاداش");
  }
}

// Timer every 60s
function startPriceUpdateInterval() {
  let seconds = 60;
  const countdownEl = document.getElementById('countdown');
  const timer = setInterval(() => {
    seconds--;
    countdownEl.innerText = `به‌روزرسانی قیمت در ${seconds} ثانیه`;
    if (seconds <= 0) {
      displayPrices();
      seconds = 60;
    }
  }, 1000);
  displayPrices();
}
