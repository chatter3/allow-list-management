import React, { useState } from "react";
import { Client } from "@xmtp/xmtp-js";
import { ethers } from "ethers";

export function ConsentManagement({
  onSubscribe,
  onUnsubscribe,
  onError,
  env,
  label = "Show subscriptions",
}) {
  const [loading, setLoading] = useState(false);
  const [consentList, setConsentList] = useState([]);
  const [client, setClient] = useState(null);

  const styles = {
    SubscribeButtonContainer: {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      borderRadius: "5px",
      alignItems: "center",
    },
    SubscribeButton: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "10px 20px",
      borderRadius: "5px",
      marginBottom: "2px",
      cursor: "pointer",
      transition: "background-color 0.3s ease",
      fontWeight: "bold",
      color: "#333333",
      backgroundColor: "#ededed",
      border: "none",
      fontSize: "12px",
    },
    ConsentContainer: {
      display: "flex",
      justifyContent: "space-between",
      flexWrap: "wrap",
    },
    ConsentTable: {
      flex: "1 1 400px",
      margin: "10px",
    },
  };

  const connectWallet = async () => {
    if (typeof window.ethereum !== "undefined") {
      try {
        await window.ethereum.request({ method: "eth_requestAccounts" });
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        return provider.getSigner();
      } catch (error) {
        console.error("User rejected request", error);
      }
    } else {
      console.error("Metamask not found");
    }
  };

  const handleClick = async () => {
    try {
      setLoading(true);
      let wallet = await connectWallet();
      let client = await Client.create(wallet, { env: env });
      setClient(client);
      await refreshConsentList(client);
      setLoading(false);
    } catch (error) {
      if (typeof onError === "function") onError(error);
      console.log(error);
    }
  };
  const refreshConsentList = async (client) => {
    let consentList = await client.contacts.refreshConsentList();

    let uniqueConsentList = consentList
      .slice()
      .reverse()
      .filter(
        (consent, index, self) =>
          index === self.findIndex((t) => t.value === consent.value),
      )
      .reverse();
    uniqueConsentList = uniqueConsentList.sort((a, b) => {
      if (a.permissionType === "allowed" && b.permissionType !== "allowed")
        return -1;
      if (a.permissionType === "unknown" && b.permissionType !== "unknown")
        return 1;
      if (a.permissionType === "denied" && b.permissionType !== "denied")
        return 1;
      return 0;
    });
    setConsentList(uniqueConsentList);
    return uniqueConsentList;
  };
  const downloadCSV = async () => {
    const csvRows = [];
    const headers = ["Address", "State"];
    csvRows.push(headers.join(","));

    const list = await refreshConsentList(client);
    console.log(list);
    for (const consent of list) {
      csvRows.push(`${consent.value},${consent.permissionType}`);
    }

    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.download = "consent_list.csv";
    link.href = url;
    link.click();
  };

  const handleAllow = async (address) => {
    if (client) {
      if (window.confirm("Are you sure you want to allow this address?")) {
        await client.contacts.allow([address]);
        await refreshConsentList(client);
        onSubscribe(client.address, "allowed");
      }
    } else {
      console.error("Client is not set");
    }
  };

  const handleDeny = async (address) => {
    if (client) {
      if (window.confirm("Are you sure you want to deny this address?")) {
        await client.contacts.deny([address]);
        await refreshConsentList(client);
        onUnsubscribe(client.address, "denied");
      }
    } else {
      console.error("Client is not set");
    }
  };

  // In the render function
  return (
    <div
      style={styles.SubscribeButtonContainer}
      className={`Subscribe ${loading ? "loading" : ""}`}>
      <button style={styles.SubscribeButton} onClick={handleClick}>
        {loading ? "Loading... " : label}
      </button>
      {consentList.length > 0 && (
        <button style={styles.SubscribeButton} onClick={downloadCSV}>
          Download CSV
        </button>
      )}
      <div style={styles.ConsentContainer}>
        <div style={styles.ConsentTable}>
          {consentList.length > 0 && <h2>Allowed</h2>}
          {consentList
            .filter((consent) => consent.permissionType === "allowed")
            .map((consent, index) => (
              <div
                key={index}
                style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ textAlign: "left" }}>{index + 1}.</span>
                <span style={{ textAlign: "left" }}>{consent.value}</span>
                <span
                  style={{ color: "red", cursor: "pointer" }}
                  onClick={() => handleDeny(consent.value)}>
                  Deny
                </span>
              </div>
            ))}
        </div>
        <div style={styles.ConsentTable}>
          {consentList.length > 0 && <h2>Denied</h2>}
          {consentList
            .filter((consent) => consent.permissionType === "denied")
            .map((consent, index) => (
              <div
                key={index}
                style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ textAlign: "left" }}>{index + 1}.</span>
                <span style={{ textAlign: "left" }}>{consent.value}</span>
                <span
                  style={{ color: "green", cursor: "pointer" }}
                  onClick={() => handleAllow(consent.value)}>
                  Allow
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
