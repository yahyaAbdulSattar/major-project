import socket
import pickle
import threading

def send_weights(host, port, weights):
    data = pickle.dumps(weights)
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.connect((host, port))
        s.sendall(data)

def start_peer_server(port, callback):
    def handle_client(conn):
        data = b""
        while True:
            packet = conn.recv(4096)
            if not packet: break
            data += packet
        weights = pickle.loads(data)
        callback(weights)

    def server():
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("localhost", port))
            s.listen()
            while True:
                conn, _ = s.accept()
                threading.Thread(target=handle_client, args=(conn,)).start()

    threading.Thread(target=server, daemon=True).start()
