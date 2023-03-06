/*
THIS SOFTWARE MAY NOT BE USED FOR PRODUCTION. Otherwise,
The MIT License (MIT)

Copyright (c) Eclypses, Inc.

All rights reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import readlineSync from "readline-sync";
import fetch from "node-fetch";
import { fromByteArray } from "base64-js";
/* Step 2 */
import {
  MteDec,
  MteEnc,
  MteStatus,
  MteBase,
  MteWasm,
  MteMkeDec,
  MteMkeEnc,
  MteFlenEnc,
} from "./Mte";

/* Step 3 */
let decoderStatus = MteStatus.mte_status_success;
let encoderStatus = MteStatus.mte_status_success;
let decodedMessage: string | null;
let encodedMessage: string | null;

// ---------------------------------------------------
// Comment out to use MKE or MTE FLEN instead of MTE Core
// ---------------------------------------------------
let decoder: MteDec;
let encoder: MteEnc;

// ---------------------------------------------------
// Uncomment to use MKE instead of MTE Core
// ---------------------------------------------------
// let decoder: MteMkeDec;
// let encoder: MteMkeEnc;

// ---------------------------------------------------
// Uncomment to use MTE FLEN instead of MTE Core
// ---------------------------------------------------
// const fixedLength = 8;
// let encoder: MteFlenEnc;
// let decoder: MteDec;

