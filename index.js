const net = require("net");

const server = net.createServer((clientSocket) => {
  clientSocket.once("data", (data) => {
    // SOCKS5 handshake
    if (data[0] !== 0x05) {
      clientSocket.end();
      return;
    }

    // Send no-auth response
    clientSocket.write(Buffer.from([0x05, 0x00]));

    clientSocket.once("data", (req) => {
      if (req[1] !== 0x01) {
        // Only CONNECT supported
        clientSocket.end();
        return;
      }

      let addr;
      let port;
      let offset;

      if (req[3] === 0x01) {
        // IPv4
        addr = req.slice(4, 8).join(".");
        offset = 8;
      } else if (req[3] === 0x03) {
        // Domain
        const len = req[4];
        addr = req.slice(5, 5 + len).toString("utf8");
        offset = 5 + len;
      } else {
        clientSocket.end();
        return;
      }
      port = req.readUInt16BE(offset);

      // Connect remote
      const remoteSocket = net.createConnection(port, addr, () => {
        // Reply success
        const resp = Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]);
        clientSocket.write(resp);

        // Pipe data
        clientSocket.pipe(remoteSocket);
        remoteSocket.pipe(clientSocket);
      });

      remoteSocket.on("error", () => {
        // Reply failure
        const resp = Buffer.from([0x05, 0x05, 0x00, 0x01, 0, 0, 0, 0, 0, 0]);
        clientSocket.write(resp);
        clientSocket.end();
      });
    });
  });
});

const PORT = parseInt(process.env.PORT || "", 10) || 1080;
server.listen(PORT, () => {
  console.log(`SOCKS5 proxy listening on port ${PORT}`);
});
