window.gsend = SOCKET.send;
SOCKET.send = (a) => (console.log("i>",a), window.gsend(a))
window.adata = ENGINE.applyData;
ENGINE.applyData = (...a) => (console.log("I<", ...a), window.adata(...a))