// ABI مربوط به PancakeSwap Router
const pancakeRouterABI = [
  {
    "name": "getAmountsOut",
    "type": "function",
    "inputs": [
      { "type": "uint256", "name": "amountIn" },
      { "type": "address[]", "name": "path" }
    ],
    "outputs": [
      { "type": "uint256[]", "name": "amounts" }
    ],
    "constant": true,
    "payable": false,
    "stateMutability": "view"
  },
  {
    "name": "swapExactETHForTokens",
    "type": "function",
    "inputs": [
      { "type": "uint256", "name": "amountOutMin" },
      { "type": "address[]", "name": "path" },
      { "type": "address", "name": "to" },
      { "type": "uint256", "name": "deadline" }
    ],
    "outputs": [{ "type": "uint256[]", "name": "amounts" }],
    "payable": true
  },
  {
    "name": "swapExactTokensForETH",
    "type": "function",
    "inputs": [
      { "type": "uint256", "name": "amountIn" },
      { "type": "uint256", "name": "amountOutMin" },
      { "type": "address[]", "name": "path" },
      { "type": "address", "name": "to" },
      { "type": "uint256", "name": "deadline" }
    ],
    "outputs": [{ "type": "uint256[]", "name": "amounts" }]
  },
  {
    "name": "swapExactTokensForTokens",
    "type": "function",
    "inputs": [
      { "type": "uint256", "name": "amountIn" },
      { "type": "uint256", "name": "amountOutMin" },
      { "type": "address[]", "name": "path" },
      { "type": "address", "name": "to" },
      { "type": "uint256", "name": "deadline" }
    ],
    "outputs": [{ "type": "uint256[]", "name": "amounts" }]
  }
];

// ABI مربوط به توکن‌های ERC20
const erc20ABI = [
  {
    "name": "approve",
    "type": "function",
    "inputs": [
      { "type": "address", "name": "spender" },
      { "type": "uint256", "name": "amount" }
    ],
    "outputs": [{ "type": "bool", "name": "" }]
  }
];

// ABI قرارداد پاداش
const rewardDistributorABI = [
  {
    "name": "claimReward",
    "type": "function",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  }
];
