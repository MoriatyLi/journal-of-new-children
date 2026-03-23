// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract JournalRegistry {
    error Unauthorized();

    string public journalName;
    string public journalSymbol;
    address public admin;
    address public submissionRegistry;
    address public reviewRegistry;
    address public reputationRegistry;

    uint256 public immutable reviewerThreshold;
    uint256 public immutable submissionThreshold;
    uint256 public immutable completedReviewThreshold;

    bool public genesisCouncilActive = true;
    uint256 public activeReviewerCount;
    uint256 public activeSubmissionCount;
    uint256 public completedReviewCount;

    mapping(address => bool) private reviewerSeen;

    event ProtocolModulesConfigured(
        address indexed submissionRegistry,
        address indexed reviewRegistry,
        address indexed reputationRegistry
    );
    event BootstrapProgress(
        uint256 activeReviewers,
        uint256 activeSubmissions,
        uint256 completedReviews,
        bool genesisCouncilActive
    );

    modifier onlyAdmin() {
        if (msg.sender != admin) revert Unauthorized();
        _;
    }

    modifier onlySubmissionRegistry() {
        if (msg.sender != submissionRegistry) revert Unauthorized();
        _;
    }

    modifier onlyReviewRegistry() {
        if (msg.sender != reviewRegistry) revert Unauthorized();
        _;
    }

    constructor(
        string memory journalName_,
        string memory journalSymbol_,
        uint256 reviewerThreshold_,
        uint256 submissionThreshold_,
        uint256 completedReviewThreshold_
    ) {
        admin = msg.sender;
        journalName = journalName_;
        journalSymbol = journalSymbol_;
        reviewerThreshold = reviewerThreshold_;
        submissionThreshold = submissionThreshold_;
        completedReviewThreshold = completedReviewThreshold_;
    }

    function configureProtocolModules(
        address submissionRegistry_,
        address reviewRegistry_,
        address reputationRegistry_
    ) external onlyAdmin {
        submissionRegistry = submissionRegistry_;
        reviewRegistry = reviewRegistry_;
        reputationRegistry = reputationRegistry_;

        emit ProtocolModulesConfigured(submissionRegistry_, reviewRegistry_, reputationRegistry_);
    }

    function recordSubmission(address) external onlySubmissionRegistry {
        activeSubmissionCount += 1;
        _refreshBootstrap();
    }

    function recordCompletedReview(address reviewer) external onlyReviewRegistry {
        completedReviewCount += 1;

        if (!reviewerSeen[reviewer]) {
            reviewerSeen[reviewer] = true;
            activeReviewerCount += 1;
        }

        _refreshBootstrap();
    }

    function _refreshBootstrap() private {
        if (
            genesisCouncilActive &&
            activeReviewerCount >= reviewerThreshold &&
            activeSubmissionCount >= submissionThreshold &&
            completedReviewCount >= completedReviewThreshold
        ) {
            genesisCouncilActive = false;
        }

        emit BootstrapProgress(
            activeReviewerCount,
            activeSubmissionCount,
            completedReviewCount,
            genesisCouncilActive
        );
    }
}
