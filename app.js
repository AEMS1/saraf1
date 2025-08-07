let provider;
let signer;
let userAddress;

const connectWalletBtn = document.getElementById("connect-wallet-btn");
const walletAddressDisplay = document.getElementById("wallet-address");
const fromTokenSelect = document.getElementById("from-token-select");
const toTokenSelect = document.getElementById("to-token-select");
const amountInput = document.getElementById("amount-input");
const statusMsg = document.getElementById("status-msg");

const fromPriceSpan = document.getElementById("from-price");
const toPriceSpan = document.getElementById("to-price");
const userReceiveSpan = document.getElementById("user-receive-amount");

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
}

connectWalletBtn.onclick = async () => {
  if (window.ethereum) {
    provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    userAddress = await signer.getAddress();
    walletAddressDisplay.innerText = `آدرس کیف پول: ${userAddress}`;
  } else {
    alert("کیف پول وب3 پیدا نشد. لطفا از متامسک یا تراست ولت استفاده کنید.");
  }
};

amountInput.oninput = async () => {
  const amount = parseFloat(amountInput.value);
  if (!amount || amount <= 0) return;

  const fromToken = fromTokenSelect.value;
  const toToken = toTokenSelect.value;

  const priceData = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd`).then(r => r.json());

  const price = priceData["binancecoin"]?.usd || 0;

  fromPriceSpan.innerText = `$${price}`;
  toPriceSpan.innerText = `$${price}`;

  const onePercent = amount * 0.01;
  const receiveAmount = amount - onePercent;
  userReceiveSpan.innerText = `${receiveAmount.toFixed(6)} (بعد از کسر 1٪)`;
};