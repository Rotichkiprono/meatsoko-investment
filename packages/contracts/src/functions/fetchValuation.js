// This script executes on the Chainlink Runtime Environment (CRE)
const url = "https://meatsoko-api-304669623874.us-central1.run.app/api/v1/oracle/valuation";

// Access secrets via the new CRE.secrets global interface
const apiKey = CRE.secrets.get('oracleApiKey');

if (!apiKey) {
  throw new Error('Missing Oracle API Key in CRE Hosted Secrets');
}

// 1. Dispatch the GET request using the natively supported fetch API
const response = await fetch(url, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
});

if (!response.ok) {
  throw new Error(`API request failed with status: ${response.status}`);
}

const data = await response.json();
const { value, checksum } = data;

if (value === undefined || value === null) {
  throw new Error('Payload is missing the NAV value');
}

console.log(`NAV Fetched: ${value} cents | Checksum: ${checksum}`);

// 3. Serialize to a strictly typed uint256 byte array for EVM decoding
return CRE.AbiCoder.encode(['uint256'], [Math.round(value)]);