(async () => {
  // This tutorial uses HTTP for communication.
  // It should be noted that MTE can be used with any type of communication. (HTTP is not required!)

  /* Step 4 */
  // Instantiate the MteWasm and MteBase
  const wasm = new MteWasm();
  await wasm.instantiate();
  const base = new MteBase(wasm);

  // OPTIONAL:
  // Display what version of MTE we are using
  const mteVersion = base.getVersion();
  console.log(`Using MTE Version ${mteVersion}`);

  /* Step 5 */
  // Set default entropy, nonce and identifier
  // Providing Entropy in this fashion is insecure. This is for demonstration purposes only and should never be done in practice.
  // If this is a trial version of the MTE, entropy must be blank
  let encoderEntropy = "";
  let decoderEntropy = "";
  const decoderNonce = "0";
  const encoderNonce = "1";
  const identifier = "demo";

  /* Step 6 */
  // Check MTE license
  // Initialize MTE license. If a license code is not required (e.g., trial mode), this can be skipped.
  const licenseCompany = "Eclypses Inc.";
  const licenseKey = "Eclypses123";

  if (!base.initLicense(licenseCompany, licenseKey)) {
    encoderStatus = MteStatus.mte_status_license_error;
    return Error(
      `License error (${base.getStatusName(
        encoderStatus
      )}): ${base.getStatusDescription(encoderStatus)}. Press any key to end.`
    );
  }

  /* Step 7 */
  // Create Instance of the Encoder
  try {
    // ---------------------------------------------------
    // Comment out to use MKE or MTE FLEN instead of MTE Core
    // ---------------------------------------------------
    encoder = MteEnc.fromdefault(wasm);

    // ---------------------------------------------------
    // Uncomment to use MKE instead of MTE Core
    // ---------------------------------------------------
    // encoder = MteMkeEnc.fromdefault(wasm);

    // ---------------------------------------------------
    // Uncomment to use MTE FLEN instead of MTE Core
    // ---------------------------------------------------
    // encoder = MteFlenEnc.fromdefault(wasm, fixedLength);

    // Check how long entropy we need and set default
    const entropyMinBytes = base.getDrbgsEntropyMinBytes(encoder.getDrbg());
    encoderEntropy =
      entropyMinBytes > 0 ? "0".repeat(entropyMinBytes) : encoderEntropy;

    // Set MTE values for the Encoder
    encoder.setEntropyStr(encoderEntropy);
    encoder.setNonce(encoderNonce);

    // Initialize MTE Encoder
    encoderStatus = encoder.instantiate(identifier);

    if (base.statusIsError(encoderStatus)) {
      throw new Error(
        `Failed to initialize the MTE Encoder engine. Status: ${base.getStatusName(
          encoderStatus
        )} / ${base.getStatusDescription(encoderStatus)}`
      );
    }
  } catch (error) {
    throw new Error(
      `Something went wrong initializing the Encoder\nStatus: ${base.getStatusName(
        encoderStatus
      )} / ${base.getStatusDescription(encoderStatus)}\nError: ${error}`
    );
  }

  /* Step 7 CONTINUED... */
  // Create Instance of the Decoder
  try {
    // ---------------------------------------------------
    // Comment out to use MKE instead of MTE Core
    // ---------------------------------------------------
    decoder = MteDec.fromdefault(wasm);

    // ---------------------------------------------------
    // Uncomment to use MKE instead of MTE Core
    // ---------------------------------------------------
    // decoder = MteMkeDec.fromdefault(wasm);

    // Check how long entropy we need and set default
    const entropyMinBytes = base.getDrbgsEntropyMinBytes(decoder.getDrbg());
    decoderEntropy =
      entropyMinBytes > 0 ? "0".repeat(entropyMinBytes) : decoderEntropy;

    // Set MTE values for the Decoder
    decoder.setEntropyStr(decoderEntropy);
    decoder.setNonce(decoderNonce);

    // Initialize MTE Decoder
    decoderStatus = decoder.instantiate(identifier);
    if (base.statusIsError(decoderStatus)) {
      throw new Error(
        `Failed to initialize the MTE Decoder engine. Status: ${base.getStatusName(
          decoderStatus
        )} / ${base.getStatusDescription(decoderStatus)}`
      );
    }
  } catch (error) {
    throw new Error(
      `Something went wrong initializing the Decoder\nStatus: ${base.getStatusName(
        decoderStatus
      )} / ${base.getStatusDescription(encoderStatus)}\nError: ${error}`
    );
  }

  // Set default IP - but also prompt for IP in case user cannot use our default
  const ip = readlineSync.question(
    `Please enter IP to use, press ENTER for default IP localhost: `,
    { defaultInput: "localhost" }
  );

  // Set default port - but also prompt for port in case user cannot use our default
  let port = 27015;

  let newPort = readlineSync.questionInt(
    `Please enter port to use, press ENTER for default port ${port}: `,
    { defaultInput: "27015" }
  );

  if (newPort) {
    while (!Number.isFinite(newPort)) {
      newPort = readlineSync.questionInt(
        `${newPort} is not a valid integer, please try again.`
      );
    }

    port = newPort;
  }

  console.log(`Client will hit endpoint ${ip}:${port}/echo`);

  // Loop through sending messages until quit is sent
  while (true) {
    // Prompt user for input to send to other side
    const message = readlineSync.question(
      '\nPlease enter text to send (To end application, please type "quit"): '
    );

    /* Step 8 */
    // Encode text to send and ensuring successful
    ({ status: encoderStatus, str: encodedMessage } =
      encoder.encodeStrB64(message));

    if (base.statusIsError(encoderStatus)) {
      console.log(
        `Error encoding: Status: ${base.getStatusName(
          encoderStatus
        )} / ${base.getStatusDescription(encoderStatus)}`
      );

      break;
    }

    // For demonstration purposes only to show packets
    console.log(`\nMTE packet Sent: ${encodedMessage}`);

    // Send message over HTTP and receive response
    const response = await fetch(`http://${ip}:${port}/echo`, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: encodedMessage ? encodedMessage : "N/A",
    });

    // Grab byte array out of response
    const responseBuffer = await response.arrayBuffer();
    const byteArray = new Uint8Array(responseBuffer);

    /* Step 8 CONTINUED... */
    // Decode incoming message and check for successful response
    ({ status: decoderStatus, str: decodedMessage } =
      decoder.decodeStr(byteArray));

    if (base.statusIsError(decoderStatus)) {
      console.log(
        `Error decoding: Status: ${base.getStatusName(
          decoderStatus
        )} / ${base.getStatusDescription(decoderStatus)}`
      );

      break;
    }

    // For demonstration purposes only to show packets
    console.log(`\nReceived MTE packet: ${fromByteArray(byteArray)}`);
    console.log(`\nDecoded data: ${decodedMessage}`);

    if (decodedMessage === "quit") {
      break;
    }
  }

  readlineSync.question("HTTP client is closed, press ENTER to end this...");
  process.exit();
})().catch((error) => {
  throw error;
});
