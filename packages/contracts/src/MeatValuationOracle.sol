// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {ConfirmedOwner} from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";

/**
 * @title MeatValuationOracle
 * @notice Synchronizes the off-chain NestJS valuation to the Hedera EVM via Chainlink Functions.
 */
contract MeatValuationOracle is FunctionsClient, ConfirmedOwner {
    using FunctionsRequest for FunctionsRequest.Request;

    bytes32 public donId;
    uint256 public latestNetAssetValue;
    bytes public latestExecutionError;

    event ValuationRequested(bytes32 indexed requestId);
    event ValuationUpdated(bytes32 indexed requestId, uint256 netAssetValue);
    event RequestFailed(bytes32 indexed requestId, bytes err);

    constructor(address router, bytes32 _donId) FunctionsClient(router) ConfirmedOwner(msg.sender) {
        donId = _donId;
    }

    /**
     * @notice Dispatches the execution request to the DON.
     */
    function requestValuation(
        string calldata source,
        uint8 donHostedSecretsSlotID,
        uint64 donHostedSecretsVersion,
        string[] calldata args,
        uint64 subscriptionId,
        uint32 gasLimit
    ) external onlyOwner returns (bytes32 requestId) {
        FunctionsRequest.Request memory req;
        
        req.initializeRequestForInlineJavaScript(source);
        
        if (donHostedSecretsVersion > 0) {
            req.addDONHostedSecrets(donHostedSecretsSlotID, donHostedSecretsVersion);
        }
        
        if (args.length > 0) req.setArgs(args);

        requestId = _sendRequest(
            req.encodeCBOR(),
            subscriptionId,
            gasLimit,
            donId
        );

        emit ValuationRequested(requestId);
    }

    /**
     * @notice Callback invoked by the Chainlink DON upon successful off-chain consensus.
     */
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        if (err.length > 0) {
            latestExecutionError = err;
            emit RequestFailed(requestId, err);
            return;
        }

        // Decode the ABI-encoded uint256 passed from the DON JavaScript execution
        latestNetAssetValue = abi.decode(response, (uint256));
        emit ValuationUpdated(requestId, latestNetAssetValue);
    }
    
    function setDonId(bytes32 newDonId) external onlyOwner {
        donId = newDonId;
    }
}