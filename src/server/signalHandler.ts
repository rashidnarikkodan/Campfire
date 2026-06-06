import { Server as SocketIOServer, Socket } from "socket.io";
import { socketRoom } from "./roomManager";

type SignalPayload = {
  targetSocketId: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

function canSignal(socket: Socket, targetSocketId: string) {
  if (!targetSocketId || targetSocketId === socket.id) return false;
  const roomId = socketRoom.get(socket.id);
  return Boolean(roomId && socketRoom.get(targetSocketId) === roomId);
}

export function registerSignalHandlers(io: SocketIOServer, socket: Socket) {
  socket.on("signal:offer", ({ targetSocketId, ...signalData }: SignalPayload) => {
    if (!canSignal(socket, targetSocketId)) return;
    io.to(targetSocketId).emit("signal:offer", {
      fromSocketId: socket.id,
      ...signalData,
    });
  });

  socket.on("signal:answer", ({ targetSocketId, ...signalData }: SignalPayload) => {
    if (!canSignal(socket, targetSocketId)) return;
    io.to(targetSocketId).emit("signal:answer", {
      fromSocketId: socket.id,
      ...signalData,
    });
  });

  socket.on("signal:ice-candidate", ({ targetSocketId, ...signalData }: SignalPayload) => {
    if (!canSignal(socket, targetSocketId)) return;
    io.to(targetSocketId).emit("signal:ice-candidate", {
      fromSocketId: socket.id,
      ...signalData,
    });
  });
}
