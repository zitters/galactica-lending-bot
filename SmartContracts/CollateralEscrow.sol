// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title CollateralEscrow
 * @dev Smart contract for holding WBTC collateral during Galactica loans
 * 
 * Flow:
 * 1. Borrower approves WBTC transfer to this contract
 * 2. Contract locks WBTC for loan duration
 * 3. On successful repayment: collateral returned
 * 4. On default: collateral liquidated or held
 * 5. UI verifies collateral lock before releasing funds
 */

interface ILoanManager {
    function isLoanActive(bytes32 loanId) external view returns (bool);
    function getLoanBorrower(bytes32 loanId) external view returns (address);
    function getLoanExpiryTime(bytes32 loanId) external view returns (uint256);
}

contract CollateralEscrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ──── STATE ────────────────────────────────────────────────────
    IERC20 public wbtcToken;
    ILoanManager public loanManager; // Optional: reference to loan manager contract
    
    struct CollateralDeposit {
        address borrower;        // Who locked the collateral
        uint256 amount;          // WBTC amount in smallest unit
        bytes32 loanId;          // Associated loan ID
        uint256 lockedAtTime;    // When collateral was locked
        uint256 expiryTime;      // When loan expires (collateral can be released)
        bool isReleased;         // Has collateral been released
        string borrowerBTCAddress; // Bitcoin address for identity linking
    }

    // loanId => CollateralDeposit
    mapping(bytes32 => CollateralDeposit) public deposits;
    
    // borrower => array of loan IDs (for querying user's collateral)
    mapping(address => bytes32[]) public borrowerLoans;
    
    // Total WBTC held in escrow
    uint256 public totalCollateralHeld;
    
    // Events
    event CollateralLocked(
        bytes32 indexed loanId,
        address indexed borrower,
        uint256 amount,
        uint256 expiryTime
    );
    
    event CollateralReleased(
        bytes32 indexed loanId,
        address indexed borrower,
        uint256 amount,
        string reason // "repaid", "defaulted", "cancelled"
    );
    
    event CollateralLiquidated(
        bytes32 indexed loanId,
        address indexed borrower,
        uint256 amount
    );

    // ──── CONSTRUCTOR ──────────────────────────────────────────────
    constructor(address _wbtcTokenAddress) {
        wbtcToken = IERC20(_wbtcTokenAddress);
    }

    // ──── COLLATERAL LOCKING ───────────────────────────────────────
    /**
     * Lock WBTC collateral for a loan
     * Borrower must have approved this contract before calling
     */
    function lockCollateral(
        bytes32 loanId,
        uint256 wbtcAmount,
        uint256 loanDurationDays,
        string memory borrowerBTCAddress
    ) external nonReentrant returns (bool) {
        require(wbtcAmount > 0, "Collateral amount must be > 0");
        require(loanDurationDays > 0, "Loan duration must be > 0");
        require(deposits[loanId].amount == 0, "Loan already has collateral locked");
        
        // Check allowance
        uint256 allowance = wbtcToken.allowance(msg.sender, address(this));
        require(allowance >= wbtcAmount, "WBTC approval insufficient");
        
        // Transfer WBTC from borrower to this contract
        bool success = wbtcToken.transferFrom(msg.sender, address(this), wbtcAmount);
        require(success, "WBTC transfer failed");
        
        // Calculate expiry time
        uint256 expiryTime = block.timestamp + (loanDurationDays * 1 days);
        
        // Store deposit
        deposits[loanId] = CollateralDeposit({
            borrower: msg.sender,
            amount: wbtcAmount,
            loanId: loanId,
            lockedAtTime: block.timestamp,
            expiryTime: expiryTime,
            isReleased: false,
            borrowerBTCAddress: borrowerBTCAddress
        });
        
        borrowerLoans[msg.sender].push(loanId);
        totalCollateralHeld += wbtcAmount;
        
        emit CollateralLocked(loanId, msg.sender, wbtcAmount, expiryTime);
        return true;
    }

    // ──── COLLATERAL RELEASE ───────────────────────────────────────
    /**
     * Release collateral after successful repayment
     * Only callable by contract owner (loan manager) or after expiry
     */
    function releaseCollateral(
        bytes32 loanId,
        string memory reason // "repaid" or "defaulted"
    ) external onlyOwner nonReentrant returns (bool) {
        CollateralDeposit storage deposit = deposits[loanId];
        require(deposit.amount > 0, "No collateral for this loan");
        require(!deposit.isReleased, "Collateral already released");
        
        address borrower = deposit.borrower;
        uint256 amount = deposit.amount;
        
        // Mark as released
        deposit.isReleased = true;
        totalCollateralHeld -= amount;
        
        // Return collateral to borrower
        wbtcToken.safeTransfer(borrower, amount);
        
        emit CollateralReleased(loanId, borrower, amount, reason);
        return true;
    }

    /**
     * Emergency: Borrower can claim collateral if loan expires and is unclaimed
     */
    function claimExpiredCollateral(bytes32 loanId) external nonReentrant returns (bool) {
        CollateralDeposit storage deposit = deposits[loanId];
        require(deposit.borrower == msg.sender, "Not collateral owner");
        require(!deposit.isReleased, "Already released");
        require(block.timestamp >= deposit.expiryTime, "Loan not yet expired");
        
        uint256 amount = deposit.amount;
        deposit.isReleased = true;
        totalCollateralHeld -= amount;
        
        wbtcToken.safeTransfer(msg.sender, amount);
        
        emit CollateralReleased(loanId, msg.sender, amount, "expired_claimed");
        return true;
    }

    // ──── QUERY FUNCTIONS ───────────────────────────────────────────
    /**
     * Check if collateral is locked for a loan
     */
    function isCollateralLocked(bytes32 loanId) external view returns (bool) {
        return deposits[loanId].amount > 0 && !deposits[loanId].isReleased;
    }

    /**
     * Get collateral details for a loan
     */
    function getCollateralInfo(bytes32 loanId) 
        external 
        view 
        returns (
            address borrower,
            uint256 amount,
            uint256 expiryTime,
            bool isReleased,
            bool isExpired
        ) 
    {
        CollateralDeposit storage deposit = deposits[loanId];
        return (
            deposit.borrower,
            deposit.amount,
            deposit.expiryTime,
            deposit.isReleased,
            block.timestamp >= deposit.expiryTime
        );
    }

    /**
     * Get all loans for a borrower
     */
    function getBorrowerLoans(address borrower) external view returns (bytes32[] memory) {
        return borrowerLoans[borrower];
    }

    /**
     * Get borrower's total locked collateral
     */
    function getBorrowerCollateralLocked(address borrower) public view returns (uint256 total) {
        bytes32[] memory loans = borrowerLoans[borrower];
        for (uint i = 0; i < loans.length; i++) {
            if (!deposits[loans[i]].isReleased) {
                total += deposits[loans[i]].amount;
            }
        }
        return total;
    }

    // ──── ADMIN FUNCTIONS ───────────────────────────────────────────
    /**
     * Set loan manager contract reference (optional)
     */
    function setLoanManager(address _loanManager) external onlyOwner {
        loanManager = ILoanManager(_loanManager);
    }

    /**
     * Set WBTC token if needed (shouldn't change, but good for safety)
     */
    function setWBTCToken(address _wbtcToken) external onlyOwner {
        wbtcToken = IERC20(_wbtcToken);
    }

    /**
     * Emergency: withdraw stuck tokens (not collateral)
     */
    function emergencyWithdraw(address token) external onlyOwner {
        require(token != address(wbtcToken), "Cannot withdraw collateral");
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(token).safeTransfer(owner(), balance);
        }
    }

    // ──── RECEIVE FALLBACK ─────────────────────────────────────────
    receive() external payable {
        // Contract can receive ETH for future gas optimization
    }
}
