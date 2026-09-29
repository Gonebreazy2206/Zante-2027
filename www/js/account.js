(() => {
  const ACCOUNTS_KEY = "zanteAccountsV1";
  const ACTIVE_KEY = "zanteActiveUser";
  let mode = "signin";

  const $ = id => document.getElementById(id);

  function getAccounts(){
    try {
      return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveAccounts(accounts){
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  }

  function bytesToBase64(bytes){
    let binary = "";
    bytes.forEach(byte => binary += String.fromCharCode(byte));
    return btoa(binary);
  }

  function base64ToBytes(value){
    const binary = atob(value);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
  }

  async function hashPassword(password, saltBytes){
    const material = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );

    const bits = await crypto.subtle.deriveBits(
      {
        name:"PBKDF2",
        hash:"SHA-256",
        salt:saltBytes,
        iterations:120000
      },
      material,
      256
    );

    return bytesToBase64(new Uint8Array(bits));
  }

  function setMode(nextMode){
    mode = nextMode;
    const creating = mode === "create";

    $("authTitle").textContent = creating ? "Add account" : "Sign in";
    $("authSubtitle").textContent = creating
      ? "Choose a username and password."
      : "Use your username and password.";

    $("submitButton").textContent = creating ? "Create account" : "Sign in";
    $("switchButton").textContent = creating ? "Back to sign in" : "Add account";
    $("confirmField").classList.toggle("hidden", !creating);
    $("confirmPassword").required = creating;
    $("password").autocomplete = creating ? "new-password" : "current-password";
    $("status").textContent = "";
  }

  async function signIn(username,password){
    const account = getAccounts().find(item => item.username.toLowerCase() === username.toLowerCase());

    if (!account) {
      $("status").textContent = "Account not found.";
      return;
    }

    const hash = await hashPassword(password, base64ToBytes(account.salt));

    if (hash !== account.passwordHash) {
      $("status").textContent = "Incorrect password.";
      return;
    }

    localStorage.setItem(ACTIVE_KEY, account.username);
    window.location.href = "index.html";
  }

  async function createAccount(username,password,confirmPassword){
    if (username.length < 3) {
      $("status").textContent = "Username must be at least 3 characters.";
      return;
    }

    if (password.length < 6) {
      $("status").textContent = "Password must be at least 6 characters.";
      return;
    }

    if (password !== confirmPassword) {
      $("status").textContent = "Passwords do not match.";
      return;
    }

    const accounts = getAccounts();

    if (accounts.some(item => item.username.toLowerCase() === username.toLowerCase())) {
      $("status").textContent = "That username already exists on this device.";
      return;
    }

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const passwordHash = await hashPassword(password, salt);

    accounts.push({
      username,
      salt:bytesToBase64(salt),
      passwordHash,
      createdAt:Date.now()
    });

    saveAccounts(accounts);
    localStorage.setItem(ACTIVE_KEY, username);
    window.location.href = "index.html";
  }

  $("backButton").onclick = () => {
    window.location.href = "index.html";
  };

  $("switchButton").onclick = () => {
    setMode(mode === "signin" ? "create" : "signin");
    $("authForm").reset();
    $("username").focus();
  };

  $("authForm").onsubmit = async event => {
    event.preventDefault();
    $("status").textContent = "";

    const username = $("username").value.trim();
    const password = $("password").value;

    if (!username || !password) {
      $("status").textContent = "Enter your username and password.";
      return;
    }

    $("submitButton").disabled = true;

    try {
      if (mode === "create") {
        await createAccount(username, password, $("confirmPassword").value);
      } else {
        await signIn(username, password);
      }
    } catch (error) {
      console.error(error);
      $("status").textContent = "Could not complete that action on this device.";
    } finally {
      $("submitButton").disabled = false;
    }
  };

  setMode("signin");
})();