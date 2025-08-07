// فقط شما به عنوان مالک می‌تونید این لیست را تغییر بدید
const TOKENS = [
  {
    address: "0xa2aeaf33dcd85ba08c5ba0ab62c6f7f33f12ada4",
    name: "MyToken1",
    symbol: "MTK1",
    decimals: 18,
    coingeckoId: "binancecoin"
  },
  {
    address: "0xa3e97bfd45fd6103026fc5c2db10f29b268e4e0d",
    name: "MyToken2",
    symbol: "MTK2",
    decimals: 18,
    coingeckoId: "binancecoin"
  }
];

const OWNER_ADDRESS = "0xec54951C7d4619256Ea01C811fFdFa01A9925683";
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

const PANCAKE_ROUTER_ADDRESS = "0x10ED43C718714eb63d5aA57B78B54704E256024E";