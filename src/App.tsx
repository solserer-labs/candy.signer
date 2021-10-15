import "./App.css";
import { useMemo } from "react";
import Home from "./Home";
import { clusterApiUrl } from "@solana/web3.js";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  getPhantomWallet,
  getSolflareWallet,
  getSolletWallet,
} from "@solana/wallet-adapter-wallets";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletDialogProvider } from "@solana/wallet-adapter-material-ui";
const network = process.env.REACT_APP_SOLANA_NETWORK as WalletAdapterNetwork;
const App = () => {
  const endpoint = useMemo(() => clusterApiUrl(network), []);
  const wallets = useMemo(
    () => [getPhantomWallet(), getSolflareWallet(), getSolletWallet()],
    []
  );
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletDialogProvider>
          <Home
          />
        </WalletDialogProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
export default App;
