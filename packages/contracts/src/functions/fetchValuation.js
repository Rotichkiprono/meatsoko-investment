// fetchValuation.js
const url = "https://meatsoko-api-304669623874.us-central1.run.app/api/v1/oracle/valuation";

if (!secrets.oracleApiKey) {
  throw Error('Missing Oracle API Key in DON Hosted Secrets');
}

// 1. Dispatch the GET request to the NestJS Oracle Controller
const apiRequest = Functions.makeHttpRequest({
  url: url, // <-- Changed from apiUrl to url
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

const { value, checksum } = apiResponse.data;

if (!value) {
  throw Error('Payload is missing the NAV value');
}

console.log(`NAV Fetched: ${value} cents | Checksum: ${checksum}`);

return Functions.encodeUint256(Math.round(value));