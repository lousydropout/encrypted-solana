import { BN, web3 } from "@coral-xyz/anchor";
import idl from "../assets/encrypted.json";
import { program } from "../store/program";
import { user } from "../store/user";
import {
  chatLogs,
  registry,
  setChatMessages,
  setChatLogs,
  setRegistry,
  chatMessages,
} from "../store/chatapp";

import { decrypt, encrypt, importPublicKey } from "../helpers/crypto";
import { walletPubkey } from "../components/Header";

const fetchRegistryAccounts = async () => {
  let results = await program().account.registryAccount.all();
  setRegistry({ users: results });
  console.log("registry: ", registry);
};

const fetchChatLogs = async () => {
  return await program().account.chatAccount.all();
};

const fetchChatLogsByOwner = async (username) => {
  const all = await fetchChatLogs();
  const results = all.filter((x) => x.account.owner === username);
  setChatLogs("accounts", results);
  return results;
};

const initializeChat = async (alice, bob) => {
  const [aliceChatAccount, _] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("chat"), Buffer.from(alice), Buffer.from(bob)],
    new web3.PublicKey(idl.metadata.address)
  );
  const [bobChatAccount, __] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("chat"), Buffer.from(bob), Buffer.from(alice)],
    new web3.PublicKey(idl.metadata.address)
  );

  let results = await program()
    .methods.initChat(alice, bob)
    .accounts({
      aliceChatAccount,
      bobChatAccount,
      signer: walletPubkey().PublicKey,
      systemProgram: web3.SystemProgram.programId,
    })
    .rpc();

  console.log("initializeChat results: ", results);
  return results;
};

const sendMessage = async (alice, bob, timestamp, message) => {
  console.log("registry: ", registry);
  console.log("registry.users: ", registry.users);
  const aliceAccount = registry.users.filter(
    (x) => x.account.username === alice
  )[0];
  const aliceEncryptionKey = await importPublicKey(
    aliceAccount.account.messagingPubkey
  );

  const bobAccount = registry.users.filter(
    (x) => x.account.username === bob
  )[0];
  const bobEncryptionKey = await importPublicKey(
    bobAccount.account.messagingPubkey
  );

  // encrypt message
  const msgForAlice = await encrypt(message, aliceEncryptionKey);
  const msgForBob = await encrypt(message, bobEncryptionKey);

  // chatlogs
  // let aliceChats = chatLogs.accounts.filter((x) => x.account.owner === alice);
  // console.log("chatLogs.accounts: ", chatLogs.accounts);
  // console.log("aliceChats: ", aliceChats);

  // const idx = aliceChats.length;
  const idx = chatMessages.accounts.length;
  console.log("idx: ", idx);

  // get reigistry account
  const [registryAccount, _] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("registry"), Buffer.from(alice)],
    new web3.PublicKey(idl.metadata.address)
  );
  // get chatAccounts
  const [aliceChatAccount, __] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("chat"), Buffer.from(alice), Buffer.from(bob)],
    new web3.PublicKey(idl.metadata.address)
  );
  const [bobChatAccount, ___] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("chat"), Buffer.from(bob), Buffer.from(alice)],
    new web3.PublicKey(idl.metadata.address)
  );

  // get messageAccounts
  const [aliceMessageAccount, ____] = web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("message"),
      Buffer.from(alice),
      Buffer.from(bob),
      new BN(idx).toArrayLike(Buffer, "le", 8),
    ],
    new web3.PublicKey(idl.metadata.address)
  );
  const [bobMessageAccount, _____] = web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("message"),
      Buffer.from(bob),
      Buffer.from(alice),
      new BN(idx).toArrayLike(Buffer, "le", 8),
    ],
    new web3.PublicKey(idl.metadata.address)
  );

  console.log("walletPubkey(): ", walletPubkey());

  let results = await program()
    .methods.sendMessage(alice, bob, timestamp, msgForAlice, msgForBob)
    .accounts({
      registryAccount,
      aliceChatAccount,
      bobChatAccount,
      aliceMessageAccount,
      bobMessageAccount,
      signer: walletPubkey().PublicKey,
      systemProgram: web3.SystemProgram.programId,
    })
    .rpc();

  console.log("sendMessage results: ", results);
  return results;
};

const fetchChatMessages_legacy = async (decryptionKey) => {
  let messages = await program().account.messageAccount.all();
  let results = [];
  for (let i = 0; i < messages.length; i++) {
    try {
      let y = await decrypt(
        messages[i].account.encryptedMessage,
        decryptionKey
      );
      results.push({ ...messages[i].account, message: y, okay: true });
    } catch (e) {}
  }

  setChatMessages("accounts", results);
  return results;
};

const fetchChatMessages = async (username, conversation_parter) => {
  const bob = conversation_parter;
  let chatlogs = await fetchChatLogsByOwner(username);
  let chat = chatlogs.filter((x) => x.account.chattingWith === bob);
  console.log(
    "chatlogs between ",
    username,
    " and ",
    conversation_parter,
    ": ",
    chat
  );
  if (chat.length === 0) return [];
  let lastIdx = chat[0].account.idx.toNumber();

  let results = [];
  for (let i = 0; i < lastIdx; i++) {
    let [address, _] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("message"),
        Buffer.from(username),
        Buffer.from(bob),
        new BN(i).toArrayLike(Buffer, "le", 8),
      ],
      new web3.PublicKey(idl.metadata.address)
    );

    let account = await program().account.messageAccount.fetch(address);
    try {
      let y = await decrypt(account.encryptedMessage, user().decryptionKey);
      let result = { ...account, message: y };
      console.log(y, { ...account, message: y });
      results.push(result);
    } catch (e) {}
  }
  console.log("results: ", results);

  setChatMessages("accounts", results);
  console.log("chatMessages: ", chatMessages.accounts);
  return results;
};

export {
  fetchRegistryAccounts,
  fetchChatLogs,
  fetchChatLogsByOwner,
  fetchChatMessages,
  fetchChatMessages_legacy,
  initializeChat,
  sendMessage,
};
