const express = require("express");
const cors = require("cors");
const http = require("http");
const crypto = require("crypto");
const { Server } = require("socket.io");

const app = express();
const httpServer = http.createServer(app); // creating http server
const PORT = 5001;

// creating socket io server on top of http server
const socketServer = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// Simple root route
app.get("/", (req, res) => {
  res.status(200).send({ code: 200, msg: "Server is running 🚀" });
});

const db = {
  "51c2da54-8694-4d57-a9f8-ae00de480092": {
    users: ["Aakash", "Shbuham"],
    data: "console.log('hello');",
  },
};

app.post("/createRoom", (req, res) => {
  try {
    const body = req.body;

    const roomId = crypto.randomUUID();

    db[roomId] = {
      users: [body.name],
      data: "",
    };

    res.status(200).send({
      msg: "Room created successfully !!",
      data: { roomId },
    });
  } catch (error) {
    res
      .status(400)
      .send({ msg: "Something went wrong in create room !!", data: null });
  }
});

app.post("/validateRoomId/:roomId", (req, res) => {
  try {
    const { roomId } = req.params;
    const { name } = req.body;

    console.log("validateRoomId" + roomId);

    if (!db[roomId]) {
      throw new Error("Invalid room id !!");
    }

    const users = db[roomId].users;

    users.push(name);

    db[roomId].users = users;

    console.log(db[roomId]);

    res.status(200).send({
      success: true,
      msg: "Room created successfully !!",
    });
  } catch (error) {
    console.dir(error.message);
    res.status(400).send({
      success: false,
      msg: error.message || "Something went wrong in create room !!",
      data: null,
    });
  }
});

socketServer.on("connection", (socket) => {
  console.log("Socket connected ", socket.id);
  //   console.log(socket);

  // receive a message from client
  socket.on("PING", (data) => {
    console.log("Received PING from client:", data);

    const { roomId, name } = data;

    // Disconnect cuurent sockets in the room
    if (!roomId || !db[roomId]) {
      // socket.disconnect(true);
      socket.emit("INVALID_ROOM_ID", {
        success: false,
        msg: "Invalid Room ID.",
      });
      return;
    }

    const currentRoomData = db[roomId];

    // MOST IMP STEP: join socket with roomId.
    socket.join(roomId);

    // emit pong event for all the active user
    socketServer.to(roomId).emit("PONG", {
      message: "Hello from server",
      data: currentRoomData,
    });

    if (currentRoomData?.users?.length > 1 && name) {
      socket.to(roomId).emit("NEW_USER_JOINED", {
        success: true,
        msg: `${name} joined room.`,
      });
    }
  });

  socket.on("CODE_CHANGED", (req) => {
    console.log("CODE_CHANGED event called");
    const { data, roomId } = req;

    db[roomId].data = data;

    socket.to(roomId).emit("PONG", {
      message: "Hello from server",
      data: db[roomId],
    });
  });

  socket.on("END_SESSION", ({ roomId }) => {
    console.log("END_SESSION ", roomId);
    if (roomId) {
      delete db[roomId];

      // Disconnect all sockets in the room
      socketServer.in(roomId).disconnectSockets(true);
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
