// app.js — نسخه عملیاتی (BNB↔Token, Token↔BNB, Token↔Token)
// نیاز به ethers v5 (در index.html از CDN لود شده باشد)

let provider, signer, userAddress;

// از tokens.js انتظار می‌رود متغیرهای زیر موجود باشند:
// TOKENS (آرایه توکن‌ها)، OWNER_ADDRESS، AIRDROP_CONTRACT_ADDRESS، AIRDROP_ABI، PANCAKE_ROUTER_ADDRESS، WBNB_ADDRESS

// UI
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

// ABIs (حداقل مورد نیاز)
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function transfer(address to, uint amount) external returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

const PANCAKE_ROUTER_ABI = [
  "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256 amountIn,uint256 amountOutMin,address[] calldata path,address to,uint256 deadline) external",
  "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint256 amountOutMin,address[] calldata path,address to,uint256 deadline) external payable",
  "function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256 amountIn,uint256 amountOutMin,address[] calldata path,address to,uint256 deadline) external"
];

window.onload = () => {
  populateTokenSelects();
  amountInput.oninput = updatePriceAndEstimate;
  fromTokenSelect.onchange = updatePriceAndEstimate;
  toTokenSelect.onchange = updatePriceAndEstimate;
};

// پر کردن select ها (اضافه کردن گزینه BNB و سپس توکن‌ها)
function populateTokenSelects() {
  const bnbOption = document.createElement("option");
  bnbOption.value = "BNB";
  bnbOption.innerText = "BNB (بایننس کوین)";

  [fromTokenSelect, toTokenSelect].forEach(select => {
    select.innerHTML = "";
    select.appendChild(bnbOption.cloneNode(true));
    TOKENS.forEach(token => {
      const opt = document.createElement("option");
      opt.value = token.address;
      opt.innerText = `${token.symbol} (${token.name})`;
      select.appendChild(opt);
    });
  });
}

// اتصال کیف‌پول
connectWalletBtn.onclick = async () => {
  if (!window.ethereum) {
    alert("لطفاً MetaMask یا کیف پول وب3 نصب کن.");
    return;
  }
  try {
    provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    userAddress = await signer.getAddress();
    walletAddressDisplay.innerText = `آدرس کیف پول: ${userAddress}`;
    setStatus("کیف پول متصل شد.");
  } catch (e) {
    console.error(e);
    setStatus("خطا در اتصال کیف پول.");
  }
};

function setStatus(t) {
  if (statusMsg) statusMsg.innerText = t;
}

// helper برای گرفتن decimals
async function getDecimals(tokenAddress) {
  if (tokenAddress === "BNB") return 18;
  const token = TOKENS.find(t => t.address.toLowerCase() === tokenAddress.toLowerCase());
  if (token && token.decimals !== undefined) return token.decimals;
  const c = new ethers.Contract(tokenAddress, ["function decimals() view returns (uint8)"], provider);
  return await c.decimals();
}

// محاسبه قیمت تقریبی (در این نسخه از Coingecko BNB برای نمایش استفاده می‌کنیم)
// می‌توان بعداً هر توکن را بر اساس coinGeckoId گرفت.
async function updatePriceAndEstimate() {
  try {
    const resp = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd");
    const json = await resp.json();
    const bnbUsd = json?.binancecoin?.usd || 0;
    fromPriceSpan.innerText = `$${bnbUsd}`;
    toPriceSpan.innerText = `$${bnbUsd}`;

    const amt = parseFloat(amountInput.value);
    if (!isNaN(amt) && amt > 0) {
      const onePercent = amt * 0.01;
      const receive = amt - onePercent;
      userReceiveSpan.innerText = `${receive} (بعد از کسر 1%)`;
    } else {
      userReceiveSpan.innerText = `---`;
    }
  } catch (e) {
    console.warn("price fetch error", e);
  }
}

