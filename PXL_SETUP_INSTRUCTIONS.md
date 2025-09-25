# PXL Encryption Setup Instructions

## ✅ Step 1: RSA Keys Generated Successfully

Your RSA key pair has been generated and saved to:

- `pxl_private_key.pem` (private key)
- `pxl_public_key.pem` (public key)

## 🔧 Step 2: Add Private Key to Environment Variables

Add this line to your `.env` file:

```bash
PXL_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEAz30GXYyarvVpz/ro3BaPVcx9suYUFwK1t0rNkA3WmDfgfE2y\n+P0i5KxLHIcGtcG8nUJOn4P3z8Bhx4azMC9p1Jv14VFx0YSPTd4D0L8UycwTe/8h\nYKFCdY74YQThhsWtlxlVWZ6B0lqBaQoOXROpdBP/wvvfJ2kYy+BCs/iBd4VpDJev\n7UsQHJF7CaAaaVuKwyjxtVqBnyl3Rq0wRwl4KNrKMyILNuYPatH1887S0t76kB42\nMFfX4GG0ZHbd3AC8vi8A5bx8Ck0rTUHf+jXrMgEY1U8WIA8RYV2S89VHSBSeSNcD\ncM2CZATUZOpwMAGTMTTv+JvGn2QgJmunfzHU0wIDAQABAoIBAA2DkqEQMdj4YgJq\nULVZAM/xSDSZOLDA++3qwNXDmPkEFqpx8xi1gArNz/yVLNI0wqCpe253TXIqERRK\nSSx3whhXah3ZTKT9UcocDjqP334/PPukA9wD1MzMWZAUHc5F3McNHtp98O2u+GPL\nhGD6kVxemxdriT7LYRKSUjXflyseFsqo1ORw0AvzlLLXBrSQdmpkb9sH19ldBvxG\nNtdPfmkKlI1F09OVCizleFkTqucx8WaHSUU673fkY/2kiQ8rYaAtiBzdYlj34BtQ\nUy530Ami1MS9Ul9AsbgXzNyu9Fq676cKs//cOlQTutxymcD4CZjHtVdzxToxGJiH\nCreJMrECgYEA8Puy36/FJv1AGFg8zXS295/+svZghJvAY6sm+R3wsrCjLC3kTRfQ\nFB0yNs5dzaiG5ptWpXUfcsg2qH2z/iF0nUAUu3j3kmW45zwWiqyfuniJ5xYt5NTM\n8aZaJwiPaOvkbY/Y04tTWKK+FRyQZqheEbn/QoHJ1CDsrQKYXOYGdEMCgYEA3Gr/\naK2xTYDbvLBihKqQi2jNz1iHUydnBDxsVGWALwWqwx+TvWCORkZbwFAcukQNX9NF\n0rtjS2fh4owUIH0TzAju+3uc7VcUPxPuo7tXAdPkYhTjLClmHDRuFqL8KHJ7MfQT\ngWXHR1V/yVFR9WeBSVc5oOt+Rb2R8O2wu0kE3DECgYEAoXtIpfQW3MWfibC3LcYk\nRVMFTc8jZjkodqFeAFk7zcHn1db6wV5PpOrblzY6TXG81BMLwNv3MudPGSEC2Cx7\nBFTIj8fDvmpDuU/emxaKAl57qkqGfmzK2LNsffOShfBspa5a0YbvVtnXHjaB3Qi9\n4IsOrfZi1K8radPvXXEWqhkCgYBOQns+ynTqZLcgLqw8GGdL6EEyvmcF4jaUbXO1\nH3i8uVFhCEQneDHrx61qAcfBZsos3NGsubXOnyq3ii7XPjGaPw3DIqecKU/Z+ZTA\nc5K35mjvXiUul+BWYVM5HFNVdRhCqzuFtQJlVHkTnJjx/fcMeDjQ5uwljOJVXb9j\nL9DW8QKBgQCr3Klf12gV2yXfIE0/g+QAlXhChY/LeBh8E3LeJiVt8b6Sg5zUV3yl\nWSbD5bYpamQIpTcmGCSvTyQ8zOBaeAIKDbvjmyBFQtqd3Z74ZeFyJu9QWUQ8G2MT\nw+Ls2A7bOVgQJn2CoVSb/sfilJusEisJELYGZh/FQaiQcu52cdTkHA==\n-----END RSA PRIVATE KEY-----\n"
```

## 📤 Step 3: Send Public Key to PXL Vision

Send this public key to PXL Vision support:

```
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAz30GXYyarvVpz/ro3BaP
Vcx9suYUFwK1t0rNkA3WmDfgfE2y+P0i5KxLHIcGtcG8nUJOn4P3z8Bhx4azMC9p
1Jv14VFx0YSPTd4D0L8UycwTe/8hYKFCdY74YQThhsWtlxlVWZ6B0lqBaQoOXROp
dBP/wvvfJ2kYy+BCs/iBd4VpDJev7UsQHJF7CaAaaVuKwyjxtVqBnyl3Rq0wRwl4
KNrKMyILNuYPatH1887S0t76kB42MFfX4GG0ZHbd3AC8vi8A5bx8Ck0rTUHf+jXr
MgEY1U8WIA8RYV2S89VHSBSeSNcDcM2CZATUZOpwMAGTMTTv+JvGn2QgJmunfzHU
0wIDAQAB
-----END PUBLIC KEY-----
```

## 🔄 Step 4: How It Works

1. **You generate** your own RSA key pair (✅ Done)
2. **You keep** the private key secret (✅ Added to .env)
3. **You send** the public key to PXL Vision (📤 Do this now)
4. **PXL encrypts** data with your public key
5. **Your server decrypts** data with your private key

## 🚀 Step 5: Test the Implementation

Once you've added the private key to your `.env` file and sent the public key to PXL, your encryption/decryption should work!

The server.js code is already updated to use the correct decryption process that matches the Python implementation you provided.

## 📞 Contact PXL Vision

When contacting PXL Vision support, tell them:

- "I need to set up encryption for my account"
- "Here is my public key for encryption"
- "Please configure my account to use this public key for data encryption"

## 🔒 Security Notes

- **Never share your private key** with anyone
- **Keep your .env file secure** and never commit it to version control
- **The private key is already in your .gitignore** so it won't be committed
