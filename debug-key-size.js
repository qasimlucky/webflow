const crypto = require("crypto");

console.log("🔍 Debugging RSA Key Size Issue...");

// Test with different key sizes
const keySizes = [2048, 2084, 3072, 4096];

for (const size of keySizes) {
  try {
    console.log(`\n🧪 Testing ${size}-bit key generation...`);

    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: size,
      publicKeyEncoding: {
        type: "pkcs1",
        format: "pem",
      },
      privateKeyEncoding: {
        type: "pkcs1",
        format: "pem",
      },
    });

    console.log(`✅ ${size}-bit key generated successfully`);

    // Test loading the key
    const rsaKey = crypto.createPrivateKey(privateKey);
    console.log(
      `🔍 Key size reported by Node.js: ${rsaKey.asymmetricKeySize} bits`
    );
    console.log(`🔍 Key type: ${rsaKey.asymmetricKeyType}`);

    // Test maximum data size
    const maxDataSize = Math.floor(size / 8);
    console.log(`📏 Theoretical max data size: ${maxDataSize} bytes`);

    // Test with actual data
    try {
      const testData = crypto.randomBytes(maxDataSize);
      const decrypted = crypto.privateDecrypt(
        {
          key: rsaKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        },
        testData
      );
      console.log(`✅ Can handle ${maxDataSize} bytes (decryption succeeded)`);
    } catch (error) {
      if (error.message.includes("oaep decoding error")) {
        console.log(
          `✅ Can handle ${maxDataSize} bytes (decryption failed due to random data, not key size)`
        );
      } else if (error.message.includes("data greater than mod len")) {
        console.log(`❌ Cannot handle ${maxDataSize} bytes: ${error.message}`);
      } else {
        console.log(`⚠️  Unexpected error: ${error.message}`);
      }
    }
  } catch (error) {
    console.log(`❌ Error generating ${size}-bit key: ${error.message}`);
  }
}

console.log("\n🎯 Analysis:");
console.log(
  "- If 2084-bit keys show 'undefined' size, there might be a Node.js limitation"
);
console.log(
  "- If 2048-bit keys work but 2084-bit don't, we need to use 2048-bit"
);
console.log(
  "- The key is that PXL Vision needs to use the same key size as your private key"
);
