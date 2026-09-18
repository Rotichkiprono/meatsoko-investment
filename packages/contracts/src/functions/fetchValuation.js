// This script executes on the Chainlink Decentralized Oracle Network (DON)

const apiUrl = args[0];

if (!secrets.oracleApiKey) {
  throw Error('Missing Oracle API Key in DON Hosted Secrets');
}

// 1. Dispatch the GET request to the NestJS Oracle Controller
const apiRequest = Functions.makeHttpRequest({
  url: apiUrl,
  headers: {
    Authorization: `Bearer ${secrets.oracleApiKey}`,
    'Content-Type': 'application/json',
  },
});

const apiResponse = await apiRequest;

if (apiResponse.error) {
  console.error(apiResponse.error);
  throw Error('API request failed');
}

// 2. Extract the heavily optimized data payload
const { value, checksum } = apiResponse.data;

if (!value) {
  throw Error('Payload is missing the NAV value');
}

console.log(`NAV Fetched: ${value} cents | Checksum: ${checksum}`);

// 3. Serialize to a strictly typed uint256 byte array for EVM decoding
return Functions.encodeUint256(Math.round(value));