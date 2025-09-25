const crypto = require("crypto");
const fs = require("fs");

console.log("🔑 Generating RSA key pair matching Python format (2084 bits)...");

try {
  // Generate 2084-bit RSA key pair (matching Python's rsa.newkeys(2084))
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2084, // This is the key difference - 2084 bits, not 2048!
    publicKeyEncoding: {
      type: "pkcs1", // PKCS#1 format (matching Python's save_pkcs1())
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs1", // PKCS#1 format (matching Python's save_pkcs1())
      format: "pem",
    },
  });

  console.log("✅ RSA key pair generated successfully (2084 bits)");

  // Save keys to files (matching Python's file output)
  fs.writeFileSync("pxl_private_key_correct.pem", privateKey);
  fs.writeFileSync("pxl_public_key_correct.pem", publicKey);

  console.log("💾 Keys saved to files:");
  console.log("- pxl_private_key_correct.pem");
  console.log("- pxl_public_key_correct.pem");

  // Test the new private key
  console.log("\n🧪 Testing new private key...");
  const testRsaKey = crypto.createPrivateKey(privateKey);
  console.log("✅ New private key loaded successfully!");
  console.log("🔍 Key size:", testRsaKey.asymmetricKeySize, "bits");
  console.log("🔍 Key type:", testRsaKey.asymmetricKeyType);

  // Show the keys
  console.log("\n📋 Corrected Private Key (for .env file):");
  console.log('PXL_PRIVATE_KEY="' + privateKey.replace(/\n/g, "\\n") + '"');

  console.log("\n📋 Corrected Public Key (for PXL Vision):");
  console.log(publicKey);

  console.log("\n📤 Next steps:");
  console.log(
    "1. Update your .env file with the new PXL_PRIVATE_KEY (2084 bits)"
  );
  console.log("2. Send the new public key to PXL Vision support");
  console.log("3. Test the encryption/decryption with the corrected keys");
} catch (error) {
  console.error("❌ Error generating keys:", error.message);
}
