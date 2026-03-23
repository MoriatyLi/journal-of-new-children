// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IReviewJournalRegistry {
    function recordCompletedReview(address reviewer) external;
}

interface IReviewSubmissionRegistry {
    function setStatus(uint256 submissionId, uint8 nextStatus) external;
}

interface IReviewReputationSBT {
    struct Profile {
        uint256 totalPoints;
        uint256 reviewerWeight;
        uint256 authorWeight;
        uint256 editorWeight;
        string metadataURI;
    }

    function getProfile(address subject) external view returns (Profile memory);
}

contract ReviewRegistry {
    error Unauthorized();
    error MissingReview();
    error ReviewerLacksWeight();
    error ReviewAlreadySubmitted();

    struct Review {
        uint256 id;
        uint256 submissionId;
        address reviewer;
        bool isSelfNominated;
        string conflictStatement;
        uint256 openedAt;
        uint256 dueAt;
        bool submitted;
        uint8 methodologyScore;
        uint8 noveltyScore;
        uint8 rigorScore;
        uint8 clarityScore;
        uint8 recommendation;
        string summary;
        string reviewURI;
        uint256 submittedAt;
    }

    struct DisputeCase {
        uint256 id;
        uint8 targetType;
        uint256 targetId;
        address opener;
        string reason;
        string evidenceURI;
        bool resolved;
        bool upheld;
        string resolutionURI;
    }

    address public admin;
    IReviewJournalRegistry public immutable journalRegistry;
    IReviewSubmissionRegistry public immutable submissionRegistry;
    IReviewReputationSBT public immutable reputationRegistry;
    uint256 public reviewCount;
    uint256 public disputeCount;

    mapping(uint256 => Review) private reviews;
    mapping(uint256 => DisputeCase) private disputes;

    event ReviewOpened(
        uint256 indexed reviewId,
        uint256 indexed submissionId,
        address indexed reviewer,
        bool isSelfNominated,
        string conflictStatement
    );
    event ReviewSubmitted(
        uint256 indexed reviewId,
        uint256 indexed submissionId,
        address indexed reviewer,
        uint8 recommendation,
        string reviewURI
    );
    event DecisionRecorded(
        uint256 indexed submissionId,
        uint8 indexed decision,
        string rationaleURI
    );
    event DisputeOpened(
        uint256 indexed disputeId,
        uint8 indexed targetType,
        uint256 indexed targetId,
        address opener,
        string evidenceURI
    );
    event DisputeResolved(
        uint256 indexed disputeId,
        bool upheld,
        uint8 indexed newDecision,
        string resolutionURI
    );

    modifier onlyAdmin() {
        if (msg.sender != admin) revert Unauthorized();
        _;
    }

    constructor(
        address journalRegistry_,
        address submissionRegistry_,
        address reputationRegistry_
    ) {
        admin = msg.sender;
        journalRegistry = IReviewJournalRegistry(journalRegistry_);
        submissionRegistry = IReviewSubmissionRegistry(submissionRegistry_);
        reputationRegistry = IReviewReputationSBT(reputationRegistry_);
    }

    function openReview(
        uint256 submissionId,
        address reviewer,
        bool isSelfNominated,
        string calldata conflictStatement,
        uint256 dueAt
    ) external returns (uint256 reviewId) {
        if (msg.sender != reviewer && msg.sender != admin) revert Unauthorized();

        IReviewReputationSBT.Profile memory profile = reputationRegistry.getProfile(reviewer);
        if (profile.reviewerWeight == 0) revert ReviewerLacksWeight();

        reviewId = ++reviewCount;
        Review storage review = reviews[reviewId];
        review.id = reviewId;
        review.submissionId = submissionId;
        review.reviewer = reviewer;
        review.isSelfNominated = isSelfNominated;
        review.conflictStatement = conflictStatement;
        review.openedAt = block.timestamp;
        review.dueAt = dueAt;

        submissionRegistry.setStatus(submissionId, 2);

        emit ReviewOpened(reviewId, submissionId, reviewer, isSelfNominated, conflictStatement);
    }

    function submitReview(
        uint256 reviewId,
        uint8 methodologyScore,
        uint8 noveltyScore,
        uint8 rigorScore,
        uint8 clarityScore,
        uint8 recommendation,
        string calldata summary,
        string calldata reviewURI
    ) external {
        Review storage review = reviews[reviewId];
        if (review.id == 0) revert MissingReview();
        if (review.reviewer != msg.sender) revert Unauthorized();
        if (review.submitted) revert ReviewAlreadySubmitted();

        review.submitted = true;
        review.methodologyScore = methodologyScore;
        review.noveltyScore = noveltyScore;
        review.rigorScore = rigorScore;
        review.clarityScore = clarityScore;
        review.recommendation = recommendation;
        review.summary = summary;
        review.reviewURI = reviewURI;
        review.submittedAt = block.timestamp;

        journalRegistry.recordCompletedReview(msg.sender);

        emit ReviewSubmitted(reviewId, review.submissionId, msg.sender, recommendation, reviewURI);
    }

    function recordDecision(
        uint256 submissionId,
        uint8 decision,
        string calldata rationaleURI
    ) external onlyAdmin {
        submissionRegistry.setStatus(submissionId, decision);
        emit DecisionRecorded(submissionId, decision, rationaleURI);
    }

    function openDispute(
        uint8 targetType,
        uint256 targetId,
        string calldata reason,
        string calldata evidenceURI
    ) external returns (uint256 disputeId) {
        disputeId = ++disputeCount;
        disputes[disputeId] = DisputeCase({
            id: disputeId,
            targetType: targetType,
            targetId: targetId,
            opener: msg.sender,
            reason: reason,
            evidenceURI: evidenceURI,
            resolved: false,
            upheld: false,
            resolutionURI: ""
        });

        emit DisputeOpened(disputeId, targetType, targetId, msg.sender, evidenceURI);
    }

    function resolveDispute(
        uint256 disputeId,
        bool upheld,
        uint8 newDecision,
        string calldata resolutionURI
    ) external onlyAdmin {
        DisputeCase storage disputeCase = disputes[disputeId];
        disputeCase.resolved = true;
        disputeCase.upheld = upheld;
        disputeCase.resolutionURI = resolutionURI;

        if (upheld && disputeCase.targetType == 1) {
            submissionRegistry.setStatus(disputeCase.targetId, newDecision);
        }

        emit DisputeResolved(disputeId, upheld, newDecision, resolutionURI);
    }

    function getReview(uint256 reviewId) external view returns (Review memory) {
        return reviews[reviewId];
    }

    function getDispute(uint256 disputeId) external view returns (DisputeCase memory) {
        return disputes[disputeId];
    }
}
