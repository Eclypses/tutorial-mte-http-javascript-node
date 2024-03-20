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

import express from "express";
import readlineSync from "readline-sync";
import { text } from "body-parser";
import { fromByteArray } from "base64-js";
import cors from "cors";
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
let encodedMessage: Uint8Array | null;

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
  const encoderNonce = "0";
  const decoderNonce = "1";
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

    // Check how long entropy we need, set default, and prompt if we need it
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

    // Check how long entropy we need, set default, and prompt if we need it
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
      )} / ${base.getStatusDescription(decoderStatus)}\nError: ${error}`
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

  // Create server
  const app = express();
  app.use(cors());
  app.use(text());

  // Listen for POST request at /echo
  app.post("/echo", (req, res) => {
    /* Step 8 */
    // Decode incoming message and check for successful response
    ({ status: decoderStatus, str: decodedMessage } = decoder.decodeStrB64(
      req.body
    ));

    if (base.statusIsError(decoderStatus)) {
      console.log(
        `Error decoding: Status: ${base.getStatusName(
          decoderStatus
        )} / ${base.getStatusDescription(decoderStatus)}`
      );

      server.close();
      process.exit();
    }

    // Printing encoded output and successful decode to console
    // OPTIONAL: Printing out for demo purposes only
    console.log(`\nReceived MTE packet: ${req.body}`);
    console.log(`\nDecoded data: ${decodedMessage}`);

    /* Step 8 */
    // Encode returning text and ensuring successful
    decodedMessage &&
      ({ status: encoderStatus, arr: encodedMessage } =
        encoder.encodeStr(decodedMessage));

    if (base.statusIsError(encoderStatus)) {
      console.log(
        `Error encoding: Status: ${base.getStatusName(
          encoderStatus
        )} / ${base.getStatusDescription(encoderStatus)}`
      );

      server.close();
      process.exit();
    }

    res.send(Buffer.from(encodedMessage ? encodedMessage : "N/A"));

    // For demonstration purposes only to show packets
    console.log(`\nMTE packet Sent: ${fromByteArray(encodedMessage!)}`);

    if (decodedMessage === "quit") {
      readlineSync.question(
        "HTTP server is closed, press ENTER to end this..."
      );
      server.close();
      process.exit();
    }
  });

  // Run server
  const server = app.listen(port, ip, () => {
    console.log(`Server is listening on ${ip}:${port}`);
  });
})().catch((error) => {
  throw error;
});
