import { useState} from "react";
import styled from "styled-components";
import { Button, TextField } from "@material-ui/core";
import * as anchor from "@project-serum/anchor";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletDialogButton } from "@solana/wallet-adapter-material-ui";
import { signAllMetadataFromCandyMachine } from "./signer";
import Select from 'react-select'

const ConnectButton = styled(WalletDialogButton)``;
const SignContainer = styled.div``; // add your styles here
const SignButton = styled(Button)``; // add your styles here
const options = [
  { value: 'https://api.devnet.solana.com', label: 'devnet' },
  { value: 'https://api.mainnet-beta.solana.com', label: 'mainnet' },
]
const customStyles = {
  option: (provided, state) => ({
    ...provided,
    borderBottom: '1px dotted pink',
    color: state.isSelected ? 'red' : 'blue',
  })
}
export interface HomeProps {}

const Home = (props: HomeProps) => {
  const wallet = useWallet();
  let connection = new anchor.web3.Connection("https://api.devnet.solana.com");
  const [signoutput, setSignOutput] = useState(String);
  const [candyid, setCandy] = useState(String);
  const setCandyChange = (event) => {
    setCandy(event.target.value);
  };
  const handleChangeOut = (newval) => {
    setSignOutput(newval);
  };
  const onSignAll = async () => {
    handleChangeOut("signing..");
    try {
      if (candyid == "") {
        handleChangeOut("please enter candy address..");
        return
      }
      await signAllMetadataFromCandyMachine(
        connection,
        wallet,
        candyid,
        10,
        handleChangeOut
      );
    } catch (error) {
      console.log(error);
      handleChangeOut("could not sign..");
    }
  };
  const disconnectWallet = async () => {
    wallet?.disconnect();
  };
  return (
    <main className="mainc">
      <h4>Candy Machine Metadata Signer</h4>
      <div className="selectorC">
      
      <Select styles={customStyles} options={options} />
      </div>
      <div className="cndymch">
        <TextField
          onChange={setCandyChange}
          className="textfield"
          id="outlined-basic"
          label="Candy machine id"
          variant="outlined"
          placeholder="Candy machine id"
        />
      </div>
      <div className="signBtn">
        <SignContainer>
          {!wallet.connected ? (
            <ConnectButton>Connect Wallet</ConnectButton>
          ) : (
            <SignButton onClick={onSignAll} variant="contained">
              {" "}
              SIGN
            </SignButton>
          )}
        </SignContainer>
      </div>
      <div className="light">{signoutput}</div>
    </main>
  );
};
export default Home;