// بررسی و اجرای سواپ
swapBtn.onclick = async () => {
  if (!signer) {
    alert("ابتدا کیف پول را متصل کنید.");
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

  const router = new ethers.Contract(PANCAKE_ROUTER_ADDRESS, PANCAKE_ROUTER_ABI, signer);
  const airdrop = new ethers.Contract(AIRDROP_CONTRACT_ADDRESS, AIRDROP_ABI, signer);
  const deadline = Math.floor(Date.now() / 1000) + 60 * 10; // 10 دقیقه

  try {
    // حالت 1: BNB -> token
    if (from === "BNB") {
      setStatus("آماده‌سازی: BNB → توکن ...");
      const amountInWei = ethers.utils.parseEther(rawAmount.toString()); // BNB decimal 18
      const fee = amountInWei.div(100); // 1%
      const amountToSwap = amountInWei.sub(fee);

      // ارسال 1% به OWNER
      setStatus("ارسال 1% (BNB) به آدرس صاحب...");
      const feeTx = await signer.sendTransaction({ to: OWNER_ADDRESS, value: fee });
      setStatus(`منتظر تایید تراکنش فیس... (${feeTx.hash})`);
      await feeTx.wait();

      // مسیر: WBNB -> tokenTo
      const path = [WBNB_ADDRESS, to];

      setStatus("ارسال تراکنش سواپ (BNB -> توکن) به PancakeSwap...");
      const tx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
        0, // amountOutMin = 0 (ریسک اسلیپیج)
        path,
        userAddress,
        deadline,
        { value: amountToSwap }
      );
      setStatus(`سواپ ارسال شد. هش: ${tx.hash}`);
      await tx.wait();

      setStatus("در حال اجرا claimReward() ...");
      const claimTx = await airdrop.claimReward();
      setStatus(`claim ارسال شد. هش: ${claimTx.hash}`);
      await claimTx.wait();

      setStatus("✅ عملیات موفقیت‌آمیز بود.");

    // حالت 2: token -> BNB
    } else if (to === "BNB") {
      setStatus("آماده‌سازی: توکن → BNB ...");

      const decimals = await getDecimals(from);
      const amountWithDecimals = ethers.utils.parseUnits(rawAmount.toString(), decimals);
      const fee = amountWithDecimals.div(100);
      const amountToSwap = amountWithDecimals.sub(fee);

      const tokenContract = new ethers.Contract(from, ERC20_ABI, signer);

      // ارسال 1% توکن به OWNER
      setStatus("ارسال 1% توکن به آدرس صاحب...");
      const transferFeeTx = await tokenContract.transfer(OWNER_ADDRESS, fee);
      setStatus(`در حال تایید انتقال فیس... (${transferFeeTx.hash})`);
      await transferFeeTx.wait();

      // بررسی allowance و در صورت نیاز approve
      const allowance = await tokenContract.allowance(userAddress, PANCAKE_ROUTER_ADDRESS);
      if (allowance.lt(amountToSwap)) {
        setStatus("ارسال approve برای Router...");
        const approveTx = await tokenContract.approve(PANCAKE_ROUTER_ADDRESS, amountToSwap);
        setStatus(`approve ارسال شد. هش: ${approveTx.hash}`);
        await approveTx.wait();
      }

      // مسیر: token -> WBNB
      const path = [from, WBNB_ADDRESS];

      setStatus("ارسال تراکنش سواپ (توکن -> BNB) به PancakeSwap...");
      const swapTx = await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
        amountToSwap,
        0,
        path,
        userAddress,
        deadline
      );
      setStatus(`سواپ ارسال شد. هش: ${swapTx.hash}`);
      await swapTx.wait();

      setStatus("در حال اجرا claimReward() ...");
      const claimTx2 = await airdrop.claimReward();
      setStatus(`claim ارسال شد. هش: ${claimTx2.hash}`);
      await claimTx2.wait();

      setStatus("✅ عملیات موفقیت‌آمیز بود.");

    // حالت 3: token -> token
    } else {
      setStatus("آماده‌سازی: توکن → توکن ...");

      // چک توکن‌های موجود
      const fromTokenInfo = TOKENS.find(t => t.address.toLowerCase() === from.toLowerCase());
      const toTokenInfo = TOKENS.find(t => t.address.toLowerCase() === to.toLowerCase());
      if (!fromTokenInfo || !toTokenInfo) throw new Error("توکن‌ها در لیست پیدا نشدند.");

      const decimals = await getDecimals(from);
      const amountWithDecimals = ethers.utils.parseUnits(rawAmount.toString(), decimals);
      const fee = amountWithDecimals.div(100);
      const amountToSwap = amountWithDecimals.sub(fee);

      const tokenContract = new ethers.Contract(from, ERC20_ABI, signer);

      // ارسال 1% توکن به OWNER
      setStatus("ارسال 1% توکن مبدا به آدرس صاحب...");
      const transferFeeTx = await tokenContract.transfer(OWNER_ADDRESS, fee);
      setStatus(`در حال تایید انتقال فیس... (${transferFeeTx.hash})`);
      await transferFeeTx.wait();

      // approve در صورت نیاز
      const allowance = await tokenContract.allowance(userAddress, PANCAKE_ROUTER_ADDRESS);
      if (allowance.lt(amountToSwap)) {
        setStatus("ارسال approve برای Router...");
        const approveTx = await tokenContract.approve(PANCAKE_ROUTER_ADDRESS, amountToSwap);
        setStatus(`approve ارسال شد. هش: ${approveTx.hash}`);
        await approveTx.wait();
      }

      // مسیر: from -> WBNB -> to
      const path = [from, WBNB_ADDRESS, to];

      setStatus("ارسال تراکنش سواپ (توکن -> توکن) به PancakeSwap...");
      const swapTx = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
        amountToSwap,
        0,
        path,
        userAddress,
        deadline
      );
      setStatus(`سواپ ارسال شد. هش: ${swapTx.hash}`);
      await swapTx.wait();

      setStatus("در حال اجرا claimReward() ...");
      const claimTx3 = await airdrop.claimReward();
      setStatus(`claim ارسال شد. هش: ${claimTx3.hash}`);
      await claimTx3.wait();

      setStatus("✅ عملیات موفقیت‌آمیز بود.");
    }
  } catch (err) {
    console.error(err);
    const msg = err && err.message ? err.message : "خطا در انجام تراکنش";
    setStatus("❌ خطا: " + msg);
  }
};
