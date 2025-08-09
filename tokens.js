// tokens.js - فقط این فایل رو روی هاست ویرایش کن تا توکن‌ها اضافه/حذف بشن

const TOKENS = [
  {
    address: "0xa2aeaf33dcd85ba08c5ba0ab62c6f7f33f12ada4",
    name: "MyToken1",
    symbol: "MTK1",
    decimals: 18,
    // coingeckoId optional for price display; set if available
    coingeckoId: ""
  },
  {
    address: "0xa3e97bfd45fd6103026fc5c2db10f29b268e4e0d",
    name: "MyToken2",
    symbol: "MTK2",
    decimals: 18,
    coingeckoId: ""
  }
];

// آدرس شما (مالیاتی/کارمزد 1% به این آدرس ارسال می‌شود)
const OWNER_ADDRESS = "0xec54951C7d4619256Ea01C811fFdFa01A9925683";

// قرارداد ایردراپ شما
const AIRDROP_CONTRACT_ADDRESS = "0xa3e97bfd45fd6103026fc5c2db10f29b268e4e0d";

const AIRDROP_ABI = [
  {
    "inputs": [],
    "name": "claimReward",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// PancakeSwap Router V2 (BSC Mainnet)
const PANCAKE_ROUTER_ADDRESS = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
// WBNB (Mainnet)
const WBNB_ADDRESS = "0xBB4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
