const crypto = require("crypto");
const fs = require("fs");

console.log("🔑 Generating new RSA key pair...");

try {
  // Generate 2048-bit RSA key pair
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
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

  console.log("✅ RSA key pair generated successfully");

  // Save keys to files
  fs.writeFileSync("pxl_private_key_new.pem", privateKey);
  fs.writeFileSync("pxl_public_key_new.pem", publicKey);

  console.log("💾 Keys saved to files:");
  console.log("- pxl_private_key_new.pem");
  console.log("- pxl_public_key_new.pem");

  // Test the new private key
  console.log("\n🧪 Testing new private key...");
  const testRsaKey = crypto.createPrivateKey(privateKey);
  console.log("✅ New private key loaded successfully!");
  console.log("🔍 Key size:", testRsaKey.asymmetricKeySize, "bits");
  console.log("🔍 Key type:", testRsaKey.asymmetricKeyType);

  // Show the keys
  console.log("\n📋 New Private Key (for .env file):");
  console.log('PXL_PRIVATE_KEY="' + privateKey.replace(/\n/g, "\\n") + '"');

  console.log("\n📋 New Public Key (for PXL Vision):");
  console.log(publicKey);

  console.log("\n📤 Next steps:");
  console.log("1. Update your .env file with the new PXL_PRIVATE_KEY");
  console.log("2. Send the new public key to PXL Vision support");
  console.log("3. Test the encryption/decryption with the new keys");
} catch (error) {
  console.error("❌ Error generating keys:", error.message);
}
