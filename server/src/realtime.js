// Socket.IO-ийн серверийг service давхаргаас ашиглах боломжтой болгоно.
// Тестэд socket сервер үүсгэдэггүй тул getIo() нь null буцааж болно.
let io = null;
export const setIo = (instance) => { io = instance; };
export const getIo = () => io;
