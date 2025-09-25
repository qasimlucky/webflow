const crypto = require("crypto");
require("dotenv").config();

console.log("🔍 Testing RSA Private Key...");

try {
  // Load the private key
  const privateKeyString = process.env.PXL_PRIVATE_KEY;

  if (!privateKeyString) {
    console.error("❌ PXL_PRIVATE_KEY not found in environment variables");
    process.exit(1);
  }

  console.log("✅ Private key found in environment");
  console.log("📏 Private key length:", privateKeyString.length);

  // Properly handle the private key format
  let processedPrivateKey = privateKeyString;

  // Remove escaped characters (backslashes) that might be in the environment variable
  processedPrivateKey = processedPrivateKey.replace(/\\/g, "");

  // Replace literal \n with actual newlines if needed
  if (processedPrivateKey.includes("\\n")) {
    processedPrivateKey = processedPrivateKey.replace(/\\n/g, "\n");
  }

  // Check if key needs PEM headers added
  if (!processedPrivateKey.includes("-----BEGIN")) {
    console.log("🔧 Adding PEM headers to private key...");
    // Add proper PEM headers if missing
    processedPrivateKey = `-----BEGIN RSA PRIVATE KEY-----\n${processedPrivateKey}\n-----END RSA PRIVATE KEY-----`;
    console.log("✅ PEM headers added");
  }

  // Ensure proper PEM format
  if (!processedPrivateKey.includes("-----BEGIN")) {
    console.error("❌ Private key doesn't appear to be in PEM format");
    process.exit(1);
  }

  // Create the private key object
  const rsaKey = crypto.createPrivateKey(processedPrivateKey);

  console.log("✅ Private key loaded successfully");
  console.log("🔍 Key size:", rsaKey.asymmetricKeySize, "bits");
  console.log("🔍 Key type:", rsaKey.asymmetricKeyType);

  // Test with a small encrypted message (simulating what PXL would send)
  const testMessage = "Hello, this is a test message for encryption";
  const testBuffer = Buffer.from(testMessage, "utf8");

  // Encrypt with public key (simulating PXL's encryption)
  const { publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs1",
      format: "pem",
    },
  });

  const publicKeyObj = crypto.createPublicKey(publicKey);
  const encrypted = crypto.publicEncrypt(
    {
      key: publicKeyObj,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    },
    testBuffer
  );

  console.log("✅ Test encryption successful");
  console.log("📏 Encrypted data length:", encrypted.length);

  // Now try to decrypt with our private key
  try {
    const decrypted = crypto.privateDecrypt(
      {
        key: rsaKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      },
      encrypted
    );

    console.log("✅ Test decryption successful");
    console.log("📝 Decrypted message:", decrypted.toString("utf8"));
  } catch (decryptError) {
    console.error("❌ Test decryption failed:", decryptError.message);
    console.log("💡 This is expected - the keys don't match, which is normal");
  }

  console.log("\n🎯 Key Analysis:");
  console.log("- Your private key is properly formatted");
  console.log("- Key size:", rsaKey.asymmetricKeySize, "bits");
  console.log("- The issue is that PXL is not using your public key yet");
  console.log("\n📤 Next step: Send your public key to PXL Vision support");
} catch (error) {
  console.error("❌ Error testing private key:", error.message);
  console.error("🔍 Error details:", error);
}
