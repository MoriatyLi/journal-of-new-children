// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ReputationSBT {
    error Unauthorized();
    error InvalidRole();

    enum Role {
        Author,
        Reviewer,
        Editor,
        Moderator
    }

    struct Profile {
        uint256 totalPoints;
        uint256 reviewerWeight;
        uint256 authorWeight;
        uint256 editorWeight;
        string metadataURI;
    }

    address public admin;
    address public journalRegistry;
    mapping(address => Profile) private profiles;

    event ReputationGranted(
        address indexed subject,
        uint8 indexed role,
        uint256 points,
        uint256 totalPoints,
        string reason,
        string metadataURI
    );

    modifier onlyAdmin() {
        if (msg.sender != admin) revert Unauthorized();
        _;
    }

    constructor(address journalRegistry_) {
        admin = msg.sender;
        journalRegistry = journalRegistry_;
    }

    function grantReputation(
        address subject,
        uint8 role,
        uint256 points,
        string calldata reason,
        string calldata metadataURI
    ) external onlyAdmin {
        if (role > uint8(Role.Moderator)) revert InvalidRole();

        Profile storage profile = profiles[subject];
        profile.totalPoints += points;
        profile.metadataURI = metadataURI;

        if (role == uint8(Role.Author)) {
            profile.authorWeight += points;
        } else if (role == uint8(Role.Reviewer)) {
            profile.reviewerWeight += points;
        } else if (role == uint8(Role.Editor)) {
            profile.editorWeight += points;
        }

        emit ReputationGranted(subject, role, points, profile.totalPoints, reason, metadataURI);
    }

    function getProfile(address subject) external view returns (Profile memory) {
        return profiles[subject];
    }
}
