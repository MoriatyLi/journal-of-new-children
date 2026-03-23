// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ISubmissionJournalRegistry {
    function recordSubmission(address author) external;
    function reviewRegistry() external view returns (address);
}

contract SubmissionRegistry {
    error Unauthorized();
    error MissingSubmission();
    error InvalidParentVersion();

    enum SubmissionStatus {
        Draft,
        Submitted,
        UnderReview,
        Accepted,
        Revise,
        Rejected,
        Archived
    }

    struct Submission {
        uint256 id;
        address author;
        uint256 latestVersionId;
        SubmissionStatus status;
        uint256 createdAt;
        uint256 updatedAt;
    }

    struct SubmissionVersion {
        uint256 versionId;
        uint256 parentVersionId;
        string title;
        string abstractText;
        string manifestURI;
        string contentURI;
        string mirrorURI;
        string licenseCode;
        string[] authorRefs;
        string[] dataURIs;
        string[] codeURIs;
        uint256 createdAt;
    }

    ISubmissionJournalRegistry public immutable journalRegistry;
    uint256 public submissionCount;

    mapping(uint256 => Submission) private submissions;
    mapping(uint256 => mapping(uint256 => SubmissionVersion)) private versions;

    event SubmissionCreated(
        uint256 indexed submissionId,
        address indexed author,
        string title,
        uint8 status,
        string manifestURI
    );
    event SubmissionVersionAdded(
        uint256 indexed submissionId,
        uint256 indexed versionId,
        uint256 parentVersionId,
        string manifestURI,
        string contentURI,
        string mirrorURI
    );

    modifier onlyAuthor(uint256 submissionId) {
        if (submissions[submissionId].author != msg.sender) revert Unauthorized();
        _;
    }

    modifier onlyReviewRegistry() {
        if (msg.sender != journalRegistry.reviewRegistry()) revert Unauthorized();
        _;
    }

    constructor(address journalRegistry_) {
        journalRegistry = ISubmissionJournalRegistry(journalRegistry_);
    }

    function createSubmission(
        string calldata title,
        string calldata abstractText,
        string calldata manifestURI,
        string calldata contentURI,
        string calldata mirrorURI,
        string calldata licenseCode,
        string[] calldata authorRefs,
        string[] calldata dataURIs,
        string[] calldata codeURIs
    ) external returns (uint256 submissionId) {
        submissionId = ++submissionCount;

        Submission storage submission = submissions[submissionId];
        submission.id = submissionId;
        submission.author = msg.sender;
        submission.latestVersionId = 1;
        submission.status = SubmissionStatus.Submitted;
        submission.createdAt = block.timestamp;
        submission.updatedAt = block.timestamp;

        _writeVersion(
            submissionId,
            1,
            0,
            title,
            abstractText,
            manifestURI,
            contentURI,
            mirrorURI,
            licenseCode,
            authorRefs,
            dataURIs,
            codeURIs
        );

        journalRegistry.recordSubmission(msg.sender);

        emit SubmissionCreated(
            submissionId,
            msg.sender,
            title,
            uint8(SubmissionStatus.Submitted),
            manifestURI
        );
    }

    function addVersion(
        uint256 submissionId,
        uint256 parentVersionId,
        string calldata title,
        string calldata abstractText,
        string calldata manifestURI,
        string calldata contentURI,
        string calldata mirrorURI,
        string[] calldata dataURIs,
        string[] calldata codeURIs
    ) external onlyAuthor(submissionId) returns (uint256 versionId) {
        Submission storage submission = submissions[submissionId];
        if (submission.id == 0) revert MissingSubmission();
        if (parentVersionId != submission.latestVersionId) revert InvalidParentVersion();

        SubmissionVersion storage current = versions[submissionId][submission.latestVersionId];
        versionId = submission.latestVersionId + 1;
        submission.latestVersionId = versionId;
        submission.updatedAt = block.timestamp;

        string[] memory authorRefs = current.authorRefs;

        _writeVersion(
            submissionId,
            versionId,
            parentVersionId,
            title,
            abstractText,
            manifestURI,
            contentURI,
            mirrorURI,
            current.licenseCode,
            authorRefs,
            dataURIs,
            codeURIs
        );
    }

    function setStatus(uint256 submissionId, uint8 nextStatus) external onlyReviewRegistry {
        Submission storage submission = submissions[submissionId];
        if (submission.id == 0) revert MissingSubmission();
        submission.status = SubmissionStatus(nextStatus);
        submission.updatedAt = block.timestamp;
    }

    function getSubmission(uint256 submissionId) external view returns (Submission memory) {
        return submissions[submissionId];
    }

    function getVersion(
        uint256 submissionId,
        uint256 versionId
    ) external view returns (SubmissionVersion memory) {
        return versions[submissionId][versionId];
    }

    function _writeVersion(
        uint256 submissionId,
        uint256 versionId,
        uint256 parentVersionId,
        string memory title,
        string memory abstractText,
        string memory manifestURI,
        string memory contentURI,
        string memory mirrorURI,
        string memory licenseCode,
        string[] memory authorRefs,
        string[] memory dataURIs,
        string[] memory codeURIs
    ) private {
        SubmissionVersion storage version = versions[submissionId][versionId];
        version.versionId = versionId;
        version.parentVersionId = parentVersionId;
        version.title = title;
        version.abstractText = abstractText;
        version.manifestURI = manifestURI;
        version.contentURI = contentURI;
        version.mirrorURI = mirrorURI;
        version.licenseCode = licenseCode;
        version.authorRefs = authorRefs;
        version.dataURIs = dataURIs;
        version.codeURIs = codeURIs;
        version.createdAt = block.timestamp;

        emit SubmissionVersionAdded(
            submissionId,
            versionId,
            parentVersionId,
            manifestURI,
            contentURI,
            mirrorURI
        );
    }
}
