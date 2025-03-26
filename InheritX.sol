// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract DigitalWill {
    address public owner;
    address public oracle;
    address public executor;
    bool public isDeceased;

    string private encryptedWillHash;
    string public estateDescription;

    mapping(address => uint256) public shares;
    address[] public beneficiaryList;
    address[] public erc20TokenList;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyExecutorOrOracle() {
        require(msg.sender == executor || msg.sender == oracle, "Not authorized");
        _;
    }

    event EncryptedWillUpdated(string ipfsHash);
    event EstateDescriptionUpdated(string description);
    event BeneficiaryUpdated(address recipient, uint256 share);
    event BeneficiaryRemoved(address recipient);
    event BeneficiariesReset();
    event OwnerDeclaredDeceased(address by);
    event WillExecuted(uint256 totalETH);

    constructor(address _oracle, address _executor) {
        owner = msg.sender;
        oracle = _oracle;
        executor = _executor;
    }

    function setEncryptedWill(string calldata _ipfsHash) external onlyOwner {
        encryptedWillHash = _ipfsHash;
        emit EncryptedWillUpdated(_ipfsHash);
    }

    function getEncryptedWill() external view returns (string memory) {
        return encryptedWillHash;
    }

    function setEstateDescription(string calldata _description) external onlyOwner {
        estateDescription = _description;
        emit EstateDescriptionUpdated(_description);
    }

    function addTokenBeneficiary(address _recipient, uint256 _share) external onlyOwner {
        if (shares[_recipient] == 0) {
            beneficiaryList.push(_recipient);
        }
        shares[_recipient] = _share;
        emit BeneficiaryUpdated(_recipient, _share);
    }

    function removeBeneficiary(address _recipient) external onlyOwner {
        require(shares[_recipient] > 0, "No such beneficiary");
        shares[_recipient] = 0;
        for (uint i = 0; i < beneficiaryList.length; i++) {
            if (beneficiaryList[i] == _recipient) {
                beneficiaryList[i] = beneficiaryList[beneficiaryList.length - 1];
                beneficiaryList.pop();
                break;
            }
        }
        emit BeneficiaryRemoved(_recipient);
    }

    function resetAllBeneficiaries() public onlyOwner {
        for (uint i = 0; i < beneficiaryList.length; i++) {
            shares[beneficiaryList[i]] = 0;
        }
        delete beneficiaryList;
        emit BeneficiariesReset();
    }

    function getAllBeneficiaries() external view returns (address[] memory) {
        return beneficiaryList;
    }

    function addERC20Token(address _tokenAddress) external onlyOwner {
        erc20TokenList.push(_tokenAddress);
    }

    // 🔒 Oracle 或 Executor 均可确认死亡
    function confirmDeath() external onlyExecutorOrOracle {
        require(!isDeceased, "Already declared deceased");
        isDeceased = true;
        emit OwnerDeclaredDeceased(msg.sender);
        _executeWill(); // 自动执行
    }

    function _executeWill() internal {
        uint256 totalShares = 0;
        for (uint i = 0; i < beneficiaryList.length; i++) {
            totalShares += shares[beneficiaryList[i]];
        }
        require(totalShares > 0, "No valid beneficiaries");

        // 分发 ETH
        uint256 ethBalance = address(this).balance;
        if (ethBalance > 0) {
            for (uint i = 0; i < beneficiaryList.length; i++) {
                address recipient = beneficiaryList[i];
                uint256 amount = (ethBalance * shares[recipient]) / totalShares;
                payable(recipient).transfer(amount);
            }
            emit WillExecuted(ethBalance);
        }

        // 分发 ERC20
        for (uint t = 0; t < erc20TokenList.length; t++) {
            IERC20 token = IERC20(erc20TokenList[t]);
            uint256 tokenBalance = token.balanceOf(address(this));
            if (tokenBalance > 0) {
                for (uint i = 0; i < beneficiaryList.length; i++) {
                    address recipient = beneficiaryList[i];
                    uint256 amount = (tokenBalance * shares[recipient]) / totalShares;
                    token.transfer(recipient, amount);
                }
            }
        }

        resetAllBeneficiaries();
    }

    receive() external payable {}
}