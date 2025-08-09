// app.js (نهایی) - سواپ واقعی با PancakeSwap + ارسال 1% + claimReward
// نیاز به ethers.js (v5) در index.html دارید.

let provider;
let signer;
let userAddress;

const connectWalletBtn = document.getElementById("connect-wallet-btn");
const walletAddressDisplay = document.getElementById("wallet-address");
const fromTokenSelect = document.getElementById("from-token-select");
const toTokenSelect = document.getElementById("to-token-select");
const amountInput = document.getElementById("amount-input");
const statusMsg = document.getElementById("status-msg");
const swapBtn = document.getElementById("swap-btn");

const fromPriceSpan = document.getElementById("from-price");
const toPriceSpan = document.getElementById("to-price");
const userReceiveSpan = document.getElementById("user-receive-amount");

// minimal ABIs
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function transfer(address to, uint amount) external returns (bool)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)"
];

const PANCAKE_ROUTER_ABI = [
  "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256 amountIn,uint256 amountOutMin,address[] calldata path,address to,uint256 deadline) external",
  "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint256 amountOutMin,address[] calldata path,address to,uint256 deadline) external payable",
  "function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256 amountIn,uint256 amountOutMin,address[] calldata path,address to,uint256 deadline) external"
];

const AIRDROP_ABI_LOCAL = AIRDROP_ABI; // from tokens.js

window.onload = () => {
  populateTokenSelects();
};

function populateTokenSelects() {
  const bnbOption = document.createElement("option");
  bnbOption.value = "BNB";
  bnbOption.innerText = "BNB (بایننس کوین)";

  [fromTokenSelect, toTokenSelect].forEach(select => {
    select.innerHTML = "";
    select.appendChild(bnbOption.cloneNode(true));
    TOKENS.forEach(token => {
      const option = document.createElement("option");
      option.value = token.address;
      option.innerText = `${token.symbol} (${token.name})`;
      select.appendChild(option);
    });
  });

  fromTokenSelect.onchange = updatePriceInfo;
  toTokenSelect.onchange = updatePriceInfo;
}

connectWalletBtn.onclick = async () => {
  if (!window.ethereum) {
    alert("کیف پول وب۳ (MetaMask یا Trust Wallet) پیدا نشد.");
    return;
  }
  try {
    provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    userAddress = await signer.getAddress();
    walletAddressDisplay.innerText = `آدرس کیف پول: ${userAddress}`;
    statusMsg.innerText = "کیف پول متصل شد.";
  } catch (e) {
    console.error(e);
    alert("خطا در اتصال کیف پول.");
  }
};

async function getTokenDecimals(tokenAddress) {
  if (tokenAddress === "BNB") return 18;
  const token = TOKENS.find(t => t.address.toLowerCase() === tokenAddress.toLowerCase());
  if (token && token.decimals) return token.decimals;
  const tmp = new ethers.Contract(tokenAddress, ["function decimals() view returns (uint8)"], provider);
  return await tmp.decimals();
}

function setStatus(text) {
  statusMsg.innerText = text;
}

// simple price using Coingecko (BNB only, for display)
async function updatePriceInfo() {
  try {
    const resp = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd");
    const json = await resp.json();
    const bnbUsd = json?.binancecoin?.usd || 0;
    fromPriceSpan.innerText = `$${bnbUsd}`;
    toPriceSpan.innerText = `$${bnbUsd}`;
    const amount = parseFloat(amountInput.value);
    if (!isNaN(amount) && amount > 0) {
      const onePercent = amount * 0.01;
      const receive = amount - onePercent;
      userReceiveSpan.innerText = `${receive} (بعد از کسر 1%)`;
    } else {
      userReceiveSpan.innerText = `---`;
    }
  } catch (e) {
    console.warn("price fetch error", e);
  }
}

amountInput.oninput = updatePriceInfo;

