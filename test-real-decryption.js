const crypto = require("crypto");
require("dotenv").config();

console.log("🔍 Testing Real RSA Decryption with 2084-bit Key...");

// Simulate the exact key processing from server.js
function processPrivateKey() {
  let privateKeyString = process.env.PXL_PRIVATE_KEY;

  if (!privateKeyString) {
    throw new Error("PXL_PRIVATE_KEY not found in environment");
  }

  console.log("📏 Raw private key length:", privateKeyString.length);

  // Remove escaped characters (backslashes) that might be in the environment variable
  privateKeyString = privateKeyString.replace(/\\/g, "");

  // Replace literal \n with actual newlines if needed
  if (privateKeyString.includes("\\n")) {
    privateKeyString = privateKeyString.replace(/\\n/g, "\n");
  }

  // Check if key needs PEM headers added
  if (!privateKeyString.includes("-----BEGIN")) {
    console.log("🔧 Adding PEM headers to private key...");
    // Add proper PEM headers if missing
    privateKeyString = `-----BEGIN RSA PRIVATE KEY-----\n${privateKeyString}\n-----END RSA PRIVATE KEY-----`;
    console.log("✅ PEM headers added");
  }

  return privateKeyString;
}

// Test with a realistic encrypted data size (684 bytes as seen in your logs)
function testDecryption() {
  try {
    const processedKey = processPrivateKey();
    console.log("📏 Processed private key length:", processedKey.length);

    // Load the private key
    const rsaKey = crypto.createPrivateKey(processedKey);
    console.log("✅ Private key loaded successfully");
    console.log("🔍 Key size:", rsaKey.asymmetricKeySize, "bits");
    console.log("🔍 Key type:", rsaKey.asymmetricKeyType);

    // Test with different encrypted data sizes
    const testSizes = [256, 512, 684, 1024, 2048];

    for (const size of testSizes) {
      try {
        // Generate random encrypted data of the specified size
        const encryptedData = crypto.randomBytes(size);
        console.log(
          `\n🧪 Testing decryption with ${size} bytes of encrypted data...`
        );

        // Try to decrypt (this will fail with random data, but we can see if the key can handle the size)
        const decrypted = crypto.privateDecrypt(
          {
            key: rsaKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          },
          encryptedData
        );

        console.log(`✅ Successfully decrypted ${size} bytes`);
      } catch (error) {
        if (error.message.includes("data greater than mod len")) {
          console.log(`❌ Key too small for ${size} bytes: ${error.message}`);
        } else if (error.message.includes("oaep decoding error")) {
          console.log(
            `✅ Key can handle ${size} bytes (decryption failed due to random data, not key size)`
          );
        } else {
          console.log(
            `⚠️  Unexpected error with ${size} bytes: ${error.message}`
          );
        }
      }
    }

    // Test the maximum theoretical size for 2084-bit key
    const maxSize = Math.floor(2084 / 8); // 2084 bits = 260.5 bytes, so max is 260 bytes
    console.log(
      `\n🎯 Testing maximum theoretical size for 2084-bit key: ${maxSize} bytes`
    );

    try {
      const maxEncryptedData = crypto.randomBytes(maxSize);
      const decrypted = crypto.privateDecrypt(
        {
          key: rsaKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        },
        maxEncryptedData
      );
      console.log(
        `✅ Key can handle maximum theoretical size: ${maxSize} bytes`
      );
    } catch (error) {
      if (error.message.includes("oaep decoding error")) {
        console.log(
          `✅ Key can handle maximum theoretical size: ${maxSize} bytes (decryption failed due to random data, not key size)`
        );
      } else {
        console.log(`❌ Error with maximum size: ${error.message}`);
      }
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

// Run the test
testDecryption();

console.log("\n🎯 Summary:");
console.log(
  "- If you see 'Key can handle X bytes' for sizes 684 and above, your 2084-bit key is working"
);
console.log(
  "- If you see 'Key too small' errors, there might still be an issue with the key size"
);
console.log(
  "- The 'oaep decoding error' is expected with random data - it means the key can handle the size"
);
