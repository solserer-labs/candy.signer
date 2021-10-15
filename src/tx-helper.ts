import {
    Commitment,
    Connection,
    RpcResponseAndContext,
    SignatureStatus,
    SimulatedTransactionResponse,
    Transaction,
    TransactionSignature,
    Account
  } from '@solana/web3.js';

export async function signTransactions({
  transactionsAndSigners,
  wallet,
  connection,
}: {
  transactionsAndSigners: {
    transaction: Transaction;
    signers?: Array<Account>;
  }[];
  wallet: any;
  connection: Connection;
}) {
  const blockhash = (await connection.getRecentBlockhash("max")).blockhash;
  transactionsAndSigners.forEach(({ transaction, signers = [] }) => {
    transaction.recentBlockhash = blockhash;
    transaction.setSigners(
      wallet.publicKey,
      ...signers.map((s) => s.publicKey)
    );
    if (signers?.length > 0) {
      transaction.partialSign(...signers);
    }
  });
  return await wallet.signAllTransactions(
    transactionsAndSigners.map(({ transaction }) => transaction)
  );
}
const DEFAULT_TIMEOUT = 15000;

export async function sendSignedTransaction({
    signedTransaction,
    connection,
    timeout = DEFAULT_TIMEOUT,
  }: {
    signedTransaction: Transaction;
    connection: Connection;
    sendingMessage?: string;
    sentMessage?: string;
    successMessage?: string;
    timeout?: number;
  }): Promise<{ txid: string; slot: number }> {
    const rawTransaction = signedTransaction.serialize();
    const startTime = getUnixTs();
    let slot = 0;
    const txid: TransactionSignature = await connection.sendRawTransaction(
      rawTransaction,
      {
        skipPreflight: true,
      },
    );
  
    //log.debug('Started awaiting confirmation for', txid);
  
    let done = false;
    (async () => {
      while (!done && getUnixTs() - startTime < timeout) {
        connection.sendRawTransaction(rawTransaction, {
          skipPreflight: true,
        });
        await sleep(500);
      }
    })();
    try {
      const confirmation = await awaitTransactionSignatureConfirmation(
        txid,
        timeout,
        connection,
        'recent',
        true,
      );
  
      if (!confirmation)
        throw new Error('Timed out awaiting confirmation on transaction');
  
      if (confirmation.err) {
        //log.error(confirmation.err);
        throw new Error('Transaction failed: Custom instruction error');
      }
  
      slot = confirmation?.slot || 0;
    } catch (err : any) {
      //log.error('Timeout Error caught', err);
      if (err.timeout) {
        throw new Error('Timed out awaiting confirmation on transaction');
      }
      let simulateResult: SimulatedTransactionResponse | null = null;
      try {
        simulateResult = (
          await simulateTransaction(connection, signedTransaction, 'single')
        ).value;
      } catch (e) {
        //log.error('Simulate Transaction error', e);
      }
      if (simulateResult && simulateResult.err) {
        if (simulateResult.logs) {
          for (let i = simulateResult.logs.length - 1; i >= 0; --i) {
            const line = simulateResult.logs[i];
            if (line.startsWith('Program log: ')) {
              throw new Error(
                'Transaction failed: ' + line.slice('Program log: '.length),
              );
            }
          }
        }
        throw new Error(JSON.stringify(simulateResult.err));
      }
      // throw new Error('Transaction failed');
    } finally {
      done = true;
    }
  
    //log.debug('Latency', txid, getUnixTs() - startTime);
    return { txid, slot };
  }
  
  async function simulateTransaction(
    connection: Connection,
    transaction: Transaction,
    commitment: Commitment,
  ): Promise<RpcResponseAndContext<SimulatedTransactionResponse>> {
    // @ts-ignore
    transaction.recentBlockhash = await connection._recentBlockhash(
      // @ts-ignore
      connection._disableBlockhashCaching,
    );
  
    const signData = transaction.serializeMessage();
    // @ts-ignore
    const wireTransaction = transaction._serialize(signData);
    const encodedTransaction = wireTransaction.toString('base64');
    const config: any = { encoding: 'base64', commitment };
    const args = [encodedTransaction, config];
  
    // @ts-ignore
    const res = await connection._rpcRequest('simulateTransaction', args);
    if (res.error) {
      throw new Error('failed to simulate transaction: ' + res.error.message);
    }
    return res.result;
  }
  
  async function awaitTransactionSignatureConfirmation(
    txid: TransactionSignature,
    timeout: number,
    connection: Connection,
    commitment: Commitment = 'recent',
    queryStatus = false,
  ): Promise<SignatureStatus | null | void> {
    let done = false;
    let status: SignatureStatus | null | void = {
      slot: 0,
      confirmations: 0,
      err: null,
    };
    let subId = 0;
    // eslint-disable-next-line no-async-promise-executor
    status = await new Promise(async (resolve, reject) => {
      setTimeout(() => {
        if (done) {
          return;
        }
        done = true;
        //log.warn('Rejecting for timeout...');
        reject({ timeout: true });
      }, timeout);
      try {
        subId = connection.onSignature(
          txid,
          (result, context) => {
            done = true;
            status = {
              err: result.err,
              slot: context.slot,
              confirmations: 0,
            };
            if (result.err) {
              //log.warn('Rejected via websocket', result.err);
              reject(status);
            } else {
              //log.debug('Resolved via websocket', result);
              resolve(status);
            }
          },
          commitment,
        );
      } catch (e) {
        done = true;
        //log.error('WS error in setup', txid, e);
      }
      while (!done && queryStatus) {
        // eslint-disable-next-line no-loop-func
        (async () => {
          try {
            const signatureStatuses = await connection.getSignatureStatuses([
              txid,
            ]);
            status = signatureStatuses && signatureStatuses.value[0];
            if (!done) {
              if (!status) {
                //log.debug('REST null result for', txid, status);
              } else if (status.err) {
                //log.error('REST error for', txid, status);
                done = true;
                reject(status.err);
              } else if (!status.confirmations) {
                //log.error('REST no confirmations for', txid, status);
              } else {
                //log.debug('REST confirmation for', txid, status);
                done = true;
                resolve(status);
              }
            }
          } catch (e) {
            if (!done) {
              //log.error('REST connection error: txid', txid, e);
            }
          }
        })();
        await sleep(2000);
      }
    });
  
    //@ts-ignore
    if (connection._signatureSubscriptions[subId])
      connection.removeSignatureListener(subId);
    done = true;
    //log.debug('Returning status', status);
    return status;
  }

const getUnixTs = () => {
  return new Date().getTime() / 1000;
};
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