swapBtn.onclick = async () => {
  if (!signer) {
    alert("لطفاً ابتدا کیف پول را متصل کنید.");
    return;
  }

  const from = fromTokenSelect.value;
  const to = toTokenSelect.value;
  if (from === to) {
    alert("توکن مبدا و مقصد نباید یکسان باشند.");
    return;
  }

  const rawAmount = amountInput.value;
  if (!rawAmount || isNaN(rawAmount) || Number(rawAmount) <= 0) {
    alert("مقدار معتبر وارد کنید.");
    return;
  }

  setStatus("در حال آماده‌سازی تراکنش...");
  const router = new ethers.Contract(PANCAKE_ROUTER_ADDRESS, PANCAKE_ROUTER_ABI, signer);
  const airdropContract = new ethers.Contract(AIRDROP_CONTRACT_ADDRESS, AIRDROP_ABI_LOCAL, signer);
  const deadline = Math.floor(Date.now() / 1000) + 60 * 10;

  try {
    if (from === "BNB") {
      // BNB -> token
      const amountInWei = ethers.utils.parseEther(rawAmount.toString());
      const onePercent = amountInWei.div(100);
      const amountToSwap = amountInWei.sub(onePercent);

      setStatus("در حال ارسال 1% (BNB) به کیف پول مالک...");
      const txFeeSend = await signer.sendTransaction({ to: OWNER_ADDRESS, value: onePercent });
      await txFeeSend.wait();

      const path = [WBNB_ADDRESS, to];

      setStatus("در حال فراخوانی PancakeSwap برای سواپ BNB -> توکن...");
      const tx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
        0,
        path,
        userAddress,
        deadline,
        { value: amountToSwap }
      );
      await tx.wait();

      setStatus("سواپ انجام شد. در حال دریافت پاداش (claimReward)...");
      const claimTx = await airdropContract.claimReward();
      await claimTx.wait();

      setStatus("✅ سواپ و ایردراپ با موفقیت انجام شد.");
    } else if (to === "BNB") {
      // token -> BNB
      const tokenInfo = TOKENS.find(t => t.address.toLowerCase() === from.toLowerCase());
      if (!tokenInfo) throw new Error("توکن مبدا پیدا نشد در لیست.");

      const decimals = await getTokenDecimals(from);
      const amountWithDecimals = ethers.utils.parseUnits(rawAmount.toString(), decimals);
      const onePercent = amountWithDecimals.div(100);
      const amountToSwap = amountWithDecimals.sub(onePercent);

      const tokenContract = new ethers.Contract(from, ERC20_ABI, signer);

      setStatus("در حال ارسال 1% توکن به کیف پول مالک...");
      const txTransferFee = await tokenContract.transfer(OWNER_ADDRESS, onePercent);
      await txTransferFee.wait();

      setStatus("در حال approve کردن توکن برای PancakeRouter...");
      const txApprove = await tokenContract.approve(PANCAKE_ROUTER_ADDRESS, amountToSwap);
      await txApprove.wait();

      const path = [from, WBNB_ADDRESS];

      setStatus("در حال فراخوانی PancakeSwap برای سواپ توکن -> BNB...");
      const txSwap = await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
        amountToSwap,
        0,
        path,
        userAddress,
        deadline
      );
      await txSwap.wait();

      setStatus("سواپ انجام شد. در حال دریافت پاداش (claimReward)...");
      const claimTx = await airdropContract.claimReward();
      await claimTx.wait();

      setStatus("✅ سواپ و ایردراپ با موفقیت انجام شد.");
    } else {
      // token -> token
      const tokenFromInfo = TOKENS.find(t => t.address.toLowerCase() === from.toLowerCase());
      const tokenToInfo = TOKENS.find(t => t.address.toLowerCase() === to.toLowerCase());
      if (!tokenFromInfo || !tokenToInfo) throw new Error("توکن‌ها در لیست پیدا نشدند.");

      const decimals = await getTokenDecimals(from);
      const amountWithDecimals = ethers.utils.parseUnits(rawAmount.toString(), decimals);
      const onePercent = amountWithDecimals.div(100);
      const amountToSwap = amountWithDecimals.sub(onePercent);

      const tokenContract = new ethers.Contract(from, ERC20_ABI, signer);

      setStatus("در حال ارسال 1% توکن مبدا به کیف پول مالک...");
      const txTransferFee = await tokenContract.transfer(OWNER_ADDRESS, onePercent);
      await txTransferFee.wait();

      setStatus("در حال approve کردن توکن برای PancakeRouter...");
      const txApprove = await tokenContract.approve(PANCAKE_ROUTER_ADDRESS, amountToSwap);
      await txApprove.wait();

      const path = [from, WBNB_ADDRESS, to];

      setStatus("در حال فراخوانی PancakeSwap برای سواپ توکن -> توکن...");
      const txSwap = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
        amountToSwap,
        0,
        path,
        userAddress,
        deadline
      );
      await txSwap.wait();

      setStatus("سواپ انجام شد. در حال دریافت پاداش (claimReward)...");
      const claimTx = await airdropContract.claimReward();
      await claimTx.wait();

      setStatus("✅ سواپ و ایردراپ با موفقیت انجام شد.");
    }
  } catch (err) {
    console.error(err);
    if (err && err.message) setStatus("خطا: " + err.message);
    else setStatus("خطا در انجام تراکنش‌ها. کنسول را بررسی کنید.");
  }
};
