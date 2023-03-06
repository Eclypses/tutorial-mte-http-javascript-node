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

import express from 'express';
import readlineSync from 'readline-sync';
import cors from 'cors';
import { text } from 'body-parser';

try {
  (async () => {
    // This tutorial uses HTTP for communication.
    // It should be noted that the MTE can be used with any type of communication. (HTTP is not required!)

    // Here is where you would want to gather settings for the MTE
    // Check MTE license and run DRBG self test

    // Set default IP - but also prompt for IP in case user cannot use our default
    let ip = readlineSync.question(
      `Please enter IP to use, press ENTER for default IP localhost: `,
      { defaultInput: 'localhost' },
    );

    // Set default port - but also prompt for port in case user cannot use our default
    let port = 27015;

    let newPort = readlineSync.questionInt(
      `Please enter port to use, press ENTER for default port ${port}: `,
      { defaultInput: '27015' },
    );

    if (newPort) {
      while (!Number.isFinite(newPort)) {
        newPort = readlineSync.questionInt(
          `${newPort} is not a valid integer, please try again.`,
        );
      }

      port = newPort;
    }

    // Create server
    const app = express();
    app.use(cors());
    app.use(text());

    // Listen for POST request at /echo
    app.post('/echo', (req, res) => {
      // MTE Decoding the text would go here after receiving the request

      console.log(`\nReceived message: ${req.body}`);

      // MTE Encoding the text (into byte array to be compatible with C#)
      // would go here instead of using the Node TextEncoder
      const encodedMessage = new TextEncoder().encode(req.body);

      res.send(Buffer.from(encodedMessage));

      if (req.body === 'quit') {
        readlineSync.question(
          'HTTP server is closed, press ENTER to end this...',
        );
        server.close();
        process.exit();
      }
    });

    // Run server
    const server = app.listen(port, ip, () => {
      console.log(`Server is listening on ${ip}:${port}`);
    });
  })();
} catch (error) {
  throw error;
}
