import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import './App.css';

const CONTRACT_ADDRESS = "0x887e67767f970bB178b7f285c1D7E26cC859F613";
const ABI = [
  "function addTokenBeneficiary(address _recipient, uint256 _share) external",
  "function addNFTBeneficiary(address _recipient, uint256 _tokenId) external",
  "function addMultiTokenBeneficiary(address _recipient, uint256 _tokenId, uint256 _amount) external",
  "function removeBeneficiary(address _recipient) external",
  "function verifyBeneficiary(address _recipient) external",
  "function getBeneficiaryStatus(address _recipient) view returns (bool)",
  "function getBeneficiaryType(address _recipient) view returns (uint8)",
  "function getBeneficiaryShare(address _recipient) view returns (uint256)",
  "function getBeneficiaryTokenId(address _recipient) view returns (uint256)",
  "function getBeneficiaryAmount(address _recipient) view returns (uint256)",
  "function setEncryptedWill(string _ipfsHash) external",
  "function getEncryptedWill() view returns (string)",
  "function confirmDeath() external",
  "function isDeathConfirmed() view returns (bool)"
];

export default function App() {
  // Add wallet connection states
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState("");
  const [provider, setProvider] = useState(null);

  // Beneficiary states
  const [recipient, setRecipient] = useState("");
  const [share, setShare] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [amount, setAmount] = useState("");
  const [beneficiaryType, setBeneficiaryType] = useState("token");
  const [beneficiaryStatus, setBeneficiaryStatus] = useState(null);
  const [beneficiaryInfo, setBeneficiaryInfo] = useState(null);

  // Encrypted Will states
  const [newHash, setNewHash] = useState("");
  const [ipfsHash, setIpfsHash] = useState("");
  const [isDeathConfirmed, setIsDeathConfirmed] = useState(false);

  // Add wallet connection functions
  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert("Please install MetaMask!");
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      
      setProvider(provider);
      setAccount(address);
      setIsConnected(true);
    } catch (error) {
      console.error("Error connecting wallet:", error);
      alert("Failed to connect wallet. Please try again.");
    }
  };

  const disconnectWallet = async () => {
    try {
      if (provider) {
        await provider.send("eth_requestAccounts", []);
        setProvider(null);
        setAccount("");
        setIsConnected(false);
      }
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
    }
  };

  // Update getContract function to use the provider
  const getContract = async () => {
    if (!provider) {
      throw new Error("Wallet not connected");
    }
    const signer = await provider.getSigner();
    return new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
  };

  // Add useEffect for wallet connection
  useEffect(() => {
    const checkConnection = async () => {
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_accounts", []);
        if (accounts.length > 0) {
          setProvider(provider);
          setAccount(accounts[0]);
          setIsConnected(true);
        }
      }
    };
    checkConnection();
  }, []);

  // Beneficiary functions
  const addBeneficiary = async () => {
    if (!recipient) return alert("Recipient address is required.");
    
    const contract = await getContract();
    let tx;

    switch (beneficiaryType) {
      case "token":
        if (!share) return alert("Share percentage is required for token beneficiaries.");
        tx = await contract.addTokenBeneficiary(recipient, ethers.parseUnits(share, 0));
        break;
      case "nft":
        if (!tokenId) return alert("Token ID is required for NFT beneficiaries.");
        tx = await contract.addNFTBeneficiary(recipient, ethers.parseUnits(tokenId, 0));
        break;
      case "multitoken":
        if (!tokenId || !amount) return alert("Token ID and amount are required for multi-token beneficiaries.");
        tx = await contract.addMultiTokenBeneficiary(recipient, ethers.parseUnits(tokenId, 0), ethers.parseUnits(amount, 0));
        break;
    }

    await tx.wait();
    alert(`Beneficiary ${recipient} added successfully!`);
    fetchBeneficiaryInfo();
  };

  const removeBeneficiary = async () => {
    if (!recipient) return alert("Recipient address is required.");
    const contract = await getContract();
    const tx = await contract.removeBeneficiary(recipient);
    await tx.wait();
    alert(`Beneficiary ${recipient} removed successfully!`);
    fetchBeneficiaryInfo();
  };

  const verifyBeneficiary = async () => {
    if (!recipient) return alert("Recipient address is required.");
    const contract = await getContract();
    const tx = await contract.verifyBeneficiary(recipient);
    await tx.wait();
    alert(`Beneficiary ${recipient} verified successfully!`);
    fetchBeneficiaryInfo();
  };

  const fetchBeneficiaryInfo = async () => {
    if (!recipient) return;
    
    const contract = await getContract();
    const status = await contract.getBeneficiaryStatus(recipient);
    setBeneficiaryStatus(status);

    if (status) {
      const type = await contract.getBeneficiaryType(recipient);
      let info = { type };

      switch (type) {
        case 0: // Token
          info.share = await contract.getBeneficiaryShare(recipient);
          break;
        case 1: // NFT
          info.tokenId = await contract.getBeneficiaryTokenId(recipient);
          break;
        case 2: // MultiToken
          info.tokenId = await contract.getBeneficiaryTokenId(recipient);
          info.amount = await contract.getBeneficiaryAmount(recipient);
          break;
      }
      setBeneficiaryInfo(info);
    } else {
      setBeneficiaryInfo(null);
    }
  };

  // Encrypted Will functions
  const storeHash = async () => {
    if (!newHash) return alert("Please enter the IPFS hash.");
    const contract = await getContract();
    const tx = await contract.setEncryptedWill(newHash);
    await tx.wait();
    alert("Encrypted Will stored on chain.");
    fetchHash();
  };

  const fetchHash = async () => {
    const contract = await getContract();
    const hash = await contract.getEncryptedWill();
    setIpfsHash(hash);
  };

  // Death Confirmation functions
  const confirmDeath = async () => {
    if (!confirm("Are you sure you want to confirm death? This action cannot be undone.")) {
      return;
    }
    const contract = await getContract();
    const tx = await contract.confirmDeath();
    await tx.wait();
    alert("Death confirmed. The inheritance process will now begin.");
    fetchDeathStatus();
  };

  const fetchDeathStatus = async () => {
    const contract = await getContract();
    const status = await contract.isDeathConfirmed();
    setIsDeathConfirmed(status);
  };

  useEffect(() => {
    if (recipient) {
      fetchBeneficiaryInfo();
    }
    fetchHash();
    fetchDeathStatus();
  }, [recipient]);

  return (
    <div>
      <header className="header">
        <div className="main-content">
          <div className="header-content">
            <h1 className="header-title">InheritX</h1>
            <p className="header-subtitle">Secure Digital Inheritance Platform</p>
            {isConnected && (
              <div className="wallet-container">
                <span className="wallet-address">
                  {account.slice(0, 6)}...{account.slice(-4)}
                </span>
                <button
                  onClick={disconnectWallet}
                  className="disconnect-btn"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="main-content">
        {!isConnected ? (
          <div className="section text-center">
            <h2 className="section-title">Connect Your Wallet</h2>
            <p className="info-text mb-8">Please connect your MetaMask wallet to access the inheritance platform and manage your digital assets securely.</p>
            <button
              onClick={connectWallet}
              className="btn btn-primary"
            >
              Connect MetaMask
            </button>
          </div>
        ) : (
          <>
            {/* Encrypted Will Section */}
            <section className="section">
              <h2 className="section-title">Encrypted Will</h2>
              
              <div className="space-y-8">
                <div>
                  <label className="form-label">Store Encrypted Will (IPFS Hash)</label>
                  <div className="flex gap-4">
                    <input
                      type="text"
                      value={newHash}
                      placeholder="Enter IPFS Hash"
                      onChange={(e) => setNewHash(e.target.value)}
                      className="form-input flex-1"
                    />
                    <button
                      onClick={storeHash}
                      className="btn btn-primary"
                    >
                      Store
                    </button>
                  </div>
                  {ipfsHash && (
                    <div className="info-box">
                      <p className="info-text">
                        Current Hash: <span className="font-mono bg-blue-100 px-3 py-1 rounded-lg">{ipfsHash}</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Beneficiaries Section */}
            <section className="section">
              <h2 className="section-title">Manage Beneficiaries</h2>
              
              <div className="space-y-6 mb-10">
                <select
                  value={beneficiaryType}
                  onChange={(e) => setBeneficiaryType(e.target.value)}
                  className="form-input"
                >
                  <option value="token">Token Beneficiary</option>
                  <option value="nft">NFT Beneficiary</option>
                  <option value="multitoken">Multi-Token Beneficiary</option>
                </select>

                <input
                  type="text"
                  value={recipient}
                  placeholder="Beneficiary Address (0x...)"
                  onChange={(e) => setRecipient(e.target.value)}
                  className="form-input"
                />

                {beneficiaryType === "token" && (
                  <input
                    type="number"
                    value={share}
                    placeholder="Share (%)"
                    onChange={(e) => setShare(e.target.value)}
                    className="form-input"
                  />
                )}

                {(beneficiaryType === "nft" || beneficiaryType === "multitoken") && (
                  <input
                    type="number"
                    value={tokenId}
                    placeholder="Token ID"
                    onChange={(e) => setTokenId(e.target.value)}
                    className="form-input"
                  />
                )}

                {beneficiaryType === "multitoken" && (
                  <input
                    type="number"
                    value={amount}
                    placeholder="Amount"
                    onChange={(e) => setAmount(e.target.value)}
                    className="form-input"
                  />
                )}
              </div>

              <div className="flex flex-col md:flex-row gap-4 mb-10">
                <button
                  onClick={addBeneficiary}
                  className="btn btn-success"
                >
                  Add Beneficiary
                </button>
                <button
                  onClick={removeBeneficiary}
                  className="btn btn-danger"
                >
                  Remove Beneficiary
                </button>
                <button
                  onClick={verifyBeneficiary}
                  className="btn btn-primary"
                >
                  Verify Beneficiary
                </button>
              </div>

              {beneficiaryStatus !== null && (
                <div className="info-box">
                  <h3 className="info-title">Beneficiary Information</h3>
                  <p className="info-text mb-4">Status: <span className={beneficiaryStatus ? "status-active" : "status-inactive"}>
                    {beneficiaryStatus ? "Active" : "Not Found"}
                  </span></p>
                  
                  {beneficiaryInfo && (
                    <div className="space-y-3">
                      <p className="info-text">Type: <span className="font-semibold text-blue-700">{
                        beneficiaryInfo.type === 0 ? "Token" :
                        beneficiaryInfo.type === 1 ? "NFT" : "Multi-Token"
                      }</span></p>
                      
                      {beneficiaryInfo.type === 0 && (
                        <p className="info-text">Share: <span className="font-semibold text-blue-700">{ethers.formatUnits(beneficiaryInfo.share, 0)}%</span></p>
                      )}
                      
                      {(beneficiaryInfo.type === 1 || beneficiaryInfo.type === 2) && (
                        <p className="info-text">Token ID: <span className="font-semibold text-blue-700">{ethers.formatUnits(beneficiaryInfo.tokenId, 0)}</span></p>
                      )}
                      
                      {beneficiaryInfo.type === 2 && (
                        <p className="info-text">Amount: <span className="font-semibold text-blue-700">{ethers.formatUnits(beneficiaryInfo.amount, 0)}</span></p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Death Confirmation Section */}
            <section className="section">
              <h2 className="section-title">Death Confirmation</h2>
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <p className="info-text">Status:</p>
                  <span className={`text-xl ${isDeathConfirmed ? "status-inactive" : "status-active"}`}>
                    {isDeathConfirmed ? "Confirmed" : "Not Confirmed"}
                  </span>
                </div>
                <button
                  onClick={confirmDeath}
                  disabled={isDeathConfirmed}
                  className={`btn ${isDeathConfirmed ? "bg-gray-400 cursor-not-allowed" : "btn-danger"}`}
                >
                  Confirm Death
                </button>
              </div>
            </section>
          </>
        )}
      </main>

    </div>
  );
} 